type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug';

const emojis = {
  info: '💡',
  success: '✅',
  warn: '⚠️',
  error: '❌',
  debug: '🔍',
  server: '🚀',
  database: '🗄️',
  user: '👤',
  auth: '🔐',
  route: '🛣️',
  controller: '🎮',
  service: '⚙️',
  // contextos deste projeto
  blog: '🕷️',
  ingestao: '📥',
  cron: '⏰',
  parser: '🔤',
  resenha: '📜',
  culto: '⛪',
  pregador: '🎙️',
  biblia: '📖',
  devocional: '🙏',
  classificacao: '🏷️',
  livro: '📕',
  proxy: '🛡️',
  youtube: '▶️',
};

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
};

export const log = (
  level: LogLevel,
  message: string,
  context?: string,
  data?: unknown,
): void => {
  // Horário local, não UTC: toISOString() devolveria 13:06 para as 10:06 de
  // Brasília. O locale sueco é o que formata como "AAAA-MM-DD HH:MM:SS".
  const timestamp = new Date().toLocaleString('sv-SE');
  const emoji = context ? (emojis[context as keyof typeof emojis] ?? '📝') : emojis[level];

  let colorCode: string;
  switch (level) {
    case 'info':
      colorCode = colors.blue;
      break;
    case 'success':
      colorCode = colors.green;
      break;
    case 'warn':
      colorCode = colors.yellow;
      break;
    case 'error':
      colorCode = colors.red;
      break;
    case 'debug':
      colorCode = colors.magenta;
      break;
    default:
      colorCode = colors.white;
  }

  const contextStr = context ? ` [${context.toUpperCase()}]` : '';
  console.log(`${colorCode}${timestamp} ${emoji}${contextStr} ${message}${colors.reset}`);

  if (data !== undefined) {
    const dataStr = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
    console.log(`${colors.dim}${dataStr}${colors.reset}`);
  }
};

export const logInfo = (message: string, context?: string, data?: unknown): void =>
  log('info', message, context, data);
export const logSuccess = (message: string, context?: string, data?: unknown): void =>
  log('success', message, context, data);
export const logWarning = (message: string, context?: string, data?: unknown): void =>
  log('warn', message, context, data);
export const logError = (message: string, context?: string, data?: unknown): void =>
  log('error', message, context, data);
export const logDebug = (message: string, context?: string, data?: unknown): void =>
  log('debug', message, context, data);

// ──────────────────────────────────────────────────────────────────────────────
// PROGRESSO
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Barra de progresso que se comporta conforme o destino da saída.
 *
 * No terminal, reescreve a mesma linha e fica animada. No log do contêiner,
 * onde não há TTY, o `\r` não apaga nada e a linha vira um paredão do tipo
 * "✓ 2000/31106 ✓ 4000/31106 ✓ 6000/31106..." — então lá ela imprime só
 * marcos, de 25 em 25 por cento.
 */
export const progresso = (rotulo: string, total: number, context?: string) => {
  const animado = Boolean(process.stdout.isTTY);
  const largura = 24;
  let ultimoMarco = 0;

  return {
    atualizar(feito: number) {
      const fracao = total > 0 ? feito / total : 1;

      if (animado) {
        const cheio = Math.round(fracao * largura);
        const barra = '█'.repeat(cheio) + '░'.repeat(largura - cheio);
        const pct = String(Math.round(fracao * 100)).padStart(3);
        process.stdout.write(`\r${colors.dim}   ${barra}${colors.reset} ${pct}% ${rotulo}`);
        return;
      }

      const marco = Math.floor(fracao * 4); // 0, 25, 50, 75, 100%
      if (marco > ultimoMarco) {
        ultimoMarco = marco;
        logInfo(`${rotulo}: ${Math.round(fracao * 100)}% (${feito}/${total})`, context);
      }
    },

    concluir(mensagem: string) {
      if (animado) process.stdout.write(`\r${' '.repeat(largura + 40)}\r`);
      logSuccess(mensagem, context);
    },
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// CLASSES DE ERRO
// ──────────────────────────────────────────────────────────────────────────────

export abstract class IntegrityError extends Error {
  public readonly code: string;
  public readonly timestamp: Date;

  constructor(message: string, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date();
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class NotFoundError extends IntegrityError {
  constructor(message = 'Entidade não encontrada') {
    super(message, 'NOT_FOUND');
  }
}

export class ValidationError extends IntegrityError {
  public readonly campos: Array<{ campo: string; mensagem: string }>;

  constructor(message: string, campos: Array<{ campo: string; mensagem: string }>) {
    super(message, 'VALIDATION');
    this.campos = campos;
  }
}

export class ConstraintViolationError extends IntegrityError {
  public readonly details: {
    entidade: string;
    id: string;
    dependencias: Record<string, number>;
  };

  constructor(
    message: string,
    details: { entidade: string; id: string; dependencias: Record<string, number> },
  ) {
    super(message, 'CONSTRAINT_VIOLATION');
    this.details = details;
  }
}

export class ForbiddenError extends IntegrityError {
  public readonly requiredRole: string[];
  public readonly userRole: string;

  constructor(
    message = 'Operação não permitida para este perfil de usuário',
    requiredRole: string[],
    userRole: string,
  ) {
    super(message, 'FORBIDDEN');
    this.requiredRole = requiredRole;
    this.userRole = userRole;
  }
}

export class InvalidStateError extends IntegrityError {
  public readonly currentState: string;
  public readonly requiredState: string;

  constructor(message: string, currentState: string, requiredState: string) {
    super(message, 'INVALID_STATE');
    this.currentState = currentState;
    this.requiredState = requiredState;
  }
}

export const isIntegrityError = (error: unknown): error is IntegrityError =>
  error instanceof IntegrityError;

export const mapErrorToHttpResponse = (error: IntegrityError) => {
  switch (error.code) {
    case 'NOT_FOUND':
      return {
        status: 404,
        response: {
          status: 'erro',
          mensagem: error.message,
          codigo: error.code,
          timestamp: error.timestamp,
        },
      };

    case 'VALIDATION': {
      const e = error as ValidationError;
      return {
        status: 400,
        response: {
          status: 'erro',
          mensagem: error.message,
          codigo: error.code,
          detalhes: e.campos,
          timestamp: error.timestamp,
        },
      };
    }

    case 'CONSTRAINT_VIOLATION': {
      const e = error as ConstraintViolationError;
      return {
        status: 400,
        response: {
          status: 'erro',
          mensagem: error.message,
          codigo: error.code,
          detalhes: e.details,
          timestamp: error.timestamp,
        },
      };
    }

    case 'FORBIDDEN': {
      const e = error as ForbiddenError;
      return {
        status: 403,
        response: {
          status: 'erro',
          mensagem: error.message,
          codigo: error.code,
          detalhes: { perfil_usuario: e.userRole, perfis_requeridos: e.requiredRole },
          timestamp: error.timestamp,
        },
      };
    }

    case 'INVALID_STATE': {
      const e = error as InvalidStateError;
      return {
        status: 400,
        response: {
          status: 'erro',
          mensagem: error.message,
          codigo: error.code,
          detalhes: { estado_atual: e.currentState, estado_requerido: e.requiredState },
          timestamp: error.timestamp,
        },
      };
    }

    default:
      return {
        status: 500,
        response: {
          status: 'erro',
          mensagem: 'Erro interno do servidor',
          codigo: 'INTERNAL_ERROR',
          timestamp: new Date(),
        },
      };
  }
};

export default {
  log,
  info: logInfo,
  success: logSuccess,
  warning: logWarning,
  error: logError,
  debug: logDebug,
};
