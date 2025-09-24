import { config as chargerEnv } from 'dotenv';
import { REST, Routes } from 'discord.js';

import { journalPrincipal } from '../src/utils/journalisation';

chargerEnv();

function extraireGuildIds(): string[] {
  const ids = new Set<string>();

  const principal = process.env.DISCORD_GUILD_ID ?? '';
  for (const id of principal.split(/[,\s]+/)) {
    if (id.trim().length > 0) {
      ids.add(id.trim());
    }
  }

  const supplementaires = process.env.EXTRA_GUILD_IDS ?? '';
  for (const id of supplementaires.split(/[,\s]+/)) {
    if (id.trim().length > 0) {
      ids.add(id.trim());
    }
  }

  return Array.from(ids);
}

async function supprimerCommandesGuildes(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token || !clientId) {
    throw new Error('DISCORD_TOKEN et DISCORD_CLIENT_ID doivent être définies dans le fichier .env.');
  }

  const guildIds = extraireGuildIds();
  if (guildIds.length === 0) {
    journalPrincipal.info('Aucun identifiant de guilde détecté. Renseigne DISCORD_GUILD_ID ou EXTRA_GUILD_IDS.');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);

  for (const guildId of guildIds) {
    try {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
      journalPrincipal.info('Commandes de guilde supprimées', { guildId });
    } catch (erreur) {
      journalPrincipal.erreur("Impossible de supprimer les commandes d'une guilde", { guildId, erreur });
    }
  }
}

supprimerCommandesGuildes().catch((erreur) => {
  journalPrincipal.erreur('Échec du nettoyage des commandes de guilde', erreur);
  process.exitCode = 1;
});
