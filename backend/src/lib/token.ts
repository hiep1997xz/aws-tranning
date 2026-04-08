import jwt from 'jsonwebtoken';
import type { FastifyReply } from 'fastify';
import { env } from '../config/env.js';

const ACCESS_TOKEN_MAX_AGE_SEC = 15 * 60; // 15 minutes
const REFRESH_TOKEN_MAX_AGE_SEC = 7 * 24 * 60 * 60; // 7 days

export const signAccessToken = (userId: string): string => {
  return jwt.sign({ userId }, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_MAX_AGE_SEC });
};

export const signRefreshToken = (userId: string): string => {
  return jwt.sign({ userId }, env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_MAX_AGE_SEC });
};

export const verifyAccessToken = (token: string): { userId: string } | null => {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { userId: string };
    return { userId: payload.userId };
  } catch {
    return null;
  }
};

export const verifyRefreshToken = (token: string): { userId: string } | null => {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as { userId: string };
    return { userId: payload.userId };
  } catch {
    return null;
  }
};

export const setAuthCookies = (
  reply: FastifyReply,
  accessToken: string,
  refreshToken: string,
): void => {
  const isProduction = env.NODE_ENV === 'production';

  reply.setCookie('access_token', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: ACCESS_TOKEN_MAX_AGE_SEC,
    path: '/',
  });

  reply.setCookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api/auth/refresh',
    maxAge: REFRESH_TOKEN_MAX_AGE_SEC,
  });
};

export const clearAuthCookies = (reply: FastifyReply): void => {
  const isProduction = env.NODE_ENV === 'production';
  reply.clearCookie('access_token', { path: '/', httpOnly: true, secure: isProduction, sameSite: 'strict' });
  reply.clearCookie('refresh_token', {
    path: '/api/auth/refresh',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
  });
};
