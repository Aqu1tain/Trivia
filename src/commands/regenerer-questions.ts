import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { publierAnnonceQuotidienne } from '../bot/scheduler';
import { regenererQuestionsDuJour } from '../core/gestionnaire-questions';
import { NIVEAUX_QUESTIONS } from '../services/questions-du-jour';
import { journalPrincipal } from '../utils/journalisation';

import type { Commande } from './types';

const LIBELLES = {
  facile: 'facile',
  moyen: 'moyenne',
  difficile: 'difficile',
} as const;

export const commandeRegenererQuestions: Commande = {
  definition: new SlashCommandBuilder()
    .setName('regenerer-questions')
    .setDescription('Régénère les questions du jour (administrateurs uniquement).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),
  executer: async (interaction) => {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: 'Seuls les administrateurs peuvent régénérer les questions du jour.',
        ephemeral: true,
      });
      return;
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      const jeu = await regenererQuestionsDuJour();
      await publierAnnonceQuotidienne(interaction.client, new Date(), {
        questions: jeu,
        force: true,
      });
      const resume = NIVEAUX_QUESTIONS.map((niveau) => {
        const question = jeu.niveau[niveau].question;
        return `${LIBELLES[niveau]} ➜ ${question.question}`;
      }).join('\n');

      journalPrincipal.info('Questions régénérées manuellement', {
        cle: jeu.cle,
        auteur: interaction.user.id,
      });

      await interaction.editReply({
        content: `Questions du ${jeu.cle} régénérées et annonce repostée :\n${resume}`,
      });
    } catch (erreur) {
      journalPrincipal.erreur('Échec de régénération des questions', erreur);
      await interaction.editReply({
        content: 'Impossible de régénérer les questions pour le moment.',
      });
    }
  },
};
