import dayjs from '../utils/date';
import {
  ActionRowBuilder,
  Client,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextChannel,
} from 'discord.js';

import { obtenirConfiguration } from '../config/environnement';
import { obtenirServiceClassements } from '../core/classements';
import type { TypeClassement } from '../score/classement-service';
import { journalPrincipal } from '../utils/journalisation';

const TYPES: TypeClassement[] = ['quotidien', 'hebdomadaire', 'mensuel', 'global'];
const SELECT_CUSTOM_ID = 'lb-select';

export async function annoncerClassementFinDeJournee(client: Client, date: Date = new Date()): Promise<void> {
  const config = obtenirConfiguration();
  const channel = await client.channels.fetch(config.identifiantSalonQuestions);
  if (!channel || !(channel instanceof TextChannel)) {
    journalPrincipal.erreur('Salon introuvable pour annoncer le classement de fin de journée', {
      channelId: config.identifiantSalonQuestions,
      type: channel?.type,
    });
    return;
  }

  try {
    const embed = genererEmbedClassement('quotidien');
    const menu = construireMenu('quotidien');

    await channel.send({
      content: `🏁 Classements du ${dayjs(date).format('DD/MM/YYYY')} :`,
      embeds: [embed],
      components: [menu],
    });
  } catch (erreur) {
    journalPrincipal.erreur('Impossible de poster le classement de fin de journée', erreur);
  }
}

export async function traiterSelectionClassement(interaction: StringSelectMenuInteraction): Promise<void> {
  if (!interaction.customId.startsWith(SELECT_CUSTOM_ID)) {
    return;
  }

  const value = interaction.values[0];
  const type = value as TypeClassement;
  if (!TYPES.includes(type)) {
    await interaction.reply({
      content: 'Classement inconnu.',
      ephemeral: true,
    });
    return;
  }

  try {
    const { ownerId, limite } = extraireParametres(interaction.customId);

    if (ownerId && ownerId !== interaction.user.id) {
      await interaction.reply({
        content: 'Seule la personne ayant demandé ce classement peut changer la vue.',
        ephemeral: true,
      });
      return;
    }

    const embed = genererEmbedClassement(type, limite);
    const menu = construireMenu(type, { ownerId, limite });

    await interaction.update({
      embeds: [embed],
      components: [menu],
    });
  } catch (erreur) {
    journalPrincipal.erreur('Erreur lors de la mise à jour du classement interactif', erreur);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: "Impossible d'afficher ce classement." });
    } else {
      await interaction.reply({ content: "Impossible d'afficher ce classement.", ephemeral: true });
    }
  }
}

export function genererEmbedClassement(type: TypeClassement, limite: number = 10): EmbedBuilder {
  const service = obtenirServiceClassements();
  const top = service.obtenirTop(type, limite);

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
  options: { ownerId?: string | null; limite?: number } = {},
): ActionRowBuilder<StringSelectMenuBuilder> {
  const { ownerId = null, limite = 10 } = options;
  const customId = ownerId ? `${SELECT_CUSTOM_ID}|${ownerId}|${limite}` : SELECT_CUSTOM_ID;
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

function extraireParametres(customId: string): { ownerId: string | null; limite: number } {
  const segments = customId.split('|');
  if (segments[0] !== SELECT_CUSTOM_ID) {
    return { ownerId: null, limite: 10 };
  }

  const ownerId = segments[1] ?? null;
  const limite = segments[2] ? Number.parseInt(segments[2], 10) : 10;
  return {
    ownerId,
    limite: Number.isFinite(limite) && limite > 0 ? limite : 10,
  };
}
