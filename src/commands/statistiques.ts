/* eslint-disable import/order */
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { obtenirServiceClassements } from '../core/classements';
import { obtenirGestionnaireQuestions } from '../core/gestionnaire-questions';
import { type TypeClassement } from '../score/classement-service';
import { type Commande } from './types';

export const commandeStatistiques: Commande = {
  definition: new SlashCommandBuilder()
    .setName('statistiques')
    .setDescription('Affiche tes points et quelques statistiques utiles.'),
  executer: async (interaction) => {
    const classements = obtenirServiceClassements();
    const gestionnaire = obtenirGestionnaireQuestions();

    const types: TypeClassement[] = ['quotidien', 'hebdomadaire', 'mensuel', 'global'];
    const scores = types.map((type) => classements.obtenirScoreUtilisateur(type, interaction.user.id)?.points ?? 0);

    const [quotidien, hebdo, mensuel, global] = scores;

    const embed = new EmbedBuilder()
      .setTitle(`📊 Statistiques de ${interaction.user.displayName ?? interaction.user.username}`)
      .addFields(
        {
          name: 'Points',
          value: `• Quotidien : **${quotidien}**
• Hebdomadaire : **${hebdo}**
• Mensuel : **${mensuel}**
• Global : **${global}**`,
          inline: false,
        },
      )
      .setColor(0x3498db)
      .setFooter({ text: 'Continue à répondre vite pour booster ton score !' });

    const aujourdHui = await gestionnaire.obtenirJeuPour(new Date());
    const participants = Object.fromEntries(
      Object.entries(aujourdHui.niveau).map(([niveau, etat]) => [niveau, etat.participants.size]),
    );

    embed.addFields({
      name: 'Participants du jour',
      value: `Facile : **${participants.facile}** | Moyen : **${participants.moyen}** | Difficile : **${participants.difficile}**`,
      inline: false,
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
