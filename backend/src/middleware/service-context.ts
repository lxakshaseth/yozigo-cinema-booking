import type { RequestHandler } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { config } from '../config.js';
import '../middleware/auth.js';
import { fail } from './errors.js';

const userIdSchema = z.string().uuid();
const roles = new Set(['CUSTOMER', 'ADMIN']);

export const requireGateway: RequestHandler = (req, _res, next) => {
  const supplied = req.get('x-yozigo-service-token') ?? '';
  const expected = config.INTERNAL_SERVICE_TOKEN;
  if (Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return fail(403, 'INTERNAL_ONLY', 'This service accepts requests from the API gateway only');
  }
  const id = req.get('x-yozigo-user-id');
  const role = req.get('x-yozigo-user-role');
  if (id || role) {
    const parsedId = userIdSchema.safeParse(id);
    if (!parsedId.success || !role || !roles.has(role)) return fail(403, 'INVALID_IDENTITY', 'The gateway identity is invalid');
    req.user = { id: parsedId.data, name: '', email: '', role: role as 'CUSTOMER' | 'ADMIN' };
  }
  next();
};
