import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import {
  categoryIdParamSchema,
  createCategorySchema,
  updateCategorySchema,
} from './categories.schema.js';
import * as categoriesService from './categories.service.js';

export default async function categoriesRoutes(app: FastifyInstance): Promise<void> {
  // All routes require authentication
  app.addHook('preHandler', authenticate);

  // GET /api/categories
  app.get('/', async (_request, reply) => {
    const categories = await categoriesService.listCategories();
    return reply.send({ categories });
  });

  // GET /api/categories/:id
  app.get(
    '/:id',
    { preHandler: [validateParams(categoryIdParamSchema)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const category = await categoriesService.getCategory(id);
      return reply.send({ category });
    },
  );

  // POST /api/categories
  app.post(
    '/',
    { preHandler: [validateBody(createCategorySchema)] },
    async (request, reply) => {
      const body = request.body as { name: string; description?: string };
      const category = await categoriesService.createCategory(body);
      return reply.status(201).send({ category });
    },
  );

  // PUT /api/categories/:id
  app.put(
    '/:id',
    { preHandler: [validateParams(categoryIdParamSchema), validateBody(updateCategorySchema)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { name?: string; description?: string };
      const category = await categoriesService.updateCategory(id, body);
      return reply.send({ category });
    },
  );

  // DELETE /api/categories/:id
  app.delete(
    '/:id',
    { preHandler: [validateParams(categoryIdParamSchema)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await categoriesService.deleteCategory(id);
      return reply.status(204).send();
    },
  );
}
