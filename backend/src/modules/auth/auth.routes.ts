import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { validateBody } from '../../middleware/validate.js';
import { clearAuthCookies, setAuthCookies } from '../../lib/token.js';
import { loginSchema } from './auth.schema.js';
import * as authService from './auth.service.js';

export default async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/auth/login
  app.post('/login', { preHandler: [validateBody(loginSchema)] }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };
    const { accessToken, refreshToken, user } = await authService.login(email, password);
    setAuthCookies(reply, accessToken, refreshToken);
    return reply.send({ user });
  });

  // POST /api/auth/logout — requires auth
  app.post('/logout', { preHandler: [authenticate] }, async (request, reply) => {
    const rawRefresh = request.cookies['refresh_token'] ?? '';
    await authService.logout(request.user!.id, rawRefresh);
    clearAuthCookies(reply);
    return reply.send({ message: 'Logged out' });
  });

  // POST /api/auth/refresh — reads refresh_token cookie, issues new tokens
  app.post('/refresh', async (request, reply) => {
    const rawRefresh = request.cookies['refresh_token'] ?? '';
    if (!rawRefresh) return reply.status(401).send({ error: 'No refresh token' });
    const { accessToken, newRefreshToken } = await authService.refreshSession(rawRefresh);
    setAuthCookies(reply, accessToken, newRefreshToken);
    return reply.send({ ok: true });
  });

  // GET /api/auth/me — requires auth
  app.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const user = await authService.me(request.user!.id);
    return reply.send({ user });
  });
}
