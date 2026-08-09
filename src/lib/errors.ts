import { ZodError } from "zod";

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(
    code: string,
    message: string,
    status = 500,
    options?: { cause?: unknown; details?: unknown; expose?: boolean },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = options?.details;
    this.expose = options?.expose ?? status < 500;
  }
}

export function validationError(error: ZodError): AppError {
  return new AppError("VALIDATION_ERROR", "Données invalides.", 400, {
    details: error.flatten(),
  });
}

export function notFound(resource = "Ressource"): AppError {
  return new AppError("NOT_FOUND", `${resource} introuvable.`, 404);
}

export function unauthorized(message = "Authentification requise."): AppError {
  return new AppError("UNAUTHORIZED", message, 401);
}

export function forbidden(message = "Action non autorisée."): AppError {
  return new AppError("FORBIDDEN", message, 403);
}

export function conflict(message: string, code = "CONFLICT"): AppError {
  return new AppError(code, message, 409);
}
