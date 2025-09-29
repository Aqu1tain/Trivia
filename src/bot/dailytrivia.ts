import {
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  Interaction,
  MessageFlags,
  PermissionFlagsBits,
  type Guild,
} from 'discord.js';

import { commandesDisponibles } from '../commands';
import type { Commande } from '../commands/types';
import { obtenirConfiguration } from '../config/environnement';
import { traiterBoutonQuestion } from '../interactions/question-buttons';
import { dayjs, type Dayjs } from '../utils/date';
import { journalPrincipal } from '../utils/journalisation';

import { annoncerClassementFinDeJournee, traiterSelectionClassement } from './leaderboard-announcer';
import { PlanificateurAnnonceQuotidienne, estBoutonQuestion } from './scheduler';
import { enregistrerPlanificateur } from './scheduler-registry';

export type RegistreCommandes = Collection<string, Commande>;

function construireRegistre(): RegistreCommandes {
  const registre = new Collection<string, Commande>();
  for (const commande of commandesDisponibles) {
    registre.set(commande.definition.name, commande);
  }
  return registre;
}

function estInteractionCommande(interaction: Interaction): interaction is ChatInputCommandInteraction {
  return interaction.isChatInputCommand();
}

let planificateur: PlanificateurAnnonceQuotidienne | null = null;
let timerFinDeJournee: NodeJS.Timeout | null = null;

export function creerClient(): Client {
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
  const registre = construireRegistre();

  client.once(Events.ClientReady, (pret) => {
    journalPrincipal.info(`Connecté en tant que ${pret.user.tag}`);
    if (!planificateur) {
      planificateur = new PlanificateurAnnonceQuotidienne(client);
      planificateur.demarrer();
    }
    enregistrerPlanificateur(planificateur);
    demarrerPlanificationFinDeJournee(client);
  });

  client.on(Events.InteractionCreate, (interaction) => {
    void gererInteraction(interaction, registre);
  });

  client.on(Events.GuildCreate, (guild) => {
    void notifierArriveeSurGuilde(guild);
  });

  return client;
}

async function notifierArriveeSurGuilde(guild: Guild): Promise<void> {
  journalPrincipal.info('Nouveau serveur rejoint', {
    guildId: guild.id,
    nom: guild.name,
  });

  const membre = guild.members.me;
  const cible =
    guild.systemChannel ??
    guild.channels.cache
      .filter((channel) => {
        if (channel.type !== ChannelType.GuildText) {
          return false;
        }
        if (!membre) {
          return true;
        }
        const permissions = channel.permissionsFor(membre);
        return permissions ? permissions.has(PermissionFlagsBits.SendMessages) : false;
      })
      .first();

  if (cible && cible.isTextBased()) {
    await cible
      .send(
        'Merci de m’avoir ajouté ! Utilise la commande `/config` pour choisir le salon de publication et l’heure française souhaitée.',
      )
      .catch(() => {
        /* noop */
      });
  }
}

async function executerCommande(
  commande: Commande,
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  try {
    await commande.executer(interaction);
  } catch (erreur) {
    journalPrincipal.erreur(`Échec de la commande ${interaction.commandName}`, erreur);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: 'Une erreur est survenue.' });
    } else {
      await interaction.reply({ content: 'Une erreur est survenue.', flags: MessageFlags.Ephemeral });
    }
  }
}

async function gererInteraction(interaction: Interaction, registre: RegistreCommandes): Promise<void> {
  if (interaction.isButton()) {
    if (estBoutonQuestion(interaction.customId)) {
      await traiterBoutonQuestion(interaction);
      return;
    }
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('lb-select')) {
    await traiterSelectionClassement(interaction);
    return;
  }

  if (!estInteractionCommande(interaction)) {
    return;
  }

  const commande = registre.get(interaction.commandName);
  if (!commande) {
    await interaction.reply({ content: 'Commande inconnue.', flags: MessageFlags.Ephemeral });
    return;
  }

  await executerCommande(commande, interaction);
}

function demarrerPlanificationFinDeJournee(client: Client): void {
  if (timerFinDeJournee) {
    clearTimeout(timerFinDeJournee);
  }

  const maintenant: Dayjs = dayjs();
  let prochain: Dayjs = maintenant.hour(23).minute(59).second(59).millisecond(0);
  if (!prochain.isAfter(maintenant)) {
    prochain = prochain.add(1, 'day');
  }

  const delai = Math.max(prochain.diff(maintenant), 1);
  timerFinDeJournee = setTimeout(() => {
    void annoncerClassementFinDeJournee(client).finally(() => {
      demarrerPlanificationFinDeJournee(client);
    });
  }, delai);
}

export async function demarrerBot(): Promise<void> {
  const config = obtenirConfiguration();
  const client = creerClient();
  await client.login(config.jetonDiscord);
}

if (require.main === module) {
  demarrerBot().catch((erreur) => {
    journalPrincipal.erreur('Le bot ne parvient pas à démarrer', erreur);
    process.exitCode = 1;
  });
}
