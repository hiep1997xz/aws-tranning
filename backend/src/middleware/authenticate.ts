import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '../lib/token.js';

// Augment FastifyRequest to carry authenticated user identity
declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string };
  }
}

/**
 * Fastify preHandler that validates the access_token cookie.
 * Sets request.user = { id } on success; replies 401 on failure.
 */
export const authenticate = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const token = request.cookies['access_token'];

  if (!token) {
    reply.status(401).send({ error: 'Unauthorized' });
    return;
  }

  const payload = verifyAccessToken(token);

  if (!payload) {
    reply.status(401).send({ error: 'Unauthorized' });
    return;
  }

  request.user = { id: payload.userId };
};
