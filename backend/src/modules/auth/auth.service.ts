import bcrypt from 'bcryptjs';
import { and, eq, gt } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config/db.js';
import { refreshTokens, users } from '../../db/schema/index.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/token.js';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const login = async (
  email: string,
  password: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string; avatarKey: string | null };
}> => {
  const [user] = await db.select().from(users).where(eq(users.email, email));

  if (!user) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 400 });
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 400 });
  }

  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);
  const tokenHash = await bcrypt.hash(refreshToken, 10);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await db.insert(refreshTokens).values({
    id: uuidv4(),
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, name: user.name, avatarKey: user.avatarKey },
  };
};

export const logout = async (userId: string, _rawRefreshToken: string): Promise<void> => {
  // Delete ALL refresh tokens for this user — simple but acceptable for this project
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
};

export const refreshSession = async (
  rawRefreshToken: string,
): Promise<{ accessToken: string; newRefreshToken: string }> => {
  const payload = verifyRefreshToken(rawRefreshToken);
  if (!payload) {
    throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });
  }

  const { userId } = payload;
  const now = new Date();

  // Fetch all non-expired tokens for this user
  const storedTokens = await db
    .select()
    .from(refreshTokens)
    .where(and(eq(refreshTokens.userId, userId), gt(refreshTokens.expiresAt, now)));

  // Find the token that matches via bcrypt comparison
  let matchedTokenId: string | null = null;
  for (const stored of storedTokens) {
    const matches = await bcrypt.compare(rawRefreshToken, stored.tokenHash);
    if (matches) {
      matchedTokenId = stored.id;
      break;
    }
  }

  if (!matchedTokenId) {
    // Valid JWT but no matching DB token — possible token reuse after theft.
    // Purge ALL refresh tokens for this user as a security measure.
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
    throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });
  }

  // Rotate — delete matched token, issue new pair
  await db.delete(refreshTokens).where(eq(refreshTokens.id, matchedTokenId));

  const accessToken = signAccessToken(userId);
  const newRefreshToken = signRefreshToken(userId);
  const tokenHash = await bcrypt.hash(newRefreshToken, 10);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await db.insert(refreshTokens).values({
    id: uuidv4(),
    userId,
    tokenHash,
    expiresAt,
  });

  return { accessToken, newRefreshToken };
};

export const me = async (
  userId: string,
): Promise<{ id: string; email: string; name: string; avatarKey: string | null }> => {
  const [user] = await db.select().from(users).where(eq(users.id, userId));

  if (!user) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  return { id: user.id, email: user.email, name: user.name, avatarKey: user.avatarKey };
};
