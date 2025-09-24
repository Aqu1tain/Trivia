import dayjs from '../utils/date';

import { journalPrincipal } from '../utils/journalisation';

import type { NiveauDifficulte, ParametresRecherche, QuestionTrivia, QuizzApiClient } from './quizzapi';

export type NiveauQuestion = Extract<NiveauDifficulte, 'facile' | 'moyen' | 'difficile'>;

export type StatutParticipation = 'correct' | 'incorrect' | 'timeout';

export interface ParticipationQuestion {
  reponse: string | null;
  statut: StatutParticipation;
  reponduLe: string;
}

export interface EtatQuestionDuJour {
  question: QuestionTrivia;
  participants: Map<string, Map<string, ParticipationQuestion>>;
}

export interface QuestionsDuJour {
  cle: string;
  niveau: Record<NiveauQuestion, EtatQuestionDuJour>;
  genereLe: string;
}

export interface QuestionSnapshotEntry {
  genereLe: string;
  niveau: Record<
    NiveauQuestion,
    {
      question: QuestionTrivia;
      participants: Record<
        string,
        Record<
          string,
          {
            reponse: string | null;
            statut: StatutParticipation;
            reponduLe: string;
          }
        >
      >;
    }
  >;
}

export type QuestionsSnapshot = Record<string, QuestionSnapshotEntry>;

export const NIVEAUX_QUESTIONS: NiveauQuestion[] = ['facile', 'moyen', 'difficile'];

type ClientQuizzMinimal = Pick<QuizzApiClient, 'recupererQuestions'>;

export const CLE_GUILDE_LEGACY = '__legacy__';

export class GestionnaireQuestionsDuJour {
  private readonly cache = new Map<string, QuestionsDuJour>();

  private onChange?: (snapshot: QuestionsSnapshot) => void;

  constructor(private readonly client: ClientQuizzMinimal, initialSnapshot?: QuestionsSnapshot) {
    if (initialSnapshot) {
      this.chargerDepuisSnapshot(initialSnapshot);
    }
  }

  public async obtenirJeuPour(date: Date): Promise<QuestionsDuJour> {
    const cle = this.normaliserDate(date);
    const existant = this.cache.get(cle);

    if (existant) {
      return existant;
    }

    const genere = await this.genererQuestions(cle);
    this.cache.set(cle, genere);
    this.notifierChangement();
    return genere;
  }

  public aDejaRepondu(date: Date, niveau: NiveauQuestion, utilisateurId: string, guildId: string): boolean {
    const jeu = this.cache.get(this.normaliserDate(date));
    if (!jeu) {
      return false;
    }

    const participants = this.trouverParticipantsPourGuilde(jeu.niveau[niveau].participants, guildId);
    if (!participants) {
      return false;
    }
    return participants.has(utilisateurId);
  }

  public enregistrerParticipation(
    date: Date,
    niveau: NiveauQuestion,
    utilisateurId: string,
    guildId: string,
    participation: ParticipationQuestion,
  ): void {
    const cle = this.normaliserDate(date);
    const jeu = this.cache.get(cle);
    if (!jeu) {
      throw new Error(`Questions du ${cle} introuvables.`);
    }

    const participants = this.obtenirOuCreerParticipantsPourGuilde(jeu.niveau[niveau].participants, guildId);
    participants.set(utilisateurId, participation);
    this.notifierChangement();
  }

  public reinitialiserPour(date: Date): void {
    const cle = this.normaliserDate(date);
    this.cache.delete(cle);
    this.notifierChangement();
  }

  private async genererQuestions(cle: string): Promise<QuestionsDuJour> {
    const niveaux = await Promise.all(
      NIVEAUX_QUESTIONS.map(async (niveau) => {
        const question = await this.recupererQuestionPourNiveau(niveau);
        return [niveau, { question, participants: new Map<string, Map<string, ParticipationQuestion>>() }] as const;
      }),
    );

    const niveau = Object.fromEntries(niveaux) as Record<NiveauQuestion, EtatQuestionDuJour>;

    const resultat: QuestionsDuJour = {
      cle,
      niveau,
      genereLe: dayjs().toISOString(),
    };

    journalPrincipal.info('Questions du jour générées', {
      cle,
      ids: niveaux.map(([n, etat]) => `${n}:${etat.question.id}`),
    });

    return resultat;
  }

  private async recupererQuestionPourNiveau(niveau: NiveauQuestion): Promise<QuestionTrivia> {
    const parametres: ParametresRecherche = {
      difficulte: niveau,
      limite: 1,
    };

    const [question] = await this.client.recupererQuestions(parametres);
    if (!question) {
      throw new Error(`Aucune question disponible pour la difficulté ${niveau}`);
    }
    return question;
  }

  private normaliserDate(date: Date): string {
    return dayjs(date).format('YYYY-MM-DD');
  }

  public definirCallbackPersistance(callback: (snapshot: QuestionsSnapshot) => void): void {
    this.onChange = callback;
  }

