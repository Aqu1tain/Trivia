import dayjs, { dayjsDansFuseau } from '../utils/date';
import type { APIEmbed } from 'discord.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  TextChannel,
  ThreadAutoArchiveDuration,
  ThreadChannel,
} from 'discord.js';

import type { ConfigurationGuilde } from '../core/configuration-guildes';
import { listerConfigurationsGuildes } from '../core/configuration-guildes';
import { obtenirGestionnaireQuestions } from '../core/gestionnaire-questions';
import type { QuestionsDuJour } from '../services/questions-du-jour';
import { CLE_GUILDE_LEGACY, NIVEAUX_QUESTIONS } from '../services/questions-du-jour';
import type { ParticipationQuestion } from '../services/questions-du-jour';
import {
  enregistrerSession,
  obtenirSessionPourDate,
  supprimerSessionPourDate,
  type SessionQuotidienne,
} from '../services/sessions';
import { journalPrincipal } from '../utils/journalisation';

const PREFIX_CUSTOM_ID = 'question';

export class PlanificateurAnnonceQuotidienne {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly client: Client) {}

  public demarrer(): void {
    this.mettreAJourPlanifications();
  }

  public rafraichir(): void {
    this.mettreAJourPlanifications();
  }

  public arreter(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  private mettreAJourPlanifications(): void {
    this.arreter();
    const configurations = listerConfigurationsGuildes();
    if (configurations.length === 0) {
      return;
    }
    for (const configuration of configurations) {
      this.planifierPourGuilde(configuration);
    }
  }

  private planifierPourGuilde(configuration: ConfigurationGuilde): void {
    const delai = this.calculerDelaiMs(configuration);
    const timer = setTimeout(() => {
      void this.executerCycle(configuration)
        .catch((erreur) => {
          journalPrincipal.erreur('Échec lors de la diffusion quotidienne', erreur, {
            guildId: configuration.guildId,
          });
        })
        .finally(() => {
          this.planifierPourGuilde(configuration);
        });
    }, delai);
    this.timers.set(configuration.guildId, timer);
  }

  private calculerDelaiMs(configuration: ConfigurationGuilde): number {
    const maintenant = dayjsDansFuseau(new Date(), configuration.timezone);
    const sessionExistante = obtenirSessionPourDate(new Date(), configuration.guildId);

    const cibleDuJour = maintenant
      .hour(configuration.heureAnnonce)
      .minute(configuration.minuteAnnonce)
      .second(0)
      .millisecond(0);

    if (!sessionExistante && !cibleDuJour.isAfter(maintenant)) {
      return 10;
    }

    const prochain = cibleDuJour.isAfter(maintenant) ? cibleDuJour : cibleDuJour.add(1, 'day');
    return Math.max(prochain.diff(maintenant), 1);
  }

  private async executerCycle(configuration: ConfigurationGuilde): Promise<void> {
    await publierAnnonceQuotidienne(this.client, configuration);
  }
}

export function estBoutonQuestion(customId: string): boolean {
  return customId.startsWith(`${PREFIX_CUSTOM_ID}|`);
}

export function decomposerCustomId(customId: string): { prefix: string; niveau: string; cle: string } {
  const [prefix, niveau, cle] = customId.split('|');
  return { prefix, niveau, cle };
}

export async function publierAnnonceQuotidienne(
  client: Client,
  configuration: ConfigurationGuilde,
  date: Date = new Date(),
  options: { questions?: QuestionsDuJour; force?: boolean } = {},
): Promise<void> {
  const { questions, force = false } = options;
  const sessionExistante = obtenirSessionPourDate(date, configuration.guildId);
  const cle = dayjs(date).format('YYYY-MM-DD');

  if (sessionExistante && !force) {
    journalPrincipal.info('Annonce déjà publiée pour cette journée, aucune action.', {
      cle,
      guildId: configuration.guildId,
    });
    return;
  }

  const channel = await client.channels.fetch(configuration.channelId);
  if (!channel || !(channel instanceof TextChannel)) {
    journalPrincipal.erreur('Salon de questions introuvable ou de type incompatible', {
      guildId: configuration.guildId,
      channelId: configuration.channelId,
      type: channel?.type,
    });
    return;
  }

  if (force && sessionExistante) {
    await supprimerAnnonceExistante(client, sessionExistante);
    supprimerSessionPourDate(date, configuration.guildId);
  }

  const gestionnaire = obtenirGestionnaireQuestions();
  const jeu = questions ?? (await gestionnaire.obtenirJeuPour(date));

  const composant = new ActionRowBuilder<ButtonBuilder>().addComponents(
    NIVEAUX_QUESTIONS.map((niveau) =>
      new ButtonBuilder()
        .setCustomId(`${PREFIX_CUSTOM_ID}|${niveau}|${jeu.cle}`)
        .setLabel(`${emojiPourNiveau(niveau)} ${titreNiveau(niveau)}`)
        .setStyle(ButtonStyle.Primary),
    ),
  );

  const embed = creerEmbedAnnonce(jeu, date, configuration.guildId);

  const message = await channel.send({
    embeds: [embed],
    components: [composant],
  });

  const thread = await message.startThread({
    name: `Réponses ${jeu.cle}`,
    autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
  });

  enregistrerSession({
    guildId: configuration.guildId,
    cle: jeu.cle,
    messageId: message.id,
    threadId: thread.id,
    channelId: channel.id,
    creeLe: message.createdAt.toISOString(),
  });

  journalPrincipal.info('Annonce quotidienne publiée', {
    cle: jeu.cle,
    guildId: configuration.guildId,
    channelId: channel.id,
    messageId: message.id,
    threadId: thread.id,
  });
}

