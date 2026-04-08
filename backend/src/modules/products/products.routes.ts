import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { validateParams } from '../../middleware/validate.js';
import { productIdParamSchema } from './products.schema.js';
import * as productsService from './products.service.js';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export default async function productsRoutes(app: FastifyInstance): Promise<void> {
  // All routes require authentication
  app.addHook('preHandler', authenticate);

  // GET /api/products
  app.get('/', async (_request, reply) => {
    const productList = await productsService.listProducts();
    return reply.send({ products: productList });
  });

  // GET /api/products/:id
  app.get(
    '/:id',
    { preHandler: [validateParams(productIdParamSchema)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const product = await productsService.getProduct(id);
      return reply.send({ product });
    },
  );

  // POST /api/products — multipart: fields + optional 'image' file
  app.post('/', async (request, reply) => {
    const fields: Record<string, string> = {};
    let imageFile: { buffer: Buffer; mimetype: string } | undefined;

    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'image') {
        if (!ALLOWED_IMAGE_TYPES.has(part.mimetype)) {
          return reply.status(400).send({ error: 'Invalid file type. Allowed: jpeg, png, webp, gif' });
        }
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) chunks.push(chunk);
        imageFile = { buffer: Buffer.concat(chunks), mimetype: part.mimetype };
      } else if (part.type === 'field') {
        fields[part.fieldname] = part.value as string;
      }
    }

    if (!fields['name'] || !fields['price']) {
      return reply.status(400).send({ error: 'name and price are required' });
    }

    const product = await productsService.createProduct(
      {
        name: fields['name'],
        description: fields['description'],
        price: fields['price'],
        stock: fields['stock'] !== undefined ? Number(fields['stock']) : 0,
        categoryId: fields['categoryId'],
      },
      imageFile,
    );

    return reply.status(201).send({ product });
  });

  // PUT /api/products/:id — multipart: optional fields + optional 'image' file
  app.put(
    '/:id',
    { preHandler: [validateParams(productIdParamSchema)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const fields: Record<string, string> = {};
      let imageFile: { buffer: Buffer; mimetype: string } | undefined;

      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'image') {
          if (!ALLOWED_IMAGE_TYPES.has(part.mimetype)) {
            return reply.status(400).send({ error: 'Invalid file type. Allowed: jpeg, png, webp, gif' });
          }
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) chunks.push(chunk);
          imageFile = { buffer: Buffer.concat(chunks), mimetype: part.mimetype };
        } else if (part.type === 'field') {
          fields[part.fieldname] = part.value as string;
        }
      }

      const updates: {
        name?: string;
        description?: string;
        price?: string;
        stock?: number;
        categoryId?: string;
      } = {};

      if (fields['name'] !== undefined) updates.name = fields['name'];
      if (fields['description'] !== undefined) updates.description = fields['description'];
      if (fields['price'] !== undefined) updates.price = fields['price'];
      if (fields['stock'] !== undefined) updates.stock = Number(fields['stock']);
      if (fields['categoryId'] !== undefined) updates.categoryId = fields['categoryId'];

      const product = await productsService.updateProduct(id, updates, imageFile);
      return reply.send({ product });
    },
  );

  // DELETE /api/products/:id
  app.delete(
    '/:id',
    { preHandler: [validateParams(productIdParamSchema)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await productsService.deleteProduct(id);
      return reply.status(204).send();
    },
  );
}
