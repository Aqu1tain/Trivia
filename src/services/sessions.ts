import dayjs from '../utils/date';
import {
  lireSessionsState,
  sauvegarderSessionsState,
  resetSessionsState,
  type SessionSnapshotEntry,
} from '../storage/sessions-store';

type CleQuotidienne = string;

export interface SessionQuotidienne {
  guildId: string;
  cle: CleQuotidienne;
  messageId: string;
  threadId: string;
  channelId: string;
  creeLe: string;
}

const sessions = new Map<string, SessionQuotidienne>();

initialiserDepuisSnapshot();

export function enregistrerSession(session: SessionQuotidienne): void {
  sessions.set(construireCle(session.guildId, session.cle), session);
  persister();
}

export function obtenirSession(cle: CleQuotidienne, guildId: string): SessionQuotidienne | undefined {
  return sessions.get(construireCle(guildId, cle));
}

export function obtenirSessionPourDate(date: Date, guildId: string): SessionQuotidienne | undefined {
  const cle = dayjs(date).format('YYYY-MM-DD');
  return obtenirSession(cle, guildId);
}

export function supprimerSession(cle: CleQuotidienne, guildId: string): void {
  sessions.delete(construireCle(guildId, cle));
  persister();
}

export function supprimerSessionPourDate(date: Date, guildId: string): void {
  supprimerSession(dayjs(date).format('YYYY-MM-DD'), guildId);
}

export function viderSessions(): void {
  sessions.clear();
  resetSessionsState();
}

function construireCle(guildId: string, cle: CleQuotidienne): string {
  return `${guildId}:${cle}`;
}

function initialiserDepuisSnapshot(): void {
  const snapshot = lireSessionsState();
  for (const session of Object.values(snapshot)) {
    sessions.set(construireCle(session.guildId, session.cle), session);
  }
}

function persister(): void {
  const snapshot: Record<string, SessionSnapshotEntry> = {};
  for (const [cle, session] of sessions.entries()) {
    snapshot[cle] = { ...session };
  }
  sauvegarderSessionsState(snapshot);
}
