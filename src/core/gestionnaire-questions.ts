import { obtenirConfiguration } from '../config/environnement';
import type { QuestionsDuJour } from '../services/questions-du-jour';
import { GestionnaireQuestionsDuJour } from '../services/questions-du-jour';
import { QuizzApiClient } from '../services/quizzapi';
import { lireQuestionsState, sauvegarderQuestionsState } from '../storage/questions';

let gestionnaire: GestionnaireQuestionsDuJour | null = null;

function initialiserGestionnaire(): GestionnaireQuestionsDuJour {
  const config = obtenirConfiguration();
  const client = new QuizzApiClient(config.urlApiQuizz);
  const snapshot = lireQuestionsState();
  const instance = new GestionnaireQuestionsDuJour(client, snapshot);
  instance.definirCallbackPersistance((questions) => sauvegarderQuestionsState(questions));
  return instance;
}

export function obtenirGestionnaireQuestions(): GestionnaireQuestionsDuJour {
  if (!gestionnaire) {
    gestionnaire = initialiserGestionnaire();
  }

  return gestionnaire;
}

export async function regenererQuestionsDuJour(date: Date = new Date()): Promise<QuestionsDuJour> {
  const instance = obtenirGestionnaireQuestions();
  instance.reinitialiserPour(date);
  return instance.obtenirJeuPour(date);
}

export function reinitialiserGestionnaire(): void {
  gestionnaire = null;
}
