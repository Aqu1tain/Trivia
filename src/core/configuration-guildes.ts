import dayjs from '../utils/date';
import {
  lireConfigurationsGuildes,
  sauvegarderConfigurationsGuildes,
  type GuildConfigurationSnapshot,
  type GuildConfigurationsSnapshot,
} from '../storage/guilds';

export interface ConfigurationGuilde {
  guildId: string;
  channelId: string;
  heureAnnonce: number;
  minuteAnnonce: number;
  timezone: string;
  creeLe: string;
  misAJourLe: string;
}

const FUSEAU_DEFAUT = 'Europe/Paris';

let cache: Map<string, ConfigurationGuilde> | null = null;

function chargerCache(): Map<string, ConfigurationGuilde> {
  if (cache) {
    return cache;
  }
  const snapshot = lireConfigurationsGuildes();
  cache = new Map();
  for (const [guildId, configuration] of Object.entries(snapshot)) {
    cache.set(guildId, normaliserConfiguration(guildId, configuration));
  }
  return cache;
}

function normaliserConfiguration(
  guildId: string,
  snapshot: GuildConfigurationSnapshot,
  dates?: { creeLe?: string; misAJourLe?: string },
): ConfigurationGuilde {
  const heure = clamp(snapshot.heureAnnonce ?? 9, 0, 23, 9);
  const minute = clamp(snapshot.minuteAnnonce ?? 0, 0, 59, 0);
  const maintenant = dayjs();

  return {
    guildId,
    channelId: snapshot.channelId,
    heureAnnonce: heure,
    minuteAnnonce: minute,
    timezone: snapshot.timezone ?? FUSEAU_DEFAUT,
    creeLe: dates?.creeLe ?? maintenant.toISOString(),
    misAJourLe: dates?.misAJourLe ?? maintenant.toISOString(),
  };
}

export function listerConfigurationsGuildes(): ConfigurationGuilde[] {
  return Array.from(chargerCache().values());
}

export function obtenirConfigurationGuilde(guildId: string): ConfigurationGuilde | undefined {
  return chargerCache().get(guildId);
}

export function definirConfigurationGuilde(
  guildId: string,
  configuration: {
    channelId: string;
    heureAnnonce: number;
    minuteAnnonce?: number;
    timezone?: string;
  },
): ConfigurationGuilde {
  const heure = clamp(configuration.heureAnnonce, 0, 23, 9);
  const minute = clamp(configuration.minuteAnnonce ?? 0, 0, 59, 0);
  const timezone = configuration.timezone?.trim() || FUSEAU_DEFAUT;
  const maintenant = dayjs();

  const existante = chargerCache().get(guildId);
  const normalisee = {
    guildId,
    channelId: configuration.channelId,
    heureAnnonce: heure,
    minuteAnnonce: minute,
    timezone,
    creeLe: existante?.creeLe ?? maintenant.toISOString(),
    misAJourLe: maintenant.toISOString(),
  } satisfies ConfigurationGuilde;

  chargerCache().set(guildId, normalisee);
  persister();
  return normalisee;
}

export function supprimerConfigurationGuilde(guildId: string): void {
  const cacheActuel = chargerCache();
  if (!cacheActuel.has(guildId)) {
    return;
  }
  cacheActuel.delete(guildId);
  persister();
}

function persister(): void {
  if (!cache) {
    return;
  }
  const snapshot: GuildConfigurationsSnapshot = {};
  for (const [guildId, configuration] of cache.entries()) {
    snapshot[guildId] = {
      channelId: configuration.channelId,
      heureAnnonce: configuration.heureAnnonce,
      minuteAnnonce: configuration.minuteAnnonce,
      timezone: configuration.timezone,
    };
  }
  sauvegarderConfigurationsGuildes(snapshot);
}

function clamp(valeur: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(valeur)) {
    return fallback;
  }
  return Math.min(Math.max(Math.trunc(valeur), min), max);
}
