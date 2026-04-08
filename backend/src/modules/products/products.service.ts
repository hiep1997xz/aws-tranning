import { eq } from 'drizzle-orm';
import { db } from '../../config/db.js';
import { env } from '../../config/env.js';
import { categories, products } from '../../db/schema/index.js';
import type { Category } from '../../db/schema/categories.js';
import type { Product } from '../../db/schema/products.js';
import { deleteFromS3, getPresignedUrl, uploadToS3 } from '../../lib/s3-upload.js';

type ProductWithCategory = Product & {
  imageUrl: string | null;
  category: Category | null;
};

const resolveImageUrl = async (imageKey: string | null): Promise<string | null> => {
  if (!imageKey) return null;
  return getPresignedUrl(env.S3_BUCKET_NAME, imageKey);
};

export const listProducts = async (): Promise<ProductWithCategory[]> => {
  const rows = await db
    .select()
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id));

  return Promise.all(
    rows.map(async (row) => ({
      ...row.products,
      imageUrl: await resolveImageUrl(row.products.imageKey),
      category: row.categories ?? null,
    })),
  );
};

export const getProduct = async (id: string): Promise<ProductWithCategory> => {
  const [row] = await db
    .select()
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.id, id));

  if (!row) {
    throw Object.assign(new Error('Product not found'), { statusCode: 404 });
  }

  return {
    ...row.products,
    imageUrl: await resolveImageUrl(row.products.imageKey),
    category: row.categories ?? null,
  };
};

export const createProduct = async (
  data: {
    name: string;
    description?: string;
    price: string;
    stock?: number;
    categoryId?: string;
  },
  imageFile?: { buffer: Buffer; mimetype: string },
): Promise<ProductWithCategory> => {
  let imageKey: string | null = null;

  if (imageFile) {
    imageKey = `products/${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await uploadToS3(env.S3_BUCKET_NAME, imageKey, imageFile.buffer, imageFile.mimetype);
  }

  const [inserted] = await db
    .insert(products)
    .values({
      name: data.name,
      description: data.description ?? null,
      price: data.price,
      stock: data.stock ?? 0,
      categoryId: data.categoryId ?? null,
      imageKey,
    })
    .returning();

  return getProduct(inserted.id);
};

export const updateProduct = async (
  id: string,
  data: {
    name?: string;
    description?: string;
    price?: string;
    stock?: number;
    categoryId?: string;
  },
  imageFile?: { buffer: Buffer; mimetype: string },
): Promise<ProductWithCategory> => {
  const [existing] = await db
    .select({ id: products.id, imageKey: products.imageKey })
    .from(products)
    .where(eq(products.id, id));

  if (!existing) {
    throw Object.assign(new Error('Product not found'), { statusCode: 404 });
  }

  const updates: Partial<{
    name: string;
    description: string | null;
    price: string;
    stock: number;
    categoryId: string | null;
    imageKey: string | null;
    updatedAt: Date;
  }> = { updatedAt: new Date() };

  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.price !== undefined) updates.price = data.price;
  if (data.stock !== undefined) updates.stock = data.stock;
  if ('categoryId' in data) updates.categoryId = data.categoryId ?? null;

  if (imageFile) {
    // Delete old image from S3 if it exists
    if (existing.imageKey) {
      await deleteFromS3(env.S3_BUCKET_NAME, existing.imageKey);
    }
    const newKey = `products/${id}-${Date.now()}`;
    await uploadToS3(env.S3_BUCKET_NAME, newKey, imageFile.buffer, imageFile.mimetype);
    updates.imageKey = newKey;
  }

  const [updated] = await db
    .update(products)
    .set(updates)
    .where(eq(products.id, id))
    .returning();

  if (!updated) {
    throw Object.assign(new Error('Product not found'), { statusCode: 404 });
  }

  return getProduct(updated.id);
};

export const deleteProduct = async (id: string): Promise<void> => {
  const [product] = await db
    .select({ id: products.id, imageKey: products.imageKey })
    .from(products)
    .where(eq(products.id, id));

  if (!product) {
    throw Object.assign(new Error('Product not found'), { statusCode: 404 });
  }

  if (product.imageKey) {
    await deleteFromS3(env.S3_BUCKET_NAME, product.imageKey);
  }

  await db.delete(products).where(eq(products.id, id));
};
