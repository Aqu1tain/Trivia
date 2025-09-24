import dayjs from '../utils/date';
import {
  ActionRowBuilder,
  ButtonInteraction,
  ComponentType,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ThreadChannel,
} from 'discord.js';

import { mettreAJourAnnonceQuestions } from '../bot/scheduler';
import { obtenirConfigurationGuilde } from '../core/configuration-guildes';
import { obtenirServiceClassements, sauvegarderClassementsActuels } from '../core/classements';
import { obtenirGestionnaireQuestions } from '../core/gestionnaire-questions';
import type { NiveauQuestion, QuestionsDuJour } from '../services/questions-du-jour';
import { calculerPoints } from '../services/scoring';
import { obtenirSession } from '../services/sessions';
import type { SessionQuotidienne } from '../services/sessions';
import { journalPrincipal } from '../utils/journalisation';

interface AnalyseBouton {
  niveau: NiveauQuestion;
  cle: string;
}

const RESULTAT_TIMEOUT = 'timeout';
const RESULTAT_ECHEC = 'echec';

export async function traiterBoutonQuestion(interaction: ButtonInteraction): Promise<void> {
  const analyse = analyserCustomId(interaction.customId);
  if (!analyse) {
    await interaction.reply({ content: 'Commande invalide.', ephemeral: true });
    return;
  }

  const { niveau, cle } = analyse;
  const gestionnaire = obtenirGestionnaireQuestions();
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.reply({
      content: 'Cette commande est uniquement disponible sur un serveur Discord.',
      ephemeral: true,
    });
    return;
  }

  const session = obtenirSession(cle, guildId);
  const dateCible = dayjs(cle, 'YYYY-MM-DD').toDate();

  if (!session) {
    await interaction.reply({
      content: 'Session introuvable ou expirée. Merci de réessayer plus tard.',
      ephemeral: true,
    });
    return;
  }

  try {
    const jeu = await gestionnaire.obtenirJeuPour(dateCible);
    const etat = jeu.niveau[niveau];

    if (gestionnaire.aDejaRepondu(dateCible, niveau, interaction.user.id, guildId)) {
      await interaction.reply({
        content: `Tu as déjà tenté la question ${niveau}. Patiente jusqu’à demain !`,
        ephemeral: true,
      });
      return;
    }

    const reponse = await proposerQuestion(interaction, etat.question.question, etat.question.propositions);

    if (!reponse) {
      await gererEchec(interaction, niveau, cle, session, jeu, RESULTAT_TIMEOUT, etat.question.reponse, null);
      return;
    }

    const correcte = comparerReponse(reponse, etat.question.reponse);

    if (correcte) {
      await gererSucces(interaction, niveau, cle, session, jeu, reponse);
    } else {
      await gererEchec(interaction, niveau, cle, session, jeu, RESULTAT_ECHEC, etat.question.reponse, reponse);
    }
  } catch (erreur) {
    journalPrincipal.erreur('Erreur pendant le traitement d’une question', erreur);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content: 'Une erreur est survenue lors de la récupération de la question.',
        components: [],
      });
    } else {
      await interaction.reply({
        content: 'Une erreur est survenue lors de la récupération de la question.',
        ephemeral: true,
      });
    }
  }
}

async function proposerQuestion(
  interaction: ButtonInteraction,
  question: string,
  propositions: string[] | undefined,
): Promise<string | null> {
  const options = melanger((propositions && propositions.length > 0 ? propositions : [question]).map((option) => option.trim()));
  const select = new StringSelectMenuBuilder()
    .setCustomId(`reponse|${interaction.user.id}|${interaction.id}`)
    .setPlaceholder('Choisis la bonne réponse')
    .addOptions(
      options.map((option, index) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(option)
          .setValue(String(index)),
      ),
    );

  const message = await interaction.reply({
    ephemeral: true,
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    embeds: [creerEmbedQuestion(question, 20)],
    fetchReply: true,
  });

  try {
    const selectionPromise = message.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      time: 20_000,
      filter: (component) => component.user.id === interaction.user.id,
    });

    const timer = demarrerTimer(interaction, question, 20);
    const selection = await selectionPromise.finally(() => clearInterval(timer));

    const choix = selection.values[0];
    const texte = options[Number.parseInt(choix, 10)] ?? '';

    await selection.update({
      content: `Réponse reçue : ${texte}`,
      embeds: [],
      components: [],
    });
    return texte;
  } catch {
    if (interaction.replied) {
      await interaction.editReply({
        content: '⏱️ Temps écoulé avant sélection.',
        embeds: [],
        components: [],
      });
    }
    return null;
  }
}

