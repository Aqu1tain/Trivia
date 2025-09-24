import fs from 'fs';
import path from 'path';

import type { NiveauQuestion, QuestionsSnapshot, StatutParticipation } from '../services/questions-du-jour';
import type { QuestionTrivia } from '../services/quizzapi';
import { journalPrincipal } from '../utils/journalisation';

const DATA_DIRECTORY = process.env.DATA_STORE_DIR ?? path.join(process.cwd(), 'data');
const QUESTIONS_PATH = process.env.QUESTIONS_STORE_PATH ?? path.join(DATA_DIRECTORY, 'questions.json');

const NIVEAUX: NiveauQuestion[] = ['facile', 'moyen', 'difficile'];

let cache: QuestionsSnapshot | null = null;

type ParticipantsBruts = Record<
  string,
  {
    reponse?: unknown;
    statut?: unknown;
    reponduLe?: unknown;
  }
>;

function estStatutParticipation(valeur: unknown): valeur is StatutParticipation {
  return valeur === 'correct' || valeur === 'incorrect' || valeur === 'timeout';
}

function normaliserParticipants(
  valeur: unknown,
  repliDate: string,
): Record<string, { reponse: string | null; statut: StatutParticipation; reponduLe: string }> {
  const resultat: Record<string, { reponse: string | null; statut: StatutParticipation; reponduLe: string }> = {};

  if (Array.isArray(valeur)) {
    for (const participant of valeur) {
      if (typeof participant !== 'string') {
        continue;
      }
      resultat[participant] = {
        reponse: null,
        statut: 'timeout',
        reponduLe: repliDate,
      };
    }
    return resultat;
  }

  if (typeof valeur !== 'object' || valeur === null) {
    return resultat;
  }

  const brut = valeur as ParticipantsBruts;
  for (const [identifiant, participation] of Object.entries(brut)) {
    const reponse = typeof participation.reponse === 'string' ? participation.reponse : null;
    const statut = estStatutParticipation(participation.statut) ? participation.statut : 'incorrect';
    const reponduLe = typeof participation.reponduLe === 'string' ? participation.reponduLe : repliDate;

    resultat[identifiant] = {
      reponse,
      statut,
      reponduLe,
    };
  }

  return resultat;
}

function ensureDirectoryExists(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function normaliserQuestionTrivia(value: unknown, niveau: NiveauQuestion): QuestionTrivia | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const question = value as Partial<QuestionTrivia>;
  if (
    typeof question.id !== 'string' ||
    typeof question.question !== 'string' ||
    typeof question.reponse !== 'string' ||
    typeof question.categorie !== 'string'
  ) {
    return null;
  }

  const resultat: QuestionTrivia = {
    id: question.id,
    question: question.question,
    reponse: question.reponse,
    categorie: question.categorie,
    difficulte: niveau,
    propositions: [],
  };

  if (Array.isArray(question.propositions)) {
    resultat.propositions = question.propositions.filter(
      (proposition): proposition is string => typeof proposition === 'string',
    );
  }

  return resultat;
}

function normaliserQuestions(value: unknown): QuestionsSnapshot {
  const resultat: QuestionsSnapshot = {};
  if (typeof value !== 'object' || value === null) {
    return resultat;
  }

  const brut = value as Record<string, unknown>;
  for (const [date, entree] of Object.entries(brut)) {
    if (typeof entree !== 'object' || entree === null) {
      continue;
    }

    const entreeBrute = entree as {
      genereLe?: unknown;
      niveau?: Record<string, unknown>;
    };

    const genereLe =
      typeof entreeBrute.genereLe === 'string' ? entreeBrute.genereLe : new Date().toISOString();

    const niveauxBruts = entreeBrute.niveau;
    if (!niveauxBruts || typeof niveauxBruts !== 'object') {
      continue;
    }

    const niveauNormalise = {} as QuestionsSnapshot[string]['niveau'];

    let valide = true;
    for (const niveau of NIVEAUX) {
      const brutNiveau = niveauxBruts[niveau] as { question?: unknown; participants?: unknown } | undefined;
      if (!brutNiveau) {
        valide = false;
        break;
      }

      const question = normaliserQuestionTrivia(brutNiveau.question, niveau);
      if (!question) {
        valide = false;
        break;
      }

      const participants = normaliserParticipants(brutNiveau.participants, genereLe);

      niveauNormalise[niveau] = {
        question,
        participants,
      };
    }

    if (!valide) {
      continue;
    }

    resultat[date] = {
      genereLe,
      niveau: niveauNormalise,
    };
  }

  return resultat;
}

function cloneQuestions(snapshot: QuestionsSnapshot): QuestionsSnapshot {
  const resultat: QuestionsSnapshot = {};
  for (const [date, entree] of Object.entries(snapshot)) {
    resultat[date] = {
      genereLe: entree.genereLe,
      niveau: {
        facile: {
          question: { ...entree.niveau.facile.question },
          participants: Object.fromEntries(
            Object.entries(entree.niveau.facile.participants).map(([id, participation]) => [
              id,
              { ...participation },
            ]),
          ),
        },
        moyen: {
          question: { ...entree.niveau.moyen.question },
          participants: Object.fromEntries(
            Object.entries(entree.niveau.moyen.participants).map(([id, participation]) => [
              id,
              { ...participation },
            ]),
          ),
        },
        difficile: {
          question: { ...entree.niveau.difficile.question },
          participants: Object.fromEntries(
            Object.entries(entree.niveau.difficile.participants).map(([id, participation]) => [
              id,
              { ...participation },
            ]),
          ),
        },
      },
    };
  }
  return resultat;
}

function loadState(): QuestionsSnapshot {
  if (cache) {
    return cache;
  }

  try {
    if (!fs.existsSync(QUESTIONS_PATH)) {
      cache = {};
      return cache;
    }

    const raw = fs.readFileSync(QUESTIONS_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    cache = normaliserQuestions(parsed);
    return cache;
  } catch (erreur) {
    journalPrincipal.erreur('Impossible de charger les questions depuis le disque', erreur);
    cache = {};
    return cache;
  }
}

export function lireQuestionsState(): QuestionsSnapshot {
  return cloneQuestions(loadState());
}

export function sauvegarderQuestionsState(questions: QuestionsSnapshot): void {
  try {
    ensureDirectoryExists(QUESTIONS_PATH);
    fs.writeFileSync(QUESTIONS_PATH, JSON.stringify(questions, null, 2), 'utf-8');
    cache = cloneQuestions(questions);
  } catch (erreur) {
    journalPrincipal.erreur('Impossible de sauvegarder les questions sur le disque', erreur);
  }
}

export function resetQuestionsState(): void {
  sauvegarderQuestionsState({});
}
