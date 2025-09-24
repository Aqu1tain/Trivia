import fs from 'fs';
import path from 'path';

import { CLE_GUILDE_LEGACY, type NiveauQuestion, type QuestionsSnapshot, type StatutParticipation } from '../services/questions-du-jour';
import type { QuestionTrivia } from '../services/quizzapi';
import { journalPrincipal } from '../utils/journalisation';

const DATA_DIRECTORY = process.env.DATA_STORE_DIR ?? path.join(process.cwd(), 'data');
const QUESTIONS_PATH = process.env.QUESTIONS_STORE_PATH ?? path.join(DATA_DIRECTORY, 'questions.json');

const NIVEAUX: NiveauQuestion[] = ['facile', 'moyen', 'difficile'];

let cache: QuestionsSnapshot | null = null;

function estStatutParticipation(valeur: unknown): valeur is StatutParticipation {
  return valeur === 'correct' || valeur === 'incorrect' || valeur === 'timeout';
}

function estRecord(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null;
}

function lireString(source: Record<string, unknown>, cle: string): string | null {
  const valeur = source[cle];
  return typeof valeur === 'string' ? valeur : null;
}

function lireRecord(source: Record<string, unknown>, cle: string): Record<string, unknown> | null {
  const valeur = source[cle];
  return estRecord(valeur) ? valeur : null;
}

function normaliserParticipants(
  valeur: unknown,
  repliDate: string,
): Record<string, Record<string, { reponse: string | null; statut: StatutParticipation; reponduLe: string }>> {
  const resultat: Record<string, Record<string, { reponse: string | null; statut: StatutParticipation; reponduLe: string }>> = {};

  if (Array.isArray(valeur)) {
    const participants: Record<string, { reponse: string | null; statut: StatutParticipation; reponduLe: string }> = {};
    for (const participant of valeur) {
      if (typeof participant !== 'string') {
        continue;
      }
      participants[participant] = {
        reponse: null,
        statut: 'timeout',
        reponduLe: repliDate,
      };
    }
    if (Object.keys(participants).length > 0) {
      resultat[CLE_GUILDE_LEGACY] = participants;
    }
    return resultat;
  }

  if (!estRecord(valeur)) {
    return resultat;
  }

  const brut = valeur;
  const estLegacy = Object.values(brut).every((entree) =>
    estRecord(entree) && !Array.isArray(entree) && 'statut' in entree,
  );

  if (estLegacy) {
    const participants = normaliserParticipantsSimples(brut, repliDate);
    if (Object.keys(participants).length > 0) {
      resultat[CLE_GUILDE_LEGACY] = participants;
    }
    return resultat;
  }

  for (const [guildId, participationsGuild] of Object.entries(brut)) {
    if (!estRecord(participationsGuild)) {
      continue;
    }

    const participants = normaliserParticipantsSimples(participationsGuild, repliDate);
    if (Object.keys(participants).length > 0) {
      resultat[guildId] = participants;
    }
  }

  return resultat;
}

function normaliserParticipantsSimples(
  valeur: Record<string, unknown>,
  repliDate: string,
): Record<string, { reponse: string | null; statut: StatutParticipation; reponduLe: string }> {
  const resultat: Record<string, { reponse: string | null; statut: StatutParticipation; reponduLe: string }> = {};
  for (const [identifiant, participation] of Object.entries(valeur)) {
    if (!estRecord(participation)) {
      continue;
    }

    const reponse = lireString(participation, 'reponse');
    const statutBrut = participation['statut'];
    const statut = estStatutParticipation(statutBrut) ? statutBrut : 'incorrect';
    const reponduLeBrut = lireString(participation, 'reponduLe');
    const reponduLe = reponduLeBrut ?? repliDate;

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
  if (!estRecord(value)) {
    return null;
  }

  const id = lireString(value, 'id');
  const questionTexte = lireString(value, 'question');
  const reponse = lireString(value, 'reponse');
  const categorie = lireString(value, 'categorie');

  if (!id || !questionTexte || !reponse || !categorie) {
    return null;
  }

  const resultat: QuestionTrivia = {
    id,
    question: questionTexte,
    reponse,
    categorie,
    difficulte: niveau,
    propositions: [],
  };

  const propositions = value.propositions;
  if (Array.isArray(propositions)) {
    resultat.propositions = propositions.filter(
      (proposition): proposition is string => typeof proposition === 'string',
    );
  }

  return resultat;
}

function normaliserQuestions(value: unknown): QuestionsSnapshot {
  const resultat: QuestionsSnapshot = {};
  if (!estRecord(value)) {
    return resultat;
  }

  const brut = value;
  for (const [date, entree] of Object.entries(brut)) {
    if (!estRecord(entree)) {
      continue;
    }

    const genereLe = lireString(entree, 'genereLe') ?? new Date().toISOString();

    const niveauxBruts = lireRecord(entree, 'niveau');
    if (!niveauxBruts) {
      continue;
    }

    const niveauNormalise = {} as QuestionsSnapshot[string]['niveau'];

    let valide = true;
    for (const niveau of NIVEAUX) {
      const brutNiveau = niveauxBruts[niveau];
      if (!estRecord(brutNiveau)) {
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
          participants: cloneParticipants(entree.niveau.facile.participants),
        },
        moyen: {
          question: { ...entree.niveau.moyen.question },
          participants: cloneParticipants(entree.niveau.moyen.participants),
        },
        difficile: {
          question: { ...entree.niveau.difficile.question },
          participants: cloneParticipants(entree.niveau.difficile.participants),
        },
      },
    };
  }
  return resultat;
}

function cloneParticipants(
  participants: Record<string, Record<string, { reponse: string | null; statut: StatutParticipation; reponduLe: string }>>,
): Record<string, Record<string, { reponse: string | null; statut: StatutParticipation; reponduLe: string }>> {
  const clone: Record<string, Record<string, { reponse: string | null; statut: StatutParticipation; reponduLe: string }>> = {};
  for (const [guildId, membres] of Object.entries(participants)) {
    clone[guildId] = Object.fromEntries(
      Object.entries(membres).map(([utilisateurId, participation]) => [
        utilisateurId,
        { ...participation },
      ]),
    );
  }
  return clone;
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
