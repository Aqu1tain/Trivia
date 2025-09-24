import fs from 'fs';
import path from 'path';

import { journalPrincipal } from '../utils/journalisation';

export interface GuildConfigurationSnapshot {
  channelId: string;
  heureAnnonce: number;
  minuteAnnonce: number;
  timezone?: string;
}

export type GuildConfigurationsSnapshot = Record<string, GuildConfigurationSnapshot>;

const DATA_DIRECTORY = process.env.DATA_STORE_DIR ?? path.join(process.cwd(), 'data');
const GUILDS_PATH = process.env.GUILDS_STORE_PATH ?? path.join(DATA_DIRECTORY, 'guilds.json');

let cache: GuildConfigurationsSnapshot | null = null;

function ensureDirectoryExists(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function normaliserConfiguration(value: unknown): GuildConfigurationsSnapshot {
  if (typeof value !== 'object' || value === null) {
    return {};
  }

  const resultat: GuildConfigurationsSnapshot = {};
  const brut = value as Record<string, unknown>;

  for (const [guildId, configuration] of Object.entries(brut)) {
    if (typeof configuration !== 'object' || configuration === null) {
      continue;
    }
    const brutConfiguration = configuration as Partial<GuildConfigurationSnapshot>;
    if (typeof brutConfiguration.channelId !== 'string') {
      continue;
    }
    const heure =
      typeof brutConfiguration.heureAnnonce === 'number' && Number.isFinite(brutConfiguration.heureAnnonce)
        ? Math.min(Math.max(Math.trunc(brutConfiguration.heureAnnonce), 0), 23)
        : 9;
    const minute =
      typeof brutConfiguration.minuteAnnonce === 'number' && Number.isFinite(brutConfiguration.minuteAnnonce)
        ? Math.min(Math.max(Math.trunc(brutConfiguration.minuteAnnonce), 0), 59)
        : 0;

    resultat[guildId] = {
      channelId: brutConfiguration.channelId,
      heureAnnonce: heure,
      minuteAnnonce: minute,
      timezone:
        typeof brutConfiguration.timezone === 'string' && brutConfiguration.timezone.trim().length > 0
          ? brutConfiguration.timezone
          : undefined,
    };
  }

  return resultat;
}

function loadState(): GuildConfigurationsSnapshot {
  if (cache) {
    return cache;
  }

  try {
    if (!fs.existsSync(GUILDS_PATH)) {
      cache = {};
      return cache;
    }

    const raw = fs.readFileSync(GUILDS_PATH, 'utf-8');
    cache = normaliserConfiguration(JSON.parse(raw) as unknown);
    return cache;
  } catch (erreur) {
    journalPrincipal.erreur('Impossible de charger la configuration des guildes', erreur);
    cache = {};
    return cache;
  }
}

export function lireConfigurationsGuildes(): GuildConfigurationsSnapshot {
  return { ...loadState() };
}

export function sauvegarderConfigurationsGuildes(snapshot: GuildConfigurationsSnapshot): void {
  try {
    ensureDirectoryExists(GUILDS_PATH);
    fs.writeFileSync(GUILDS_PATH, JSON.stringify(snapshot, null, 2), 'utf-8');
    cache = { ...snapshot };
  } catch (erreur) {
    journalPrincipal.erreur('Impossible de sauvegarder la configuration des guildes', erreur);
  }
}

export function reinitialiserConfigurationsGuildes(): void {
  sauvegarderConfigurationsGuildes({});
}
