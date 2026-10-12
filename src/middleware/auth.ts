import type { RequestHandler } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { db } from '../db.js';
import { config } from '../config.js';
import { fail } from './errors.js';
declare module 'express-session' { interface SessionData { userId: string; csrfToken: string } }
declare global { namespace Express { interface Request { user?: { id: string; name: string; email: string; role: 'CUSTOMER' | 'ADMIN' } } } }
export const publicUser = { id: true, name: true, email: true, role: true } as const;
export const loadUser: RequestHandler = async (req, _res, next) => {
  if (req.session.userId) req.user = await db.user.findUnique({ where: { id: req.session.userId }, select: publicUser }) ?? undefined;
  next();
};
export const authenticated: RequestHandler = (req, _res, next) => { if (!req.user) return fail(401, 'UNAUTHENTICATED', 'Sign in to continue'); next(); };
export const customer: RequestHandler = (req, _res, next) => { if (!req.user) return fail(401, 'UNAUTHENTICATED', 'Sign in to continue'); if (req.user.role !== 'CUSTOMER') return fail(403, 'FORBIDDEN', 'Customer access required'); next(); };
export const admin: RequestHandler = (req, _res, next) => { if (!req.user) return fail(401, 'UNAUTHENTICATED', 'Sign in to continue'); if (req.user.role !== 'ADMIN') return fail(403, 'FORBIDDEN', 'Administrator access required'); next(); };
export const csrf: RequestHandler = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin && origin !== config.FRONTEND_ORIGIN) return fail(403, 'CSRF_REJECTED', 'Origin is not allowed');
  const token = req.get('x-csrf-token');
  const expected = req.session.csrfToken;
  if (!token || !expected || Buffer.byteLength(token) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return fail(403, 'CSRF_REJECTED', 'A valid CSRF token is required');
  next();
};
export function token() { return randomBytes(32).toString('hex'); }
