import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

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

const ID_CONFIRMER = 'regenerer-confirmer';
const ID_ANNULER = 'regenerer-annuler';

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

    const confirmation = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(ID_CONFIRMER)
        .setLabel('Confirmer la régénération')
        .setEmoji('♻️')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(ID_ANNULER).setLabel('Annuler').setStyle(ButtonStyle.Secondary),
    );

    const message = await interaction.reply({
      content: 'Confirme-tu vouloir régénérer et republier les questions du jour ?',
      components: [confirmation],
      ephemeral: true,
      fetchReply: true,
    });

    try {
      const choix = await message.awaitMessageComponent({
        componentType: ComponentType.Button,
        time: 20_000,
        filter: (component) => component.user.id === interaction.user.id,
      });

      if (choix.customId === ID_ANNULER) {
        await choix.update({
          content: 'Régénération annulée.',
          components: [],
        });
        return;
      }

      await choix.update({
        content: '♻️ Régénération des questions en cours…',
        components: [],
      });

      try {
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

        await choix.editReply({
          content: `Questions du ${jeu.cle} régénérées et annonce repostée :\n${resume}`,
        });
      } catch (erreur) {
        journalPrincipal.erreur('Échec de régénération des questions', erreur);
        await choix.editReply({
          content: 'Impossible de régénérer les questions pour le moment.',
        });
      }
    } catch {
      await interaction.editReply({
        content: 'Temps écoulé sans confirmation. Régénération annulée.',
        components: [],
      });
    }
  },
};
