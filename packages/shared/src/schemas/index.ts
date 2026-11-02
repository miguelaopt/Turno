import { z } from 'zod';
import { Constants } from '../types/database';
import { fromLisbonLocal, hoursBetween, isDateKey, isTimeString } from '../time';

/** Igual à restrição shifts_max_duration da base de dados. */
export const MAX_SHIFT_HOURS = 16;

export const userRoleSchema = z.enum(Constants.public.Enums.user_role);
export const shiftSourceSchema = z.enum(Constants.public.Enums.shift_source);
export const swapTypeSchema = z.enum(Constants.public.Enums.swap_type);
export const swapStatusSchema = z.enum(Constants.public.Enums.swap_status);
export const pushPlatformSchema = z.enum(Constants.public.Enums.push_platform);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Escreve um email válido.' }));

/** Variáveis de ambiente do Supabase (só URL e anon key; nunca a service role). */
export const supabaseEnvSchema = z.object({
  url: z.url({ error: 'URL do Supabase em falta ou inválido.' }),
  anonKey: z.string().min(20, { error: 'Anon key do Supabase em falta.' }),
});
export type SupabaseEnv = z.infer<typeof supabaseEnvSchema>;

export function parseSupabaseEnv(raw: { url?: string; anonKey?: string }): SupabaseEnv {
  const result = supabaseEnvSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Configuração do Supabase inválida: ${result.error.issues.map((i) => i.message).join(' ')} ` +
        'Copia o .env.example para .env.local (web) ou .env (mobile) e preenche os valores.',
    );
  }
  return result.data;
}

/**
 * Formulário de turno: um dia (Lisboa) e horas de início e fim.
 * Se a hora de fim for igual ou anterior à de início, o turno acaba no dia seguinte
 * (ex.: 19:00–02:00).
 */
export const shiftFormSchema = z
  .object({
    date: z.string().refine(isDateKey, { error: 'Escolhe o dia do turno.' }),
    startTime: z
      .string()
      .trim()
      .refine(isTimeString, { error: 'Hora de início inválida (HH:MM).' }),
    endTime: z.string().trim().refine(isTimeString, { error: 'Hora de fim inválida (HH:MM).' }),
  })
  .superRefine((values, ctx) => {
    if (
      !isDateKey(values.date) ||
      !isTimeString(values.startTime) ||
      !isTimeString(values.endTime)
    ) {
      return;
    }
    if (values.startTime === values.endTime) {
      ctx.addIssue({
        code: 'custom',
        path: ['endTime'],
        message: 'A hora de fim tem de ser diferente da de início.',
      });
      return;
    }
    const { startsAt, endsAt } = shiftFormToTimes(values);
    if (hoursBetween(startsAt, endsAt) > MAX_SHIFT_HOURS) {
      ctx.addIssue({
        code: 'custom',
        path: ['endTime'],
        message: `Um turno não pode ter mais de ${MAX_SHIFT_HOURS} horas.`,
      });
    }
  });

export type ShiftFormValues = z.input<typeof shiftFormSchema>;

/** Converte os valores do formulário em instantes. Não valida: usar shiftFormSchema antes. */
export function shiftFormToTimes(values: ShiftFormValues): { startsAt: Date; endsAt: Date } {
  const startsAt = fromLisbonLocal(values.date, values.startTime);
  let endsAt = fromLisbonLocal(values.date, values.endTime);
  if (endsAt.getTime() <= startsAt.getTime()) {
    const [y, m, d] = values.date.split('-').map(Number) as [number, number, number];
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    const nextKey = next.toISOString().slice(0, 10);
    endsAt = fromLisbonLocal(nextKey, values.endTime);
  }
  return { startsAt, endsAt };
}

/** Primeira mensagem de erro de cada campo, para mostrar junto ao input. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    out[key] ??= issue.message;
  }
  return out;
}
