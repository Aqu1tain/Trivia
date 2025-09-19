import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

import { obtenirGestionnaireQuestions } from '../core/gestionnaire-questions';
import { NIVEAUX_QUESTIONS } from '../services/questions-du-jour';
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

      const embed = new EmbedBuilder()
        .setTitle('🎯 Questions du jour')
        .setDescription(
          NIVEAUX_QUESTIONS.map((niveau) => {
            const question = jeu.niveau[niveau].question;
            const titre = niveau.charAt(0).toUpperCase() + niveau.slice(1);
            return `**${emojiPourNiveau(niveau)} ${titre}**\n${question.question}`;
          }).join('\n\n'),
        )
        .setFooter({ text: `Questions générées le ${new Date(jeu.genereLe).toLocaleDateString('fr-FR')}` })
        .setColor(0x5865f2);

      await interaction.editReply({
        embeds: [embed],
      });
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
