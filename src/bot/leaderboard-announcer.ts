import {
  ActionRowBuilder,
  Client,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextChannel,
} from 'discord.js';

import { obtenirServiceClassements } from '../core/classements';
import type { ConfigurationGuilde } from '../core/configuration-guildes';
import { listerConfigurationsGuildes } from '../core/configuration-guildes';
import type { TypeClassement } from '../score/classement-service';
import { dayjs } from '../utils/date';
import { journalPrincipal } from '../utils/journalisation';

const TYPES: TypeClassement[] = ['quotidien', 'hebdomadaire', 'mensuel', 'global'];
const SELECT_CUSTOM_ID = 'lb-select';

export async function annoncerClassementFinDeJournee(client: Client, date: Date = new Date()): Promise<void> {
  const configurations = listerConfigurationsGuildes();
  if (configurations.length === 0) {
    return;
  }

  for (const configuration of configurations) {
    await publierClassementPourGuilde(client, configuration, date).catch((erreur) => {
      journalPrincipal.erreur('Impossible de poster le classement de fin de journée', erreur, {
        guildId: configuration.guildId,
      });
    });
  }
}

async function publierClassementPourGuilde(
  client: Client,
  configuration: ConfigurationGuilde,
  date: Date,
): Promise<void> {
  const channel = await client.channels.fetch(configuration.channelId);
  if (!channel || !(channel instanceof TextChannel)) {
    journalPrincipal.erreur('Salon introuvable pour annoncer le classement de fin de journée', {
      guildId: configuration.guildId,
      channelId: configuration.channelId,
      type: channel?.type,
    });
    return;
  }

  const embed = genererEmbedClassement('quotidien', configuration.guildId);
  const menu = construireMenu('quotidien', {
    guildId: configuration.guildId,
    limite: 10,
    ownerId: null,
  });

  await channel.send({
    content: `🏁 Classements du ${dayjs(date).format('DD/MM/YYYY')} :`,
    embeds: [embed],
    components: [menu],
  });
}

export async function traiterSelectionClassement(interaction: StringSelectMenuInteraction): Promise<void> {
  if (!interaction.customId.startsWith(SELECT_CUSTOM_ID)) {
    return;
  }

  const { guildId, ownerId, limite } = extraireParametres(interaction.customId);
  if (!guildId || interaction.guildId !== guildId) {
    await interaction.reply({
      content: 'Ce sélecteur n’est pas valide pour ce serveur.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (ownerId && ownerId !== interaction.user.id) {
    await interaction.reply({
      content: 'Seule la personne ayant demandé ce classement peut changer la vue.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const value = interaction.values[0];
  const type = value as TypeClassement;
  if (!TYPES.includes(type)) {
    await interaction.reply({
      content: 'Classement inconnu.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const embed = genererEmbedClassement(type, guildId, limite);
    const menu = construireMenu(type, { guildId, limite, ownerId });

    await interaction.update({
      embeds: [embed],
      components: [menu],
    });
  } catch (erreur) {
    journalPrincipal.erreur('Erreur lors de la mise à jour du classement interactif', erreur);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: "Impossible d'afficher ce classement." });
    } else {
      await interaction.reply({
        content: "Impossible d'afficher ce classement.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

export function genererEmbedClassement(type: TypeClassement, guildId: string, limite: number = 10): EmbedBuilder {
  const service = obtenirServiceClassements();
  const top = service.obtenirTop(type, guildId, limite);

  const description =
    top.length > 0
      ? top.map((entree, index) => `**${index + 1}.** <@${entree.utilisateurId}> — ${entree.points} pts`).join('\n')
      : 'Aucun participant pour ce classement.';

  return new EmbedBuilder()
    .setTitle(titreComplet(type))
    .setDescription(description)
    .setColor(0x5865f2)
    .setFooter({ text: `DailyTrivia • Top ${limite}` })
    .setTimestamp(new Date());
}

function titreComplet(type: TypeClassement): string {
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

function titreCourt(type: TypeClassement): string {
  switch (type) {
    case 'quotidien':
      return 'Jour';
    case 'hebdomadaire':
      return 'Semaine';
    case 'mensuel':
      return 'Mois';
    case 'global':
      return 'Global';
    default:
      return type;
  }
}

export function construireMenu(
  typeActif: TypeClassement,
  options: { ownerId?: string | null; limite?: number; guildId: string },
): ActionRowBuilder<StringSelectMenuBuilder> {
  const { ownerId = null, limite = 10, guildId } = options;
  const customId = [SELECT_CUSTOM_ID, guildId, ownerId ?? '', String(limite)].join('|');
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('Choisis un classement à afficher')
    .addOptions(
      TYPES.map((type) => ({
        label: titreComplet(type),
        value: type,
        description: `Voir le classement ${titreCourt(type).toLowerCase()}`,
        emoji: emojiPourType(type),
        default: type === typeActif,
      })),
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

function emojiPourType(type: TypeClassement): string {
  switch (type) {
    case 'quotidien':
      return '🌅';
    case 'hebdomadaire':
      return '🗓️';
    case 'mensuel':
      return '📆';
    case 'global':
      return '🌍';
    default:
      return '🏆';
  }
}

function extraireParametres(customId: string): { guildId: string | null; ownerId: string | null; limite: number } {
  const segments = customId.split('|');
  if (segments[0] !== SELECT_CUSTOM_ID) {
    return { guildId: null, ownerId: null, limite: 10 };
  }

  const guildId = segments[1] && segments[1].length > 0 ? segments[1] : null;
  const ownerId = segments[2] && segments[2].length > 0 ? segments[2] : null;
  const limite = segments[3] ? Number.parseInt(segments[3], 10) : 10;
  return {
    guildId,
    ownerId,
    limite: Number.isFinite(limite) && limite > 0 ? limite : 10,
  };
}
