import fs from 'fs';
import path from 'path';

import { journalPrincipal } from '../utils/journalisation';

const DATA_DIRECTORY = process.env.DATA_STORE_DIR ?? path.join(process.cwd(), 'data');
const SESSIONS_PATH = process.env.SESSIONS_STORE_PATH ?? path.join(DATA_DIRECTORY, 'sessions.json');

export interface SessionSnapshotEntry {
  guildId: string;
  cle: string;
  messageId: string;
  threadId: string;
  channelId: string;
  creeLe: string;
}

export type SessionsSnapshot = Record<string, SessionSnapshotEntry>;

function ensureDirectoryExists(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function normaliserSession(valeur: unknown): SessionSnapshotEntry | null {
  if (typeof valeur !== 'object' || valeur === null) {
    return null;
  }

  const brut = valeur as Partial<SessionSnapshotEntry>;
  if (
    typeof brut.guildId !== 'string' ||
    typeof brut.cle !== 'string' ||
    typeof brut.messageId !== 'string' ||
    typeof brut.threadId !== 'string' ||
    typeof brut.channelId !== 'string' ||
    typeof brut.creeLe !== 'string'
  ) {
    return null;
  }

  return {
    guildId: brut.guildId,
    cle: brut.cle,
    messageId: brut.messageId,
    threadId: brut.threadId,
    channelId: brut.channelId,
    creeLe: brut.creeLe,
  };
}

function normaliserSessions(valeur: unknown): SessionsSnapshot {
  if (typeof valeur !== 'object' || valeur === null) {
    return {};
  }

  const resultat: SessionsSnapshot = {};
  const brut = valeur as Record<string, unknown>;
  for (const [cle, entree] of Object.entries(brut)) {
    const normalisee = normaliserSession(entree);
    if (normalisee) {
      resultat[cle] = normalisee;
    }
  }

  return resultat;
}

function cloneSnapshot(snapshot: SessionsSnapshot): SessionsSnapshot {
  const clone: SessionsSnapshot = {};
  for (const [cle, valeur] of Object.entries(snapshot)) {
    clone[cle] = { ...valeur };
  }
  return clone;
}

let cache: SessionsSnapshot | null = null;

function loadState(): SessionsSnapshot {
  if (cache) {
    return cache;
  }

  try {
    if (!fs.existsSync(SESSIONS_PATH)) {
      cache = {};
      return cache;
    }

    const raw = fs.readFileSync(SESSIONS_PATH, 'utf-8');
    cache = normaliserSessions(JSON.parse(raw) as unknown);
    return cache;
  } catch (erreur) {
    journalPrincipal.erreur('Impossible de charger les sessions depuis le disque', erreur);
    cache = {};
    return cache;
  }
}

export function lireSessionsState(): SessionsSnapshot {
  return cloneSnapshot(loadState());
}

export function sauvegarderSessionsState(snapshot: SessionsSnapshot): void {
  try {
    ensureDirectoryExists(SESSIONS_PATH);
    fs.writeFileSync(SESSIONS_PATH, JSON.stringify(snapshot, null, 2), 'utf-8');
    cache = cloneSnapshot(snapshot);
  } catch (erreur) {
    journalPrincipal.erreur('Impossible de sauvegarder les sessions sur le disque', erreur);
  }
}

export function resetSessionsState(): void {
  sauvegarderSessionsState({});
}
