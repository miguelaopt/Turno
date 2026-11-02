import type { DateInput } from '../time';

/** Qualquer coisa com início e fim (um turno guardado ou um candidato). */
export interface TimeRange {
  id?: string;
  startsAt: DateInput;
  endsAt: DateInput;
}
