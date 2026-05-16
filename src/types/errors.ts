export enum ErrorCategory {
  LLM = 'LLM',
  FILESYSTEM = 'FILESYSTEM',
  CONFIG = 'CONFIG',
  COMMAND = 'COMMAND',
  AUTH = 'AUTH',
  NETWORK = 'NETWORK',
  CONDUCTOR = 'CONDUCTOR',
  USER = 'USER',
  UNKNOWN = 'UNKNOWN',
}

export class ImaraError extends Error {
  readonly category: ErrorCategory;
  readonly code: string;
  readonly isRecoverable: boolean;
  readonly timestamp: Date;

  constructor(
    category: ErrorCategory,
    code: string,
    message: string,
    options: { cause?: Error; isRecoverable?: boolean } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = 'ImaraError';
    this.category = category;
    this.code = code;
    this.isRecoverable = options.isRecoverable ?? false;
    this.timestamp = new Date();
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      category: this.category,
      code: this.code,
      message: this.message,
      isRecoverable: this.isRecoverable,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
      cause: this.cause instanceof Error
        ? { message: this.cause.message, stack: this.cause.stack }
        : undefined,
    };
  }
}

// --- LLM / API errors -----------------------------------------------
export class LlmError extends ImaraError {
  constructor(
    code: string,
    message: string,
    options?: { cause?: Error; isRecoverable?: boolean }
  ) {
    super(ErrorCategory.LLM, code, message, options);
    this.name = 'LlmError';
  }
}

export class ApiKeyMissingError extends LlmError {
  constructor() {
    super('API_KEY_MISSING', 'Clé API manquante. Lancez `imara login`.', {
      isRecoverable: true,
    });
    this.name = 'ApiKeyMissingError';
  }
}

export class RateLimitError extends LlmError {
  readonly retryAfterMs: number;
  constructor(retryAfterMs: number = 5000) {
    super('RATE_LIMIT', `Quota atteint. Réessayez dans ${Math.ceil(retryAfterMs / 1000)}s.`, {
      isRecoverable: true,
    });
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class UnauthorizedError extends LlmError {
  constructor() {
    super('UNAUTHORIZED', 'Session invalide ou expirée. Reconnectez-vous.', {
      isRecoverable: true,
    });
    this.name = 'UnauthorizedError';
  }
}

// --- File System errors ---------------------------------------------
export class FsError extends ImaraError {
  readonly path?: string;
  constructor(
    code: string,
    message: string,
    options?: { cause?: Error; path?: string; isRecoverable?: boolean }
  ) {
    super(ErrorCategory.FILESYSTEM, code, message, options);
    this.name = 'FsError';
    this.path = options?.path;
  }
}

export class FileNotFoundError extends FsError {
  constructor(filePath: string) {
    super('FILE_NOT_FOUND', `Fichier introuvable : ${filePath}`, {
      path: filePath,
      isRecoverable: true,
    });
    this.name = 'FileNotFoundError';
  }
}

export class FileAccessDeniedError extends FsError {
  constructor(filePath: string) {
    super('FILE_ACCESS_DENIED', `Accès refusé : ${filePath}`, {
      path: filePath,
      isRecoverable: true,
    });
    this.name = 'FileAccessDeniedError';
  }
}

export class ProtectedFileError extends FsError {
  constructor(filePath: string) {
    super('PROTECTED_FILE', `Fichier protégé : ${filePath}`, {
      path: filePath,
      isRecoverable: true,
    });
    this.name = 'ProtectedFileError';
  }
}

// --- Config errors --------------------------------------------------
export class ConfigError extends ImaraError {
  constructor(
    code: string,
    message: string,
    options?: { cause?: Error; isRecoverable?: boolean }
  ) {
    super(ErrorCategory.CONFIG, code, message, options);
    this.name = 'ConfigError';
  }
}

export class ConfigKeyInvalidError extends ConfigError {
  constructor(key: string) {
    super('CONFIG_KEY_INVALID', `Clé de configuration invalide : ${key}`, {
      isRecoverable: true,
    });
    this.name = 'ConfigKeyInvalidError';
  }
}

// --- Command errors -------------------------------------------------
export class CommandError extends ImaraError {
  readonly command?: string;
  constructor(
    code: string,
    message: string,
    options?: { cause?: Error; command?: string; isRecoverable?: boolean }
  ) {
    super(ErrorCategory.COMMAND, code, message, options);
    this.name = 'CommandError';
    this.command = options?.command;
  }
}

export class CommandExecutionError extends CommandError {
  readonly exitCode?: number;
  constructor(
    message: string,
    options: { cause?: Error; command?: string; exitCode?: number }
  ) {
    super('COMMAND_EXECUTION_FAILED', message, {
      cause: options.cause,
      command: options.command,
      isRecoverable: true,
    });
    this.name = 'CommandExecutionError';
    this.exitCode = options.exitCode;
  }
}

// --- Auth errors ----------------------------------------------------
export class AuthError extends ImaraError {
  constructor(
    code: string,
    message: string,
    options?: { cause?: Error; isRecoverable?: boolean }
  ) {
    super(ErrorCategory.AUTH, code, message, options);
    this.name = 'AuthError';
  }
}

// --- Network errors -------------------------------------------------
export class NetworkError extends ImaraError {
  constructor(
    code: string,
    message: string,
    options?: { cause?: Error; isRecoverable?: boolean }
  ) {
    super(ErrorCategory.NETWORK, code, message, options);
    this.name = 'NetworkError';
  }
}

// --- Conductor errors -----------------------------------------------
export class ConductorError extends ImaraError {
  constructor(
    code: string,
    message: string,
    options?: { cause?: Error; isRecoverable?: boolean }
  ) {
    super(ErrorCategory.CONDUCTOR, code, message, options);
    this.name = 'ConductorError';
  }
}

export class ConductorNotInitializedError extends ConductorError {
  constructor() {
    super('CONDUCTOR_NOT_INITIALIZED', 'Conductor non initialisé. Lancez `imara init-conductor`.', {
      isRecoverable: true,
    });
    this.name = 'ConductorNotInitializedError';
  }
}

export class NoActiveTrackError extends ConductorError {
  constructor() {
    super('NO_ACTIVE_TRACK', 'Aucun track actif. Créez-en un avec `imara conductor new`.', {
      isRecoverable: true,
    });
    this.name = 'NoActiveTrackError';
  }
}

// --- User / validation errors ---------------------------------------
export class UserError extends ImaraError {
  constructor(
    code: string,
    message: string,
    options?: { cause?: Error; isRecoverable?: boolean }
  ) {
    super(ErrorCategory.USER, code, message, options);
    this.name = 'UserError';
  }
}

export class UserCancellationError extends UserError {
  constructor(operation: string = 'opération') {
    super('USER_CANCELLED', `Demande ${operation} annulée par l'utilisateur.`, {
      isRecoverable: true,
    });
    this.name = 'UserCancellationError';
  }
}

// --- Unknown / catch-all --------------------------------------------
export class UnknownError extends ImaraError {
  constructor(cause?: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause);
    super(ErrorCategory.UNKNOWN, 'UNKNOWN', message, {
      cause: cause instanceof Error ? cause : undefined,
      isRecoverable: false,
    });
    this.name = 'UnknownError';
  }
}

// --- Factory --------------------------------------------------------
export function fromUnknown(cause: unknown): ImaraError {
  if (cause instanceof ImaraError) return cause;
  if (cause instanceof Error) return new UnknownError(cause);
  return new UnknownError(cause);
}
