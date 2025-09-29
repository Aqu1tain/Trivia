import { ChannelType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { obtenirPlanificateur } from '../bot/scheduler-registry';
import { obtenirConfiguration } from '../config/environnement';
import { definirConfigurationGuilde } from '../core/configuration-guildes';

import type { Commande } from './types';

const configurationGlobale = obtenirConfiguration();

export const commandeConfig: Commande = {
  definition: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure le salon et l’horaire de publication quotidienne de DailyTrivia.')
    .addChannelOption((option) =>
      option
        .setName('salon')
        .setDescription('Salon où publier les questions quotidiennes')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('heure')
        .setDescription('Heure de publication (0-23)')
        .setMinValue(0)
        .setMaxValue(23)
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('minute')
        .setDescription('Minute de publication (0-59)')
        .setMinValue(0)
        .setMaxValue(59)
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  executer: async (interaction) => {
    if (!interaction.guildId) {
      await interaction.reply({
        content: 'Cette commande doit être utilisée depuis un serveur.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: 'Seuls les responsables du serveur peuvent configurer DailyTrivia.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const salon = interaction.options.getChannel('salon', true);
    if (!salon || (salon.type !== ChannelType.GuildText && salon.type !== ChannelType.GuildAnnouncement)) {
      await interaction.reply({
        content: 'Merci de sélectionner un salon textuel du serveur.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const heure = interaction.options.getInteger('heure', true);
    const minute = interaction.options.getInteger('minute') ?? configurationGlobale.minuteAnnonceDefaut;

    definirConfigurationGuilde(interaction.guildId, {
      channelId: salon.id,
      heureAnnonce: heure,
      minuteAnnonce: minute,
    });

    obtenirPlanificateur()?.rafraichir();

    await interaction.reply({
      content: `Configuration enregistrée ! Les questions seront publiées à ${formatHeure(heure, minute)} dans <#${salon.id}>.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

function formatHeure(heure: number, minute: number): string {
  return `${String(heure).padStart(2, '0')}h${String(minute).padStart(2, '0')}`;
}
