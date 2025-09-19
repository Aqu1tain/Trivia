import dayjs from 'dayjs';

import { journalPrincipal } from '../utils/journalisation';

import type { NiveauDifficulte, ParametresRecherche, QuestionTrivia, QuizzApiClient } from './quizzapi';

export type NiveauQuestion = Extract<NiveauDifficulte, 'facile' | 'moyen' | 'difficile'>;

export interface EtatQuestionDuJour {
  question: QuestionTrivia;
  participants: Set<string>;
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
      participants: string[];
    }
  >;
}

export type QuestionsSnapshot = Record<string, QuestionSnapshotEntry>;

export const NIVEAUX_QUESTIONS: NiveauQuestion[] = ['facile', 'moyen', 'difficile'];

type ClientQuizzMinimal = Pick<QuizzApiClient, 'recupererQuestions'>;

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

  public aDejaRepondu(date: Date, niveau: NiveauQuestion, utilisateurId: string): boolean {
    const jeu = this.cache.get(this.normaliserDate(date));
    if (!jeu) {
      return false;
    }

    return jeu.niveau[niveau].participants.has(utilisateurId);
  }

  public enregistrerParticipation(date: Date, niveau: NiveauQuestion, utilisateurId: string): void {
    const cle = this.normaliserDate(date);
    const jeu = this.cache.get(cle);
    if (!jeu) {
      throw new Error(`Questions du ${cle} introuvables.`);
    }

    jeu.niveau[niveau].participants.add(utilisateurId);
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
        return [niveau, { question, participants: new Set<string>() }] as const;
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
            participants: Array.from(valeur.niveau.facile.participants),
          },
          moyen: {
            question: valeur.niveau.moyen.question,
            participants: Array.from(valeur.niveau.moyen.participants),
          },
          difficile: {
            question: valeur.niveau.difficile.question,
            participants: Array.from(valeur.niveau.difficile.participants),
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
          participants: new Set(entree.niveau.facile.participants),
        },
        moyen: {
          question: entree.niveau.moyen.question,
          participants: new Set(entree.niveau.moyen.participants),
        },
        difficile: {
          question: entree.niveau.difficile.question,
          participants: new Set(entree.niveau.difficile.participants),
        },
      };

      this.cache.set(cle, {
        cle,
        niveau,
        genereLe: entree.genereLe,
      });
    }
  }
}
