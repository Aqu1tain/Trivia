import { SlashCommandBuilder } from 'discord.js';

import { normaliserEphemere } from '../utils/interactions';

import type { Commande } from './types';

export const commandePing: Commande = {
  definition: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Répond avec le délai de réponse du bot.'),
  executer: async (interaction) => {
    await interaction.reply(
      normaliserEphemere({
        content: `🏓 Pong ! Latence : ${Math.round(interaction.client.ws.ping)} ms`,
        ephemeral: true,
      }),
    );
  },
};