  public toSnapshot(): QuestionsSnapshot {
    const snapshot: QuestionsSnapshot = {};
    for (const [cle, valeur] of this.cache.entries()) {
      snapshot[cle] = {
        genereLe: valeur.genereLe,
        niveau: {
          facile: {
            question: valeur.niveau.facile.question,
            participants: serialiserParticipants(valeur.niveau.facile.participants),
          },
          moyen: {
            question: valeur.niveau.moyen.question,
            participants: serialiserParticipants(valeur.niveau.moyen.participants),
          },
          difficile: {
            question: valeur.niveau.difficile.question,
            participants: serialiserParticipants(valeur.niveau.difficile.participants),
          },
        },
      };
    }
    return snapshot;
  }

  private notifierChangement(): void {
    if (this.onChange) {
      this.onChange(this.toSnapshot());
    }
  }

  private chargerDepuisSnapshot(snapshot: QuestionsSnapshot): void {
    for (const [cle, entree] of Object.entries(snapshot)) {
      const niveau: Record<NiveauQuestion, EtatQuestionDuJour> = {
        facile: {
          question: entree.niveau.facile.question,
          participants: restaurerParticipants(entree.niveau.facile.participants),
        },
        moyen: {
          question: entree.niveau.moyen.question,
          participants: restaurerParticipants(entree.niveau.moyen.participants),
        },
        difficile: {
          question: entree.niveau.difficile.question,
          participants: restaurerParticipants(entree.niveau.difficile.participants),
        },
      };

      this.cache.set(cle, {
        cle,
        niveau,
        genereLe: entree.genereLe,
      });
    }
  }

  private trouverParticipantsPourGuilde(
    collection: Map<string, Map<string, ParticipationQuestion>>,
    guildId: string,
  ): Map<string, ParticipationQuestion> | undefined {
    return collection.get(guildId) ?? collection.get(CLE_GUILDE_LEGACY);
  }

  private obtenirOuCreerParticipantsPourGuilde(
    collection: Map<string, Map<string, ParticipationQuestion>>,
    guildId: string,
  ): Map<string, ParticipationQuestion> {
    let participants = collection.get(guildId);
    if (!participants) {
      const legacy = collection.get(CLE_GUILDE_LEGACY);
      if (legacy) {
        participants = new Map(legacy);
        collection.delete(CLE_GUILDE_LEGACY);
      } else {
        participants = new Map<string, ParticipationQuestion>();
      }
      collection.set(guildId, participants);
    }
    return participants;
  }
}

function serialiserParticipants(
  participants: Map<string, Map<string, ParticipationQuestion>>,
): Record<
  string,
  Record<
    string,
    {
      reponse: string | null;
      statut: StatutParticipation;
      reponduLe: string;
    }
  >
> {
  const resultat: Record<string, Record<string, { reponse: string | null; statut: StatutParticipation; reponduLe: string }>> = {};
  for (const [guildId, participationGuilde] of participants.entries()) {
    resultat[guildId] = Object.fromEntries(
      Array.from(participationGuilde.entries()).map(([utilisateurId, participation]) => [
        utilisateurId,
        {
          reponse: participation.reponse,
          statut: participation.statut,
          reponduLe: participation.reponduLe,
        },
      ]),
    );
  }
  return resultat;
}

function restaurerParticipants(
  valeur: Record<string, unknown> | undefined,
): Map<string, Map<string, ParticipationQuestion>> {
  const resultat = new Map<string, Map<string, ParticipationQuestion>>();
  if (!valeur || typeof valeur !== 'object') {
    return resultat;
  }

  const entries = Object.entries(valeur);
  const estLegacy = entries.every(([, participation]) => estParticipationBrute(participation));

  if (estLegacy) {
    const participants = new Map<string, ParticipationQuestion>();
    for (const [utilisateurId, participation] of entries) {
      const normalise = normaliserParticipation(participation);
      if (normalise) {
        participants.set(utilisateurId, normalise);
      }
    }
    if (participants.size > 0) {
      resultat.set(CLE_GUILDE_LEGACY, participants);
    }
    return resultat;
  }

  for (const [guildId, brutParticipants] of entries) {
    if (typeof brutParticipants !== 'object' || brutParticipants === null) {
      continue;
    }
    const mapParticipants = new Map<string, ParticipationQuestion>();
    for (const [utilisateurId, participation] of Object.entries(brutParticipants as Record<string, unknown>)) {
      const normalise = normaliserParticipation(participation);
      if (normalise) {
        mapParticipants.set(utilisateurId, normalise);
      }
    }
    if (mapParticipants.size > 0) {
      resultat.set(guildId, mapParticipants);
    }
  }

  return resultat;
}

function estParticipationBrute(valeur: unknown): valeur is {
  reponse?: unknown;
  statut?: unknown;
  reponduLe?: unknown;
} {
  return typeof valeur === 'object' && valeur !== null;
}

function normaliserParticipation(valeur: unknown): ParticipationQuestion | null {
  if (!estParticipationBrute(valeur)) {
    return null;
  }

  const brute = valeur as {
    reponse?: unknown;
    statut?: unknown;
    reponduLe?: unknown;
  };

  const statut =
    brute.statut === 'correct' || brute.statut === 'incorrect' || brute.statut === 'timeout' ? brute.statut : 'incorrect';

  const reponse = typeof brute.reponse === 'string' ? brute.reponse : null;
  const reponduLe = typeof brute.reponduLe === 'string' ? brute.reponduLe : dayjs().toISOString();

  return {
    reponse,
    statut,
    reponduLe,
  };
}
