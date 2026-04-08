import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { validateParams } from '../../middleware/validate.js';
import { userIdParamSchema } from './users.schema.js';
import * as usersService from './users.service.js';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export default async function usersRoutes(app: FastifyInstance): Promise<void> {
  // All routes require authentication
  app.addHook('preHandler', authenticate);

  // GET /api/users
  app.get('/', async (_request, reply) => {
    const users = await usersService.listUsers();
    return reply.send({ users });
  });

  // GET /api/users/:id
  app.get('/:id', { preHandler: [validateParams(userIdParamSchema)] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await usersService.getUser(id);
    return reply.send({ user });
  });

  // POST /api/users — multipart: fields email/password/name + optional file 'avatar'
  app.post('/', async (request, reply) => {
    const fields: Record<string, string> = {};
    let avatarFile: { buffer: Buffer; mimetype: string } | undefined;

    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'avatar') {
        if (!ALLOWED_IMAGE_TYPES.has(part.mimetype)) {
          return reply.status(400).send({ error: 'Invalid file type. Allowed: jpeg, png, webp, gif' });
        }
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) chunks.push(chunk);
        avatarFile = { buffer: Buffer.concat(chunks), mimetype: part.mimetype };
      } else if (part.type === 'field') {
        fields[part.fieldname] = part.value as string;
      }
    }

    if (!fields['email'] || !fields['password'] || !fields['name']) {
      return reply.status(400).send({ error: 'email, password, and name are required' });
    }

    const user = await usersService.createUser({
      email: fields['email'],
      password: fields['password'],
      name: fields['name'],
    });

    // If avatar was provided, update immediately after create
    if (avatarFile) {
      const updated = await usersService.updateUser(user.id, {}, avatarFile);
      return reply.status(201).send({ user: updated });
    }

    return reply.status(201).send({ user });
  });

  // PUT /api/users/:id — multipart: optional fields name/email/password + optional file 'avatar'
  app.put('/:id', { preHandler: [validateParams(userIdParamSchema)] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const fields: Record<string, string> = {};
    let avatarFile: { buffer: Buffer; mimetype: string } | undefined;

    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'avatar') {
        if (!ALLOWED_IMAGE_TYPES.has(part.mimetype)) {
          return reply.status(400).send({ error: 'Invalid file type. Allowed: jpeg, png, webp, gif' });
        }
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) chunks.push(chunk);
        avatarFile = { buffer: Buffer.concat(chunks), mimetype: part.mimetype };
      } else if (part.type === 'field') {
        fields[part.fieldname] = part.value as string;
      }
    }

    const updates: { name?: string; email?: string; password?: string } = {};
    if (fields['name']) updates.name = fields['name'];
    if (fields['email']) updates.email = fields['email'];
    if (fields['password']) updates.password = fields['password'];

    const user = await usersService.updateUser(id, updates, avatarFile);
    return reply.send({ user });
  });

  // DELETE /api/users/:id
  app.delete(
    '/:id',
    { preHandler: [validateParams(userIdParamSchema)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await usersService.deleteUser(id);
      return reply.status(204).send();
    },
  );
}
