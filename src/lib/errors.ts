export class AppError extends Error {
  constructor(message: string, public readonly code = 'APP_ERROR', public override readonly cause?: unknown) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, cause?: unknown) { super(message, 'VALIDATION_ERROR', cause) }
}

export class PermissionError extends AppError {
  constructor(message = 'Você não tem permissão para realizar esta ação.') { super(message, 'PERMISSION_DENIED') }
}

export class ConflictError extends AppError {
  constructor(message: string) { super(message, 'CONFLICT') }
}
