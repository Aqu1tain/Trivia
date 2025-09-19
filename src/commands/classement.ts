import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

import { obtenirServiceClassements } from '../core/classements';
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
    .setDMPermission(false),
  executer: async (interaction) => {
    const type = (interaction.options.getString('type') ?? 'global') as (typeof TYPES_DISPONIBLES)[number]['name'];
    const limite = interaction.options.getInteger('limite') ?? 10;
    const service = obtenirServiceClassements();

    try {
      const top = service.obtenirTop(type, limite);

      if (top.length === 0) {
        await interaction.reply({
          content: `Aucun point enregistré pour le classement ${type}.`,
          ephemeral: true,
        });
        return;
      }

      const lignes = top
        .map((entree, index) => `${placeEmoji(index)} <@${entree.utilisateurId}> — **${entree.points} pts**`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`🏆 ${titreComplet(type)}`)
        .setDescription(lignes)
        .setColor(0x9b59b6)
        .setFooter({ text: `Limitée aux ${limite} premiers résultats` })
        .setTimestamp(new Date());

      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
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

function placeEmoji(position: number): string {
  switch (position) {
    case 0:
      return '🥇';
    case 1:
      return '🥈';
    case 2:
      return '🥉';
    default:
      return `#${position + 1}`;
  }
}

function titreComplet(type: string): string {
  switch (type) {
    case 'quotidien':
      return 'Classement quotidien';
    case 'hebdomadaire':
      return 'Classement hebdomadaire';
    case 'mensuel':
      return 'Classement mensuel';
    case 'global':
      return 'Classement global';
    default:
      return 'Classement';
  }
}
