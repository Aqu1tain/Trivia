import { config as chargerVariables } from 'dotenv';

export type FournisseurQuestions = 'quizzapi' | 'opentdb';

export interface Configuration {
  jetonDiscord: string;
  urlApiQuizz: string;
  urlApiOpenTdb: string;
  fournisseurQuestions: FournisseurQuestions;
  deeplApiKey: string;
  heureAnnonceDefaut: number;
  minuteAnnonceDefaut: number;
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
  const urlApiQuizz = process.env.QUIZZ_API_URL ?? 'https://quizzapi.jomoreschi.fr/api/v1/';
  const urlApiOpenTdb = process.env.OPENTDB_API_URL ?? 'https://opentdb.com';
  const fournisseurQuestions = normaliserFournisseur(process.env.TRIVIA_PROVIDER);
  const deeplApiKey = process.env.DEEPL_API_KEY ?? '';
  const heureAnnonceQuotidienne = Number.parseInt(process.env.DAILY_TRIGGER_HOUR ?? '9', 10);
  const minuteAnnonceQuotidienne = Number.parseInt(process.env.DAILY_TRIGGER_MINUTE ?? '0', 10);

  if (!jetonDiscord) {
    throw new Error('Variable d’environnement DISCORD_TOKEN manquante.');
  }

  if (fournisseurQuestions === 'opentdb' && !deeplApiKey) {
    throw new Error(
      'Variable d’environnement DEEPL_API_KEY manquante pour l’utilisation de OpenTDB.',
    );
  }

  configurationMemo = {
    jetonDiscord,
    urlApiQuizz,
    urlApiOpenTdb,
    fournisseurQuestions,
    deeplApiKey,
    heureAnnonceDefaut: clampNombre(heureAnnonceQuotidienne, 0, 23, 9),
    minuteAnnonceDefaut: clampNombre(minuteAnnonceQuotidienne, 0, 59, 0),
  };

  return configurationMemo;
}

function clampNombre(valeur: number, min: number, max: number, fallback: number): number {
  if (Number.isNaN(valeur)) {
    return fallback;
  }
  return Math.min(Math.max(valeur, min), max);
}

function normaliserFournisseur(valeur?: string): FournisseurQuestions {
  if (!valeur) {
    return 'opentdb';
  }

  const normalisee = valeur.trim().toLowerCase();
  if (normalisee === 'quizzapi') {
    return 'quizzapi';
  }

  return 'opentdb';
}
