import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import categoriesRoutes from './modules/categories/categories.routes.js';
import productsRoutes from './modules/products/products.routes.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: env.FRONTEND_URL,
  credentials: true,
});
await app.register(cookie);
await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });

app.setErrorHandler(errorHandler);

app.get('/health', async () => ({ status: 'ok' }));

await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(usersRoutes, { prefix: '/api/users' });
await app.register(categoriesRoutes, { prefix: '/api/categories' });
await app.register(productsRoutes, { prefix: '/api/products' });

export default app;
