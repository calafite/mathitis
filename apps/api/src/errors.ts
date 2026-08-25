export class DomainError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string, code = 'NOT_FOUND') {
    super(code, 404, message);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, code = 'CONFLICT') {
    super(code, 409, message);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Autenticação obrigatória', code = 'UNAUTHORIZED') {
    super(code, 401, message);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string, code = 'FORBIDDEN') {
    super(code, 403, message);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, code = 'VALIDATION_ERROR') {
    super(code, 422, message);
  }
}
