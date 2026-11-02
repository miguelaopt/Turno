// Tradução de erros técnicos para mensagens em pt-PT.

interface ErrorLike {
  message?: string;
  code?: string;
  status?: number;
}

export function getErrorMessage(error: unknown): string {
  if (!error) return 'Ocorreu um erro inesperado.';
  const e = (typeof error === 'object' ? error : { message: String(error) }) as ErrorLike;
  const message = e.message ?? '';

  if (Array.isArray((e as { issues?: unknown }).issues)) {
    // ZodError: a primeira mensagem já está em pt-PT.
    const issues = (e as { issues: { message: string }[] }).issues;
    if (issues[0]) return issues[0].message;
  }

  switch (e.code) {
    case '23514':
      return 'Os dados do turno não são válidos (confirma as horas).';
    case '23503':
      return 'Este turno tem pedidos de troca associados e não pode ser alterado desta forma.';
    case '23505':
      return 'Já existe um registo igual.';
    case '42501':
      return 'Não tens permissão para fazer isto.';
    case 'over_email_send_rate_limit':
      return 'Pediste demasiados links. Espera um minuto e tenta outra vez.';
    case 'otp_disabled':
    case 'signup_disabled':
      return 'Este email não está registado no Turno. Pede à gerência para te adicionar.';
    case 'otp_expired':
      return 'O link expirou ou já foi usado. Pede um novo.';
  }

  if (/signups not allowed/i.test(message) || /user not found/i.test(message)) {
    return 'Este email não está registado no Turno. Pede à gerência para te adicionar.';
  }
  if (e.status === 429 || /rate limit/i.test(message)) {
    return 'Pediste demasiados links. Espera um minuto e tenta outra vez.';
  }
  if (/failed to fetch|network request failed|networkerror/i.test(message)) {
    return 'Sem ligação. Verifica a internet e tenta outra vez.';
  }
  if (/code verifier|both auth code and code verifier/i.test(message)) {
    return 'Abre o link no mesmo dispositivo e navegador onde o pediste.';
  }
  if (/expired|invalid/i.test(message) && /link|token|otp|grant/i.test(message)) {
    return 'O link expirou ou já foi usado. Pede um novo.';
  }
  return message || 'Ocorreu um erro inesperado.';
}
