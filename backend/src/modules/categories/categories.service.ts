import { eq } from 'drizzle-orm';
import { db } from '../../config/db.js';
import { categories } from '../../db/schema/index.js';
import type { Category } from '../../db/schema/categories.js';

export const listCategories = async (): Promise<Category[]> => {
  return db.select().from(categories);
};

export const getCategory = async (id: string): Promise<Category> => {
  const [category] = await db.select().from(categories).where(eq(categories.id, id));

  if (!category) {
    throw Object.assign(new Error('Category not found'), { statusCode: 404 });
  }

  return category;
};

export const createCategory = async (data: {
  name: string;
  description?: string;
}): Promise<Category> => {
  let inserted: Category[];

  try {
    inserted = await db
      .insert(categories)
      .values({ name: data.name, description: data.description ?? null })
      .returning();
  } catch (err) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      throw Object.assign(new Error('Category name already in use'), { statusCode: 409 });
    }
    throw err;
  }

  return inserted[0];
};

export const updateCategory = async (
  id: string,
  data: { name?: string; description?: string },
): Promise<Category> => {
  const updates: Partial<{ name: string; description: string | null; updatedAt: Date }> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;

  let updated: Category[];

  try {
    updated = await db
      .update(categories)
      .set(updates)
      .where(eq(categories.id, id))
      .returning();
  } catch (err) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      throw Object.assign(new Error('Category name already in use'), { statusCode: 409 });
    }
    throw err;
  }

  if (!updated[0]) {
    throw Object.assign(new Error('Category not found'), { statusCode: 404 });
  }

  return updated[0];
};

export const deleteCategory = async (id: string): Promise<void> => {
  const [existing] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, id));

  if (!existing) {
    throw Object.assign(new Error('Category not found'), { statusCode: 404 });
  }

  // FK on products is SET NULL — safe to delete directly
  await db.delete(categories).where(eq(categories.id, id));
};
