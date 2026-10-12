import type { RequestHandler } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { db } from '../db.js';
import { publicUser, token } from '../middleware/auth.js';
import { fail } from '../middleware/errors.js';
const credentials = z.object({ email: z.string().trim().toLowerCase().max(254).pipe(z.email()), password: z.string().min(8).max(128) }).strict();
const registration = credentials.extend({ name: z.string().trim().min(1).max(100) });
const dummyHash = argon2.hash('not-a-user-password', { type: argon2.argon2id });
export const getCsrf: RequestHandler = (req, res) => { req.session.csrfToken ??= token(); res.json({ csrfToken: req.session.csrfToken }); };
export const register: RequestHandler = async (req, res) => {
  const input = registration.parse(req.body);
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  const user = await db.user.create({ data: { name: input.name, email: input.email, passwordHash, role: 'CUSTOMER' }, select: publicUser });
  res.status(201).json(user);
};
export const login: RequestHandler = async (req, res) => {
  const input = credentials.parse(req.body);
  const user = await db.user.findUnique({ where: { email: input.email } });
  const valid = await argon2.verify(user?.passwordHash ?? await dummyHash, input.password);
  if (!user || !valid) return fail(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  await new Promise<void>((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
  req.session.userId = user.id;
  req.session.csrfToken = token();
  await new Promise<void>((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, csrfToken: req.session.csrfToken });
};
export const logout: RequestHandler = async (req, res) => {
  await new Promise<void>((resolve, reject) => req.session.destroy(err => err ? reject(err) : resolve()));
  res.clearCookie('yozigo.sid', { path: '/' }); res.status(204).end();
};
export const me: RequestHandler = (req, res) => { res.json(req.user); };
