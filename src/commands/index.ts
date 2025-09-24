import { commandeClassement } from './classement';
import { commandeConfig } from './config';
import { commandeMesPoints } from './mes-points';
import { commandePing } from './ping';
import { commandeQuestionDuJour } from './question-du-jour';
import { commandeRegenererQuestions } from './regenerer-questions';
import { commandeStatistiques } from './statistiques';
import { commandeShowRunningConfig } from './show-running-config';
import { commandeModifierPoints } from './modifier-points';
import type { Commande } from './types';

export const commandesDisponibles: Commande[] = [
  commandeClassement,
  commandeMesPoints,
  commandeStatistiques,
  commandePing,
  commandeQuestionDuJour,
  commandeRegenererQuestions,
  commandeConfig,
  commandeShowRunningConfig,
  commandeModifierPoints,
];
