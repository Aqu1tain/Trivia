import axios, { AxiosInstance } from 'axios';

import { journalPrincipal } from '../utils/journalisation';
import type { ClientTrivia, NiveauDifficulte, ParametresRecherche, QuestionTrivia } from './trivia';

interface QuizzApiQuestionDto {
  id?: string;
  question?: string;
  answer?: string;
  badAnswers?: string[];
  category?: string;
  difficulty?: string;
}

interface QuizzApiResponse {
  count?: number;
  quizzes?: QuizzApiQuestionDto[];
}

/**
 * Client minimal pour interroger quizzapi.jomoreschi.fr.
 */
export class QuizzApiClient implements ClientTrivia {
  private readonly http: AxiosInstance;

  constructor(baseUrl: string) {
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: 5000,
    });
  }

  public async recupererQuestions(parametres: ParametresRecherche = {}): Promise<QuestionTrivia[]> {
    try {
      const { data } = await this.http.get<QuizzApiResponse>('/quiz', {
        params: {
          limit: parametres.limite ?? 3,
          difficulty: mapperDifficultePourApi(parametres.difficulte),
          category: parametres.categorie,
        },
      });

      const questions = (data.quizzes ?? []).map((entree) => formaterQuestion(entree));
      return questions;
    } catch (erreur: unknown) {
      const erreurNormalisee = erreur instanceof Error ? erreur : new Error('Erreur inconnue');
      journalPrincipal.erreur('Impossible de récupérer les questions auprès de QuizzAPI', erreurNormalisee);
      throw erreurNormalisee;
    }
  }
}

function formaterQuestion(entree: QuizzApiQuestionDto): QuestionTrivia {
  const reponse = entree.answer ?? 'Réponse inconnue';
  const mauvaisesReponses = Array.isArray(entree.badAnswers) ? entree.badAnswers : [];
  const propositions = genererPropositions(reponse, mauvaisesReponses);

  return {
    id: entree.id ?? genererIdentifiantFallback(entree.question),
    question: entree.question ?? 'Question indisponible',
    propositions,
    reponse,
    categorie: entree.category ?? 'Général',
    difficulte: normaliserDifficulte(entree.difficulty),
  };
}

function genererPropositions(reponse: string, mauvaisesReponses: string[]): string[] {
  const propositions = new Set<string>([reponse, ...mauvaisesReponses]);
  return Array.from(propositions);
}

function genererIdentifiantFallback(question?: string): string {
  if (question && question.length > 0) {
    return question.slice(0, 32);
  }

  return `question-${Date.now()}`;
}

function normaliserDifficulte(entree: string | undefined): NiveauDifficulte {
  const valeur = (entree ?? '').toLowerCase();
  if (valeur.includes('fac')) {
    return 'facile';
  }
  if (valeur.includes('dif')) {
    return 'difficile';
  }
  return 'moyen';
}

function mapperDifficultePourApi(difficulte?: NiveauDifficulte): string | undefined {
  if (!difficulte) {
    return undefined;
  }

  if (difficulte === 'moyen') {
    return 'normal';
  }

  return difficulte;
}
