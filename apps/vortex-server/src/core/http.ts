import type { NextFunction, Request, Response } from 'express';

/** Operational error with an HTTP status, surfaced verbatim to clients. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(message: string, details?: unknown): HttpError {
    return new HttpError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Authentication required'): HttpError {
    return new HttpError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Access denied by Vortex RLS policy'): HttpError {
    return new HttpError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Object not found'): HttpError {
    return new HttpError(404, 'NOT_FOUND', message);
  }

  static conflict(message: string): HttpError {
    return new HttpError(409, 'CONFLICT', message);
  }

  static tooLarge(message: string): HttpError {
    return new HttpError(413, 'PAYLOAD_TOO_LARGE', message);
  }

  static unavailable(message: string): HttpError {
    return new HttpError(501, 'CAPABILITY_UNAVAILABLE', message);
  }
}

type AsyncHandler = (req: Request, res: Response) => Promise<unknown>;

/**
 * Wraps an async route handler: returned values are JSON-serialized
 * automatically, thrown errors flow to the central error middleware.
 */
export function ah(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res)
      .then((value) => {
        if (value !== undefined && !res.headersSent) res.json(value);
      })
      .catch(next);
  };
}

export function errorMiddleware() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (error: unknown, req: Request, res: Response, _next: NextFunction): void => {
    if (error instanceof HttpError) {
      res.status(error.status).json({
        error: { code: error.code, message: error.message, details: error.details ?? null },
      });
      return;
    }
    const errno = error as NodeJS.ErrnoException;
    if (errno?.code === 'ENOENT') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Object not found' } });
      return;
    }
    if ((error as { type?: string })?.type === 'entity.too.large') {
      res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' } });
      return;
    }
    const err = error as Error;
    res.status(500).json({
      error: { code: 'INTERNAL', message: err?.message ?? 'Unexpected storage engine error' },
    });
  };
}
