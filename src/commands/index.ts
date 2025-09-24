import { commandeClassement } from './classement';
import { commandeConfig } from './config';
import { commandeMesPoints } from './mes-points';
import { commandeModifierPoints } from './modifier-points';
import { commandePing } from './ping';
import { commandeQuestionDuJour } from './question-du-jour';
import { commandeRegenererQuestions } from './regenerer-questions';
import { commandeShowRunningConfig } from './show-running-config';
import { commandeStatistiques } from './statistiques';
import type { Commande } from './types';

export const commandesDisponibles: Commande[] = [
  commandeClassement,
  commandeConfig,
  commandeMesPoints,
  commandeModifierPoints,
  commandePing,
  commandeQuestionDuJour,
  commandeRegenererQuestions,
  commandeShowRunningConfig,
  commandeStatistiques,
];
