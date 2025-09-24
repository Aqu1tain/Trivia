import dayjs from '../utils/date';
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

import { obtenirConfiguration } from '../config/environnement';
import { obtenirGestionnaireQuestions } from '../core/gestionnaire-questions';
import type { QuestionsDuJour } from '../services/questions-du-jour';
import { NIVEAUX_QUESTIONS } from '../services/questions-du-jour';
import {
  enregistrerSession,
  obtenirSessionPourDate,
  supprimerSessionPourDate,
  type SessionQuotidienne,
} from '../services/sessions';
import { journalPrincipal } from '../utils/journalisation';

const PREFIX_CUSTOM_ID = 'question';

export class PlanificateurAnnonceQuotidienne {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly client: Client) {}

  public demarrer(): void {
    this.planifierProchainCycle();
  }

  public arreter(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private planifierProchainCycle(): void {
    const delai = this.calculerDelaiMs();
    this.timer = setTimeout(() => {
      void this.executerCycle()
        .catch((erreur) => {
          journalPrincipal.erreur('Échec lors de la diffusion quotidienne', erreur);
        })
        .finally(() => {
          this.planifierProchainCycle();
        });
    }, delai);
  }

  private calculerDelaiMs(): number {
    if (this.doiventPublierImmediatement()) {
      return 10;
    }

    const config = obtenirConfiguration();
    const maintenant = dayjs();
    let prochain = maintenant
      .hour(config.heureAnnonceQuotidienne)
      .minute(config.minuteAnnonceQuotidienne)
      .second(0)
      .millisecond(0);

    if (!prochain.isAfter(maintenant)) {
      prochain = prochain.add(1, 'day');
    }

    const diff = Math.max(prochain.diff(maintenant), 1);
    return diff;
  }

  private doiventPublierImmediatement(): boolean {
    const sessionExistante = obtenirSessionPourDate(new Date());
    if (sessionExistante) {
      return false;
    }

    const config = obtenirConfiguration();
    const maintenant = dayjs();
    const horaireJour = maintenant
      .hour(config.heureAnnonceQuotidienne)
      .minute(config.minuteAnnonceQuotidienne)
      .second(0)
      .millisecond(0);

    return maintenant.isAfter(horaireJour);
  }

  private async executerCycle(): Promise<void> {
    await publierAnnonceQuotidienne(this.client);
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
  date: Date = new Date(),
  options: { questions?: QuestionsDuJour; force?: boolean } = {},
): Promise<void> {
  const { questions, force = false } = options;
  const config = obtenirConfiguration();
  const sessionExistante = obtenirSessionPourDate(date);
  const cle = dayjs(date).format('YYYY-MM-DD');

  if (sessionExistante && !force) {
    journalPrincipal.info('Annonce déjà publiée pour cette journée, aucune action.', {
      cle,
    });
    return;
  }

  const channel = await client.channels.fetch(config.identifiantSalonQuestions);
  if (!channel || !(channel instanceof TextChannel)) {
    journalPrincipal.erreur('Salon de questions introuvable ou de type incompatible', {
      channelId: config.identifiantSalonQuestions,
      type: channel?.type,
    });
    return;
  }

  if (force && sessionExistante) {
    await supprimerAnnonceExistante(client, sessionExistante);
    supprimerSessionPourDate(date);
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

  const embed = creerEmbedAnnonce(jeu, date);

  const message = await channel.send({
    embeds: [embed],
    components: [composant],
  });

  const thread = await message.startThread({
    name: `Réponses ${jeu.cle}`,
    autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
  });

  enregistrerSession({
    cle: jeu.cle,
    messageId: message.id,
    threadId: thread.id,
    channelId: channel.id,
    creeLe: message.createdAt.toISOString(),
  });

  journalPrincipal.info('Annonce quotidienne publiée', {
    cle: jeu.cle,
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
    await message.edit({ embeds: [creerEmbedAnnonce(questions, date)] });
  } catch (erreur) {
    journalPrincipal.erreur("Impossible d'actualiser l'annonce quotidienne", erreur);
  }
}

function creerEmbedAnnonce(questions: QuestionsDuJour, date: Date): APIEmbed {
  const participantsFacile = questions.niveau.facile.participants.size;
  const participantsMoyen = questions.niveau.moyen.participants.size;
  const participantsDifficile = questions.niveau.difficile.participants.size;

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
