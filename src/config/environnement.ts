import { config as chargerVariables } from 'dotenv';

export interface Configuration {
  jetonDiscord: string;
  identifiantGuild: string;
  identifiantSalonQuestions: string;
  urlApiQuizz: string;
  heureAnnonceQuotidienne: number;
  minuteAnnonceQuotidienne: number;
}

let configurationMemo: Configuration | null = null;

/**
 * Charge les variables d’environnement nécessaires au fonctionnement du bot.
 */
export function obtenirConfiguration(): Configuration {
  if (configurationMemo) {
    return configurationMemo;
  }

  chargerVariables();

  const jetonDiscord = process.env.DISCORD_TOKEN ?? '';
  const identifiantGuild = process.env.DISCORD_GUILD_ID ?? '';
  const identifiantSalonQuestions = process.env.DISCORD_CHANNEL_ID ?? '';
  const urlApiQuizz = process.env.QUIZZ_API_URL ?? 'https://quizzapi.jomoreschi.fr/api/v1/';
  const heureAnnonceQuotidienne = Number.parseInt(process.env.DAILY_TRIGGER_HOUR ?? '9', 10);
  const minuteAnnonceQuotidienne = Number.parseInt(process.env.DAILY_TRIGGER_MINUTE ?? '0', 10);

  if (!jetonDiscord || !identifiantGuild || !identifiantSalonQuestions) {
    throw new Error(
      'Variables d’environnement manquantes: merci de renseigner DISCORD_TOKEN, DISCORD_GUILD_ID et DISCORD_CHANNEL_ID.',
    );
  }

  configurationMemo = {
    jetonDiscord,
    identifiantGuild,
    identifiantSalonQuestions,
    urlApiQuizz,
    heureAnnonceQuotidienne: clampNombre(heureAnnonceQuotidienne, 0, 23, 9),
    minuteAnnonceQuotidienne: clampNombre(minuteAnnonceQuotidienne, 0, 59, 0),
  };

  return configurationMemo;
}

function clampNombre(valeur: number, min: number, max: number, fallback: number): number {
  if (Number.isNaN(valeur)) {
    return fallback;
  }
  return Math.min(Math.max(valeur, min), max);
}