async function gererSucces(
  interaction: ButtonInteraction,
  niveau: NiveauQuestion,
  cle: string,
  session: SessionQuotidienne,
  jeu: QuestionsDuJour,
  reponseChoisie: string,
): Promise<void> {
  const gestionnaire = obtenirGestionnaireQuestions();
  const serviceClassements = obtenirServiceClassements();
  const maintenant = new Date();
  const score = calculerPoints(niveau, session.creeLe, maintenant);

  gestionnaire.enregistrerParticipation(dayjs(cle, 'YYYY-MM-DD').toDate(), niveau, interaction.user.id, session.guildId, {
    reponse: reponseChoisie,
    statut: 'correct',
    reponduLe: dayjs(maintenant).toISOString(),
  });

  const configurationGuilde = obtenirConfigurationGuilde(session.guildId);
  const timezone = configurationGuilde?.timezone ?? 'Europe/Paris';

  serviceClassements.ajouterScore('quotidien', session.guildId, interaction.user.id, score.points, maintenant, timezone);
  serviceClassements.ajouterScore('hebdomadaire', session.guildId, interaction.user.id, score.points, maintenant, timezone);
  serviceClassements.ajouterScore('mensuel', session.guildId, interaction.user.id, score.points, maintenant, timezone);
  serviceClassements.ajouterScore('global', session.guildId, interaction.user.id, score.points, maintenant, timezone);
  sauvegarderClassementsActuels();
  await mettreAJourAnnonceQuestions(interaction.client, session, jeu, dayjs(cle, 'YYYY-MM-DD').toDate());

  await interaction.followUp({
    embeds: [
      creerEmbedResultat('success', niveau, score.points, {
        reponseUtilisateur: reponseChoisie,
        reponseCorrecte: jeu.niveau[niveau].question.reponse,
      }),
    ],
    ephemeral: true,
  });

  await publierDansThread(
    interaction,
    session,
    `${interaction.user.displayName ?? interaction.user.username} a bien répondu à la question ${niveau} (+${score.points} pts).`,
  );
}

async function gererEchec(
  interaction: ButtonInteraction,
  niveau: NiveauQuestion,
  cle: string,
  session: SessionQuotidienne,
  jeu: QuestionsDuJour,
  motif: typeof RESULTAT_TIMEOUT | typeof RESULTAT_ECHEC,
  reponseCorrecte?: string,
  reponseUtilisateur: string | null = null,
): Promise<void> {
  const gestionnaire = obtenirGestionnaireQuestions();
  const horodatage = dayjs().toISOString();
  gestionnaire.enregistrerParticipation(dayjs(cle, 'YYYY-MM-DD').toDate(), niveau, interaction.user.id, session.guildId, {
    reponse: reponseUtilisateur,
    statut: motif === RESULTAT_TIMEOUT ? 'timeout' : 'incorrect',
    reponduLe: horodatage,
  });
  await mettreAJourAnnonceQuestions(interaction.client, session, jeu, dayjs(cle, 'YYYY-MM-DD').toDate());

  const messageBase =
    motif === RESULTAT_TIMEOUT
      ? `⏱️ Temps écoulé avant la réponse. La bonne réponse était : ${reponseCorrecte ?? 'inconnue'}.`
      : `❌ Mauvaise réponse. La bonne réponse était : ${reponseCorrecte ?? 'inconnue'}.`;

  if (interaction.replied) {
    await interaction.editReply({
      embeds: [
        creerEmbedResultat(motif, niveau, 0, {
          message: messageBase,
          reponseUtilisateur,
          reponseCorrecte,
        }),
      ],
      components: [],
    });
  } else {
    await interaction.reply({
      embeds: [
        creerEmbedResultat(motif, niveau, 0, {
          message: messageBase,
          reponseUtilisateur,
          reponseCorrecte,
        }),
      ],
      ephemeral: true,
    });
  }

  const messageThread =
    motif === RESULTAT_TIMEOUT
      ? `${interaction.user.displayName ?? interaction.user.username} n'a pas répondu à temps pour la question ${niveau}.`
      : `${interaction.user.displayName ?? interaction.user.username} s'est trompé à la question ${niveau}.`;

  await publierDansThread(interaction, session, messageThread);
}

