// Datas e horas no fuso Europe/Lisbon, independentemente do fuso do dispositivo.
//
// Usamos apenas Intl.DateTimeFormat#formatToParts (suportado em browsers, Node
// e Hermes) em vez de bibliotecas de fusos, para o comportamento ser igual no
// site e na app. A base de dados guarda sempre instantes (timestamptz, UTC).

export const TIME_ZONE = 'Europe/Lisbon';
export const LOCALE = 'pt-PT';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

export type DateInput = Date | string | number;

export function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Partes de calendário de um instante, vistas em Lisboa. */
export interface ZonedParts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = segunda-feira … 6 = domingo */
  weekdayIndex: number;
}

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export function zonedParts(value: DateInput): ZonedParts {
  const date = toDate(value);
  const map: Record<string, number> = {};
  for (const part of partsFormatter.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = Number(part.value);
  }
  const year = map.year ?? NaN;
  const month = map.month ?? NaN;
  const day = map.day ?? NaN;
  const weekdayIndex = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
  return {
    year,
    month,
    day,
    // Alguns motores devolvem "24" à meia-noite.
    hour: (map.hour ?? 0) % 24,
    minute: map.minute ?? 0,
    second: map.second ?? 0,
    weekdayIndex,
  };
}

/** Diferença (ms) entre a hora de Lisboa e UTC nesse instante (0 ou +1h). */
export function lisbonOffsetMs(value: DateInput): number {
  const date = toDate(value);
  const p = zonedParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const truncated = date.getTime() - date.getUTCMilliseconds();
  return asUtc - truncated;
}

/**
 * Converte uma hora "de parede" em Lisboa para um instante.
 * Aceita valores fora do intervalo (ex.: dia 32) e normaliza como Date.UTC.
 */
export function lisbonWallTimeToDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let ts = guess - lisbonOffsetMs(guess);
  // Segunda passagem para acertar perto das mudanças de hora.
  ts = guess - lisbonOffsetMs(ts);
  return new Date(ts);
}

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isDateKey(value: string): boolean {
  return DATE_KEY_RE.test(value);
}

export function isTimeString(value: string): boolean {
  return TIME_RE.test(value);
}

/** Converte "AAAA-MM-DD" + "HH:mm" (hora de Lisboa) num instante. */
export function fromLisbonLocal(dateKey: string, time: string): Date {
  const d = DATE_KEY_RE.exec(dateKey);
  const t = TIME_RE.exec(time);
  if (!d || !t) throw new Error(`Data/hora inválida: ${dateKey} ${time}`);
  return lisbonWallTimeToDate(Number(d[1]), Number(d[2]), Number(d[3]), Number(t[1]), Number(t[2]));
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "AAAA-MM-DD" do dia em Lisboa. */
export function toLisbonDateKey(value: DateInput): string {
  const p = zonedParts(value);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** "HH:mm" em Lisboa. */
export function toLisbonTimeString(value: DateInput): string {
  const p = zonedParts(value);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Meia-noite (Lisboa) do dia do instante, somando `days` dias de calendário. */
export function startOfLisbonDay(value: DateInput, days = 0): Date {
  const p = zonedParts(value);
  return lisbonWallTimeToDate(p.year, p.month, p.day + days);
}

/** Segunda-feira às 00:00 (Lisboa) da semana do instante. */
export function startOfLisbonWeek(value: DateInput): Date {
  const p = zonedParts(value);
  return lisbonWallTimeToDate(p.year, p.month, p.day - p.weekdayIndex);
}

export interface Interval {
  start: Date;
  /** Exclusivo. */
  end: Date;
}

/** Semana (segunda 00:00 → segunda seguinte 00:00, Lisboa) do instante. */
export function lisbonWeek(value: DateInput): Interval {
  const start = startOfLisbonWeek(value);
  return { start, end: startOfLisbonDay(start, 7) };
}

/** Semana deslocada `weeks` semanas. */
export function shiftLisbonWeek(weekStart: DateInput, weeks: number): Interval {
  return lisbonWeek(startOfLisbonDay(weekStart, weeks * 7));
}

/** As 7 meias-noites (Lisboa) da semana que começa em `weekStart`. */
export function lisbonWeekDays(weekStart: DateInput): Date[] {
  const start = startOfLisbonWeek(weekStart);
  return Array.from({ length: 7 }, (_, i) => startOfLisbonDay(start, i));
}

export function hoursBetween(start: DateInput, end: DateInput): number {
  return (toDate(end).getTime() - toDate(start).getTime()) / HOUR_MS;
}

// ----------------------------------------------------------------- Formatação

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const weekdayLongFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  weekday: 'long',
});
const weekdayShortFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  weekday: 'short',
});
const monthLongFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  month: 'long',
});
const hoursFormatter = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });

/** "09:00" */
export function formatTime(value: DateInput): string {
  return timeFormatter.format(toDate(value));
}

/** "09:00–17:00" */
export function formatTimeRange(start: DateInput, end: DateInput): string {
  return `${formatTime(start)}–${formatTime(end)}`;
}

/** "segunda-feira" */
export function formatWeekday(value: DateInput): string {
  return weekdayLongFormatter.format(toDate(value));
}

/** "seg." */
export function formatWeekdayShort(value: DateInput): string {
  return weekdayShortFormatter.format(toDate(value));
}

/** "2 de novembro" */
export function formatDayMonth(value: DateInput): string {
  const p = zonedParts(value);
  return `${p.day} de ${monthLongFormatter.format(toDate(value))}`;
}

/** "segunda-feira, 2 de novembro" */
export function formatDayLong(value: DateInput): string {
  return `${formatWeekday(value)}, ${formatDayMonth(value)}`;
}

/** "2–8 de novembro de 2026" ou "30 de novembro – 6 de dezembro de 2026" */
export function formatWeekRange(weekStart: DateInput): string {
  const first = startOfLisbonWeek(weekStart);
  const last = startOfLisbonDay(first, 6);
  const a = zonedParts(first);
  const b = zonedParts(last);
  if (a.year !== b.year) {
    return `${formatDayMonth(first)} de ${a.year} – ${formatDayMonth(last)} de ${b.year}`;
  }
  if (a.month !== b.month) {
    return `${formatDayMonth(first)} – ${formatDayMonth(last)} de ${b.year}`;
  }
  return `${a.day}–${b.day} de ${monthLongFormatter.format(last)} de ${b.year}`;
}

/** "7,5 h" */
export function formatHours(hours: number): string {
  return `${hoursFormatter.format(hours)} h`;
}

/** "segunda-feira, 2 de novembro" → "Segunda-feira, 2 de novembro" (só a primeira letra). */
export function capitalizeFirst(text: string): string {
  return text.charAt(0).toLocaleUpperCase(LOCALE) + text.slice(1);
}

/**
 * Máscara para escrever horas com teclado numérico: "930" → "09:30",
 * "1730" → "17:30", "17" → "17". Não valida (usar isTimeString).
 */
export function maskTimeInput(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  if (digits.length === 3) return `0${digits[0]}:${digits.slice(1)}`;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}
