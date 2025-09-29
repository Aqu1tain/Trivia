import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

import { obtenirServiceClassements } from '../core/classements';
import { normaliserEphemere } from '../utils/interactions';
import { journalPrincipal } from '../utils/journalisation';

import type { Commande } from './types';

const TYPES_DISPONIBLES = [
  { name: 'quotidien', description: 'Classement du jour' },
  { name: 'hebdomadaire', description: 'Classement de la semaine' },
  { name: 'mensuel', description: 'Classement du mois' },
  { name: 'global', description: 'Classement global' },
] as const;

export const commandeMesPoints: Commande = {
  definition: new SlashCommandBuilder()
    .setName('mes-points')
    .setDescription('Affiche tes points pour un classement donné.')
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Classement à consulter')
        .addChoices(...TYPES_DISPONIBLES.map((type) => ({ name: type.description, value: type.name })))
        .setRequired(false),
    ),
  executer: async (interaction) => {
    if (!interaction.guildId) {
      await interaction.reply(
        normaliserEphemere({
          content: 'Cette commande doit être utilisée depuis un serveur.',
          ephemeral: true,
        }),
      );
      return;
    }

    const type = (interaction.options.getString('type') ?? 'global') as (typeof TYPES_DISPONIBLES)[number]['name'];
    const service = obtenirServiceClassements();

    try {
      const entree = service.obtenirScoreUtilisateur(type, interaction.guildId, interaction.user.id);

      if (!entree) {
        await interaction.reply(
          normaliserEphemere({
            content: `Tu n'as pas encore de points dans le classement ${type}. Participe aux questions du jour !`,
            ephemeral: true,
          }),
        );
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('✨ Tes points')
        .setColor(0x1abc9c)
        .setDescription(
          `Tu cumules **${entree.points} points** dans le classement ${type}.
          \nDernière mise à jour : ${new Date(entree.derniereMiseAJour).toLocaleString('fr-FR')}`,
        )
        .setFooter({ text: 'Réponds tôt et juste pour multiplier tes gains !' });

      await interaction.reply(normaliserEphemere({ embeds: [embed], ephemeral: true }));
    } catch (erreur) {
      journalPrincipal.erreur('Erreur lors de la consultation des points utilisateur', erreur);
      await interaction.reply(
        normaliserEphemere({
          content: "Impossible d'afficher tes points pour le moment.",
          ephemeral: true,
        }),
      );
    }
  },
};
