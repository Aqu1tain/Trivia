import dayjs from '../utils/date';

type CleQuotidienne = string;

export interface SessionQuotidienne {
  cle: CleQuotidienne;
  messageId: string;
  threadId: string;
  channelId: string;
  creeLe: string;
}

const sessions = new Map<CleQuotidienne, SessionQuotidienne>();

export function enregistrerSession(session: SessionQuotidienne): void {
  sessions.set(session.cle, session);
}

export function obtenirSession(cle: CleQuotidienne): SessionQuotidienne | undefined {
  return sessions.get(cle);
}

export function obtenirSessionPourDate(date: Date): SessionQuotidienne | undefined {
  const cle = dayjs(date).format('YYYY-MM-DD');
  return sessions.get(cle);
}

export function supprimerSession(cle: CleQuotidienne): void {
  sessions.delete(cle);
}

export function supprimerSessionPourDate(date: Date): void {
  supprimerSession(dayjs(date).format('YYYY-MM-DD'));
}

export function viderSessions(): void {
  sessions.clear();
}
