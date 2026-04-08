import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid price'),
  stock: z.coerce.number().int().min(0).optional().default(0),
  categoryId: z.string().uuid().optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const productIdParamSchema = z.object({ id: z.string().uuid() });

export type CreateProductBody = z.infer<typeof createProductSchema>;
export type UpdateProductBody = z.infer<typeof updateProductSchema>;
export type ProductIdParam = z.infer<typeof productIdParamSchema>;