export async function mettreAJourAnnonceQuestions(
  client: Client,
  session: SessionQuotidienne,
  questions: QuestionsDuJour,
  date: Date = new Date(),
): Promise<void> {
  try {
    const canal = await client.channels.fetch(session.channelId);
    if (!canal || !(canal instanceof TextChannel)) {
      return;
    }

    const message = await canal.messages.fetch(session.messageId);
    await message.edit({ embeds: [creerEmbedAnnonce(questions, date, session.guildId)] });
  } catch (erreur) {
    journalPrincipal.erreur("Impossible d'actualiser l'annonce quotidienne", erreur);
  }
}

function creerEmbedAnnonce(questions: QuestionsDuJour, date: Date, guildId: string): APIEmbed {
  const participantsFacile = compterParticipants(questions.niveau.facile.participants, guildId);
  const participantsMoyen = compterParticipants(questions.niveau.moyen.participants, guildId);
  const participantsDifficile = compterParticipants(questions.niveau.difficile.participants, guildId);

  const fields: APIEmbed['fields'] = [
    {
      name: `${emojiPourNiveau('facile')} ${titreNiveau('facile')}`,
      value: `Participants : **${participantsFacile}**\nPoints bonus : **${pointsPotentiels('facile')}**`,
      inline: true,
    },
    {
      name: `${emojiPourNiveau('moyen')} ${titreNiveau('moyen')}`,
      value: `Participants : **${participantsMoyen}**\nPoints bonus : **${pointsPotentiels('moyen')}**`,
      inline: true,
    },
    {
      name: `${emojiPourNiveau('difficile')} ${titreNiveau('difficile')}`,
      value: `Participants : **${participantsDifficile}**\nPoints bonus : **${pointsPotentiels('difficile')}**`,
      inline: true,
    },
  ];

  return {
    title: '🗓️ Les questions du jour sont prêtes !',
    description:
      "Sélectionne un niveau pour révéler ta question. Réponds correctement le plus vite possible pour gagner un max de points !",
    fields,
    color: 0xf1c40f,
    footer: { text: `Session du ${dayjs(date).format('DD/MM/YYYY')}` },
  };
}

function compterParticipants(
  participantsParGuilde: Map<string, Map<string, ParticipationQuestion>>,
  guildId: string,
): number {
  return (
    participantsParGuilde.get(guildId)?.size ?? participantsParGuilde.get(CLE_GUILDE_LEGACY)?.size ?? 0
  );
}

function emojiPourNiveau(niveau: string): string {
  switch (niveau) {
    case 'facile':
      return '🟢';
    case 'moyen':
      return '🟡';
    case 'difficile':
      return '🔴';
    default:
      return '❓';
  }
}

function titreNiveau(niveau: string): string {
  return niveau.charAt(0).toUpperCase() + niveau.slice(1);
}

function pointsPotentiels(niveau: string): string {
  switch (niveau) {
    case 'facile':
      return '≈ 50';
    case 'moyen':
      return '≈ 100';
    case 'difficile':
      return '≈ 150';
    default:
      return '?';
  }
}

async function supprimerAnnonceExistante(client: Client, session: SessionQuotidienne): Promise<void> {
  try {
    const channel = await client.channels.fetch(session.channelId);
    if (channel && channel instanceof TextChannel) {
      await channel.messages.delete(session.messageId).catch(async () => {
        const message = await channel.messages.fetch(session.messageId).catch(() => null);
        if (message) {
          await message.delete().catch(() => {
            /* noop */
          });
        }
      });
    }

    const thread = await client.channels.fetch(session.threadId).catch(() => null);
    if (thread && thread instanceof ThreadChannel) {
      await thread.delete().catch(async () => {
        await thread.setArchived(true).catch(() => {
          /* noop */
        });
      });
    }
  } catch (erreur) {
    journalPrincipal.erreur('Impossible de supprimer l’ancienne annonce quotidienne', erreur);
  }
}
