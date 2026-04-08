import type { FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import type { ZodSchema } from 'zod';

type PreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

const formatZodFailure = (
  error: ZodError,
): { error: string; details: { field: string; message: string }[] } => ({
  error: 'Validation failed',
  details: error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
});

/**
 * Validate and replace request.body with the parsed Zod output.
 */
export const validateBody = <T>(schema: ZodSchema<T>): PreHandler =>
  async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      reply.status(400).send(formatZodFailure(result.error));
      return;
    }
    request.body = result.data;
  };

/**
 * Validate and replace request.params with the parsed Zod output.
 */
export const validateParams = <T>(schema: ZodSchema<T>): PreHandler =>
  async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const result = schema.safeParse(request.params);
    if (!result.success) {
      reply.status(400).send(formatZodFailure(result.error));
      return;
    }
    // Fastify types params as unknown record — cast required
    (request as FastifyRequest & { params: unknown }).params = result.data;
  };

/**
 * Validate and replace request.query with the parsed Zod output.
 */
export const validateQuery = <T>(schema: ZodSchema<T>): PreHandler =>
  async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const result = schema.safeParse(request.query);
    if (!result.success) {
      reply.status(400).send(formatZodFailure(result.error));
      return;
    }
    (request as FastifyRequest & { query: unknown }).query = result.data;
  };
