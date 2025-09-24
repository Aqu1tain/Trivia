import { SlashCommandBuilder } from 'discord.js';

import { construireMenu, genererEmbedClassement } from '../bot/leaderboard-announcer';
import { journalPrincipal } from '../utils/journalisation';

import type { Commande } from './types';

const TYPES_DISPONIBLES = [
  { name: 'quotidien', description: 'Classement du jour' },
  { name: 'hebdomadaire', description: 'Classement de la semaine' },
  { name: 'mensuel', description: 'Classement du mois' },
  { name: 'global', description: 'Classement global' },
] as const;

export const commandeClassement: Commande = {
  definition: new SlashCommandBuilder()
    .setName('classement')
    .setDescription('Affiche le classement des joueuses/joueurs pour un type donné.')
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Classement à consulter')
        .addChoices(...TYPES_DISPONIBLES.map((type) => ({ name: type.description, value: type.name })))
        .setRequired(false),
    )
    .addIntegerOption((option) =>
      option
        .setName('limite')
        .setDescription('Nombre de lignes à afficher (1-25)')
        .setMinValue(1)
        .setMaxValue(25)
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName('prive')
        .setDescription('Affiche le résultat uniquement pour toi')
        .setRequired(false),
    )
    .setDMPermission(false),
  executer: async (interaction) => {
    const type = (interaction.options.getString('type') ?? 'global') as (typeof TYPES_DISPONIBLES)[number]['name'];
    const limite = interaction.options.getInteger('limite') ?? 10;
    const prive = interaction.options.getBoolean('prive') ?? false;
    try {
      const embed = genererEmbedClassement(type, limite);
      const menu = construireMenu(type, { ownerId: interaction.user.id, limite });

      await interaction.reply({
        embeds: [embed],
        components: [menu],
        ephemeral: prive,
      });
    } catch (erreur) {
      journalPrincipal.erreur('Erreur lors de la consultation du classement', erreur);
      await interaction.reply({
        content: "Impossible d'afficher le classement pour le moment.",
        ephemeral: true,
      });
    }
  },
};
