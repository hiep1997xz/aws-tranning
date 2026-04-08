import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../../config/db.js';
import { env } from '../../config/env.js';
import { users } from '../../db/schema/index.js';
import { deleteFromS3, getPresignedUrl, uploadToS3 } from '../../lib/s3-upload.js';
import { sendWelcomeEmail } from '../../lib/ses-email.js';

type UserPublic = {
  id: string;
  email: string;
  name: string;
  avatarKey: string | null;
  avatarUrl: string | null;
};

const toPublic = async (user: {
  id: string;
  email: string;
  name: string;
  avatarKey: string | null;
}): Promise<UserPublic> => ({
  id: user.id,
  email: user.email,
  name: user.name,
  avatarKey: user.avatarKey,
  avatarUrl: user.avatarKey
    ? await getPresignedUrl(env.S3_BUCKET_NAME, user.avatarKey)
    : null,
});

export const listUsers = async (): Promise<UserPublic[]> => {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarKey: users.avatarKey,
    })
    .from(users);

  return Promise.all(rows.map(toPublic));
};

export const getUser = async (id: string): Promise<UserPublic> => {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarKey: users.avatarKey,
    })
    .from(users)
    .where(eq(users.id, id));

  if (!user) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  return toPublic(user);
};

export const createUser = async (data: {
  email: string;
  password: string;
  name: string;
}): Promise<UserPublic> => {
  const passwordHash = await bcrypt.hash(data.password, 10);

  let inserted: { id: string; email: string; name: string; avatarKey: string | null }[];

  try {
    inserted = await db
      .insert(users)
      .values({ email: data.email, passwordHash, name: data.name })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarKey: users.avatarKey,
      });
  } catch (err) {
    // PostgreSQL unique constraint violation code: 23505
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      throw Object.assign(new Error('Email already in use'), { statusCode: 409 });
    }
    throw err;
  }

  const result = await toPublic(inserted[0]);

  // Fire-and-forget: do not block response on email delivery
  sendWelcomeEmail(result.email, result.name).catch((err) => {
    console.error('Failed to send welcome email:', err);
  });

  return result;
};

export const updateUser = async (
  id: string,
  data: { name?: string; email?: string; password?: string },
  avatarFile?: { buffer: Buffer; mimetype: string },
): Promise<UserPublic> => {
  // Verify user exists and get current avatar key
  const [existing] = await db
    .select({ id: users.id, avatarKey: users.avatarKey })
    .from(users)
    .where(eq(users.id, id));

  if (!existing) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  const updates: Partial<{
    name: string;
    email: string;
    passwordHash: string;
    avatarKey: string;
    updatedAt: Date;
  }> = { updatedAt: new Date() };

  if (data.name !== undefined) updates.name = data.name;
  if (data.email !== undefined) updates.email = data.email;
  if (data.password !== undefined) {
    updates.passwordHash = await bcrypt.hash(data.password, 10);
  }

  if (avatarFile) {
    // Delete old avatar from S3 if it exists
    if (existing.avatarKey) {
      await deleteFromS3(env.S3_BUCKET_NAME, existing.avatarKey);
    }
    const newKey = `avatars/${id}-${Date.now()}`;
    await uploadToS3(env.S3_BUCKET_NAME, newKey, avatarFile.buffer, avatarFile.mimetype);
    updates.avatarKey = newKey;
  }

  let updated: { id: string; email: string; name: string; avatarKey: string | null }[];

  try {
    updated = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarKey: users.avatarKey,
      });
  } catch (err) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      throw Object.assign(new Error('Email already in use'), { statusCode: 409 });
    }
    throw err;
  }

  return toPublic(updated[0]);
};

export const deleteUser = async (id: string): Promise<void> => {
  const [user] = await db
    .select({ id: users.id, avatarKey: users.avatarKey })
    .from(users)
    .where(eq(users.id, id));

  if (!user) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  if (user.avatarKey) {
    await deleteFromS3(env.S3_BUCKET_NAME, user.avatarKey);
  }

  // Cascade in DB handles refresh_tokens deletion
  await db.delete(users).where(eq(users.id, id));
};
