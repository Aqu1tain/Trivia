import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { obtenirConfiguration } from '../config/environnement';
import { obtenirConfigurationGuilde } from '../core/configuration-guildes';
import dayjs from '../utils/date';

import type { Commande } from './types';

const configurationGlobale = obtenirConfiguration();

export const commandeShowRunningConfig: Commande = {
  definition: new SlashCommandBuilder()
    .setName('show-running-config')
    .setDescription('Affiche la configuration actuelle de DailyTrivia pour ce serveur.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  executer: async (interaction) => {
    if (!interaction.guildId) {
      await interaction.reply({
        content: 'Cette commande doit être utilisée depuis un serveur Discord.',
        ephemeral: true,
      });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: 'Seuls les responsables du serveur peuvent consulter cette configuration.',
        ephemeral: true,
      });
      return;
    }

    const configuration = obtenirConfigurationGuilde(interaction.guildId);

    if (!configuration) {
      await interaction.reply({
        content:
          "Aucune configuration n'est enregistrée pour ce serveur. Utilise `/config` pour définir le salon et l’heure de publication.",
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('⚙️ Configuration actuelle de DailyTrivia')
      .addFields(
        { name: 'Salon configuré', value: `<#${configuration.channelId}>`, inline: true },
        {
          name: 'Horaire de publication',
          value: `${String(configuration.heureAnnonce).padStart(2, '0')}h${String(configuration.minuteAnnonce).padStart(2, '0')} (${configuration.timezone})`,
          inline: true,
        },
        { name: 'Créée le', value: formatDate(configuration.creeLe), inline: false },
        { name: 'Dernière modification', value: formatDate(configuration.misAJourLe), inline: false },
      )
      .setFooter({
        text: `Fuseau par défaut: ${configurationGlobale.heureAnnonceDefaut.toString().padStart(2, '0')}h${configurationGlobale.minuteAnnonceDefaut.toString().padStart(2, '0')} (Europe/Paris)`,
      })
      .setColor(0x7289da);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

function formatDate(dateIso: string): string {
  return dayjs(dateIso).format('DD/MM/YYYY à HH:mm:ss');
}
