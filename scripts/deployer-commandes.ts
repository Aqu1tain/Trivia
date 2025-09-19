import { REST, Routes } from 'discord.js';

import { commandesDisponibles } from '../src/commands';
import { obtenirConfiguration } from '../src/config/environnement';
import { journalPrincipal } from '../src/utils/journalisation';

async function deployer(): Promise<void> {
  const config = obtenirConfiguration();
  const identifiantClient = process.env.DISCORD_CLIENT_ID;

  if (!identifiantClient) {
    throw new Error('DISCORD_CLIENT_ID manquant dans l’environnement.');
  }

  const rest = new REST({ version: '10' }).setToken(config.jetonDiscord);
  const commandes = commandesDisponibles.map((commande) => commande.definition.toJSON());

  journalPrincipal.info(
    'Déploiement des commandes...',
    commandes.map((cmd: any) => cmd.name),
  );

  await rest.put(Routes.applicationGuildCommands(identifiantClient, config.identifiantGuild), {
    body: commandes,
  });

  journalPrincipal.info('Commandes mises à jour avec succès.');
}

deployer().catch((erreur) => {
  journalPrincipal.erreur('Échec du déploiement des commandes.', erreur);
  process.exitCode = 1;
});