async function publierDansThread(
  interaction: ButtonInteraction,
  session: SessionQuotidienne,
  contenu: string,
): Promise<void> {
  try {
    const channel = await interaction.client.channels.fetch(session.threadId);
    if (!channel || !(channel instanceof ThreadChannel)) {
      throw new Error('Thread introuvable');
    }

    await channel.send(contenu);
  } catch (erreur) {
    journalPrincipal.erreur('Impossible de publier dans le thread dédié', erreur);
  }
}

function analyserCustomId(customId: string): AnalyseBouton | null {
  const [prefix, niveauBrut, cle] = customId.split('|');
  if (prefix !== 'question' || !niveauBrut || !cle) {
    return null;
  }
  if (!['facile', 'moyen', 'difficile'].includes(niveauBrut)) {
    return null;
  }
  return { niveau: niveauBrut as NiveauQuestion, cle };
}

function comparerReponse(candidate: string, attendu: string): boolean {
  return normaliserTexte(candidate) === normaliserTexte(attendu);
}

function normaliserTexte(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

function melanger<T>(elements: T[]): T[] {
  const copie = [...elements];
  for (let i = copie.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

function demarrerTimer(
  interaction: ButtonInteraction,
  question: string,
  dureeSeconds: number,
): NodeJS.Timeout {
  const debut = Date.now();

  const interval = setInterval(() => {
    const ecoule = Math.floor((Date.now() - debut) / 1000);
    const restant = Math.max(dureeSeconds - ecoule, 0);

    if (!interaction.replied) {
      return;
    }

    interaction.editReply({
      content: null,
      embeds: [creerEmbedQuestion(question, restant)],
    }).catch(() => {
      clearInterval(interval);
    });

    if (restant <= 0) {
      clearInterval(interval);
    }
  }, 1000);

  return interval;
}

function creerEmbedQuestion(question: string, secondesRestantes: number): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🧠 Question du jour')
    .setDescription(question)
    .setFooter({ text: `⏳ Temps restant : ${secondesRestantes}s` })
    .setColor(secondesRestantes <= 5 ? 0xff5555 : 0x5865f2);
}

function creerEmbedResultat(
  motif: typeof RESULTAT_TIMEOUT | typeof RESULTAT_ECHEC | 'success',
  niveau: NiveauQuestion,
  points: number,
  options: {
    message?: string;
    reponseUtilisateur?: string | null;
    reponseCorrecte?: string;
  } = {},
): EmbedBuilder {
  const { message, reponseUtilisateur, reponseCorrecte } = options;

  if (motif === 'success') {
    const embed = new EmbedBuilder()
      .setTitle('🎉 Bravo !')
      .setDescription(`Tu as réussi la question ${niveau} et gagné **${points} points**.`)
      .setColor(0x2ecc71)
      .setFooter({ text: 'Continue sur ta lancée pour grimper au classement !' });

    if (reponseUtilisateur) {
      embed.addFields({ name: 'Ta réponse', value: reponseUtilisateur });
    }
    if (reponseCorrecte) {
      embed.addFields({ name: 'Réponse correcte', value: reponseCorrecte });
    }
    return embed;
  }

  if (motif === RESULTAT_TIMEOUT) {
    const embed = new EmbedBuilder()
      .setTitle('⏳ Temps écoulé')
      .setDescription(message ?? 'Temps écoulé avant la réponse.')
      .setColor(0xf39c12)
      .setFooter({ text: 'Réessaie demain pour retenter ta chance !' });

    embed.addFields({ name: 'Ta réponse', value: reponseUtilisateur ?? 'Aucune réponse enregistrée.' });
    if (reponseCorrecte) {
      embed.addFields({ name: 'Réponse correcte', value: reponseCorrecte });
    }
    return embed;
  }

  const embed = new EmbedBuilder()
    .setTitle('💥 Mauvaise réponse')
    .setDescription(message ?? 'Ce n’était pas la bonne réponse.')
    .setColor(0xe74c3c)
    .setFooter({ text: 'Tu pourras retenter demain sur une nouvelle question.' });

  if (typeof reponseUtilisateur === 'string') {
    embed.addFields({ name: 'Ta réponse', value: reponseUtilisateur });
  }
  if (reponseCorrecte) {
    embed.addFields({ name: 'Réponse correcte', value: reponseCorrecte });
  }

  return embed;
}
