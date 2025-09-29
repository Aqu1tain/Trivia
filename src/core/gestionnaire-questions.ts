import { obtenirConfiguration, type Configuration } from '../config/environnement';
import type { QuestionsDuJour } from '../services/questions-du-jour';
import { GestionnaireQuestionsDuJour } from '../services/questions-du-jour';
import { QuizzApiClient } from '../services/quizzapi';
import { DeepLTraducteur, OpenTdbClient } from '../services/opentdb';
import type { ClientTrivia } from '../services/trivia';
import { lireQuestionsState, sauvegarderQuestionsState } from '../storage/questions';

let gestionnaire: GestionnaireQuestionsDuJour | null = null;

function initialiserGestionnaire(): GestionnaireQuestionsDuJour {
  const config = obtenirConfiguration();
  const client = creerClientTrivia(config);
  const snapshot = lireQuestionsState();
  const instance = new GestionnaireQuestionsDuJour(client, snapshot);
  instance.definirCallbackPersistance((questions) => sauvegarderQuestionsState(questions));
  return instance;
}

function creerClientTrivia(config: Configuration): ClientTrivia {
  if (config.fournisseurQuestions === 'quizzapi') {
    return new QuizzApiClient(config.urlApiQuizz);
  }

  const traducteur = new DeepLTraducteur(config.deeplApiKey);
  return new OpenTdbClient(config.urlApiOpenTdb, traducteur);
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
