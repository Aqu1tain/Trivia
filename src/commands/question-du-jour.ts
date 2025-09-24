import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

import { obtenirGestionnaireQuestions } from '../core/gestionnaire-questions';
import { NIVEAUX_QUESTIONS, type StatutParticipation } from '../services/questions-du-jour';
import dayjs from '../utils/date';
import { journalPrincipal } from '../utils/journalisation';

import type { Commande } from './types';

export const commandeQuestionDuJour: Commande = {
  definition: new SlashCommandBuilder()
    .setName('question-du-jour')
    .setDescription('Affiche la question quotidienne actuelle (facile, moyen, difficile).'),
  executer: async (interaction) => {
    try {
      await interaction.deferReply({ ephemeral: true });

      const gestionnaire = obtenirGestionnaireQuestions();
      const jeu = await gestionnaire.obtenirJeuPour(new Date());

      const participations = NIVEAUX_QUESTIONS.map((niveau) => ({
        niveau,
        participation: jeu.niveau[niveau].participants.get(interaction.user.id),
      }));

      const toutComplete = participations.every((entree) => entree.participation !== undefined);
      if (!toutComplete) {
        await interaction.editReply({
          content: 'Tu dois répondre aux trois questions du jour avant de consulter le récapitulatif.',
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🎯 Bilan des questions du jour')
        .setDescription("Voici tes réponses face aux questions du jour.")
        .setColor(0x5865f2)
        .setFooter({ text: `Questions générées le ${dayjs(jeu.genereLe).format('DD/MM/YYYY à HH:mm')}` });

      for (const { niveau, participation } of participations) {
        if (!participation) {
          continue;
        }
        const question = jeu.niveau[niveau].question;
        const titre = niveau.charAt(0).toUpperCase() + niveau.slice(1);
        const statutEmoji = emojiStatut(participation.statut);
        const reponseUtilisateur = participation.reponse ?? 'Aucune réponse';

        embed.addFields({
          name: `${emojiPourNiveau(niveau)} ${titre}`,
          value: `${question.question}\n${statutEmoji} Ta réponse : ${reponseUtilisateur}\n✔️ Réponse correcte : ${question.reponse}`,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (erreur) {
      journalPrincipal.erreur('Erreur lors de la commande question-du-jour', erreur);
      await interaction.editReply({
        content: 'Impossible de récupérer les questions. Merci de réessayer plus tard.',
      });
    }
  },
};

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

function emojiStatut(statut: StatutParticipation): string {
  switch (statut) {
    case 'correct':
      return '✅';
    case 'incorrect':
      return '❌';
    case 'timeout':
      return '⏳';
    default:
      return '❔';
  }
}
