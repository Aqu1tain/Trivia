import dayjs from '../utils/date';

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

export function enregistrerSession(session: SessionQuotidienne): void {
  sessions.set(construireCle(session.guildId, session.cle), session);
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
}

export function supprimerSessionPourDate(date: Date, guildId: string): void {
  supprimerSession(dayjs(date).format('YYYY-MM-DD'), guildId);
}

export function viderSessions(): void {
  sessions.clear();
}

function construireCle(guildId: string, cle: CleQuotidienne): string {
  return `${guildId}:${cle}`;
}
