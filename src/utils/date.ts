import type { ConfigType, Dayjs } from 'dayjs';
import dayjsLib from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isoWeek from 'dayjs/plugin/isoWeek';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

export const FUSEAU_PARIS = 'Europe/Paris';

dayjsLib.extend(utc);
dayjsLib.extend(customParseFormat);
dayjsLib.extend(timezone);
dayjsLib.extend(isoWeek);

dayjsLib.tz.setDefault(FUSEAU_PARIS);

/**
 * Retourne un objet Dayjs normalisé sur le fuseau horaire de Paris.
 */
export function dayjs(): Dayjs;
export function dayjs(date: ConfigType, format?: string): Dayjs;
export function dayjs(date?: ConfigType, format?: string): Dayjs {
  if (typeof date === 'undefined') {
    return dayjsLib.tz(new Date(), FUSEAU_PARIS);
  }
  if (typeof format === 'string') {
    return dayjsLib.tz(date, format, FUSEAU_PARIS);
  }
  return dayjsLib.tz(date, FUSEAU_PARIS);
}

export function dayjsDansFuseau(date: ConfigType, timezone: string, format?: string): Dayjs {
  if (typeof format === 'string') {
    return dayjsLib.tz(date, format, timezone);
  }
  return dayjsLib.tz(date, timezone);
}

export type { Dayjs };

export default dayjs;
