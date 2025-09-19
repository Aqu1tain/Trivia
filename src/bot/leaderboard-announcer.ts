import dayjs from 'dayjs';
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
  if (interaction.customId !== SELECT_CUSTOM_ID) {
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
    const embed = genererEmbedClassement(type);
    const menu = construireMenu(type);

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

function genererEmbedClassement(type: TypeClassement): EmbedBuilder {
  const service = obtenirServiceClassements();
  const top = service.obtenirTop(type, 10);

  const description =
    top.length > 0
      ? top.map((entree, index) => `**${index + 1}.** <@${entree.utilisateurId}> — ${entree.points} pts`).join('\n')
      : 'Aucun participant pour ce classement.';

  return new EmbedBuilder()
    .setTitle(titreComplet(type))
    .setDescription(description)
    .setColor(0x5865f2)
    .setFooter({ text: 'DailyTrivia' })
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

function construireMenu(typeActif: TypeClassement): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(SELECT_CUSTOM_ID)
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
