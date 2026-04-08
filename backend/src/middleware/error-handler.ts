import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';

/**
 * Centralised Fastify error handler.
 * - ZodError → 400 with field-level detail
 * - FastifyError → use its statusCode
 * - Unknown → 500 (never expose stack traces)
 */
export const errorHandler = (
  error: FastifyError | Error,
  _request: FastifyRequest,
  reply: FastifyReply,
): void => {
  // Zod validation errors
  if (error instanceof ZodError) {
    const details = error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    reply.status(400).send({ error: 'Validation failed', details });
    return;
  }

  // Fastify errors carry a statusCode
  const fastifyError = error as FastifyError;
  if (fastifyError.statusCode !== undefined) {
    reply.status(fastifyError.statusCode).send({ error: fastifyError.message });
    return;
  }

  // Fallback — hide internals from caller
  reply.status(500).send({ error: 'Internal server error' });
};
