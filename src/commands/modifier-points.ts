import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { obtenirServiceClassements, sauvegarderClassementsActuels } from '../core/classements';
import { obtenirConfigurationGuilde } from '../core/configuration-guildes';
import type { TypeClassement } from '../score/classement-service';
import { dayjs } from '../utils/date';

import type { Commande } from './types';

const TYPES_CLASSEMENT: TypeClassement[] = ['quotidien', 'hebdomadaire', 'mensuel', 'global'];

export const commandeModifierPoints: Commande = {
  definition: new SlashCommandBuilder()
    .setName('modifier-points')
    .setDescription('Met à jour le score d’un membre sur les classements du serveur.')
    .addUserOption((option) =>
      option.setName('membre').setDescription('Membre à ajuster').setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('valeur')
        .setDescription('Nouvelle valeur fixée (remplace le score actuel)')
        .setRequired(false),
    )
    .addIntegerOption((option) =>
      option
        .setName('ajout')
        .setDescription('Nombre de points à ajouter (positif ou négatif)')
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Classement ciblé (laisser vide = tous)')
        .addChoices(
          { name: 'Quotidien', value: 'quotidien' },
          { name: 'Hebdomadaire', value: 'hebdomadaire' },
          { name: 'Mensuel', value: 'mensuel' },
          { name: 'Global', value: 'global' },
        )
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  executer: async (interaction) => {
    if (!interaction.guildId) {
      await interaction.reply({
        content: 'Commande disponible uniquement sur un serveur.',
        ephemeral: true,
      });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: 'Seuls les responsables du serveur peuvent modifier les scores.',
        ephemeral: true,
      });
      return;
    }

    const membre = interaction.options.getUser('membre', true);
    const valeur = interaction.options.getInteger('valeur');
    const ajout = interaction.options.getInteger('ajout');
    const typeChoisi = interaction.options.getString('type') as TypeClassement | null;

    if (valeur === null && ajout === null) {
      await interaction.reply({
        content: 'Indique au moins `valeur` ou `ajout` pour modifier le score.',
        ephemeral: true,
      });
      return;
    }

    const service = obtenirServiceClassements();
    const configuration = obtenirConfigurationGuilde(interaction.guildId);
    const timezone = configuration?.timezone ?? 'Europe/Paris';
    const maintenant = dayjs();

    const types = typeChoisi ? [typeChoisi] : TYPES_CLASSEMENT;

    for (const type of types) {
      const entree = service.obtenirScoreUtilisateur(type, interaction.guildId, membre.id);
      const pointsActuels = entree?.points ?? 0;
      const nouveau = valeur !== null ? valeur : pointsActuels + (ajout ?? 0);
      const diff = nouveau - pointsActuels;
      if (diff === 0) {
        continue;
      }
      service.ajouterScore(type, interaction.guildId, membre.id, diff, maintenant.toDate(), timezone);
    }

    sauvegarderClassementsActuels();

    const resume = types.map((type) => `• ${typeLabel(type)}`).join('\n');

    await interaction.reply({
      content: `Points mis à jour pour <@${membre.id}> :\n${resume}`,
      ephemeral: true,
    });
  },
};

function typeLabel(type: TypeClassement): string {
  switch (type) {
    case 'quotidien':
      return 'Quotidien';
    case 'hebdomadaire':
      return 'Hebdomadaire';
    case 'mensuel':
      return 'Mensuel';
    case 'global':
      return 'Global';
    default:
      return type;
  }
}
