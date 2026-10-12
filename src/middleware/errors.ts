import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}
export const fail = (status: number, code: string, message: string, details?: unknown): never => { throw new ApiError(status, code, message, details); };
export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  if (err instanceof ZodError) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.issues } }); return; }
  if (err instanceof Prisma.PrismaClientKnownRequestError || err instanceof Prisma.PrismaClientUnknownRequestError) {
    if (err.message.includes('23P01') || err.message.includes('Show_no_overlap')) err = new ApiError(409, 'SCHEDULE_CONFLICT', 'This show overlaps an existing show');
    else if (err.message.includes('23001') || err.message.includes('23503')) err = new ApiError(409, 'DEPENDENT_RECORDS', 'This record has dependent history and cannot be deleted');
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') err = new ApiError(409, 'DUPLICATE', 'A record with these details already exists');
    else if (err.code === 'P2003') err = new ApiError(409, 'DEPENDENT_RECORDS', 'This record has dependent history and cannot be deleted');
    else if (err.code === 'P2025') err = new ApiError(404, 'NOT_FOUND', 'Record not found');
    else if (JSON.stringify(err.meta).includes('23P01') || err.message.includes('Show_no_overlap')) err = new ApiError(409, 'SCHEDULE_CONFLICT', 'This show overlaps an existing show');
  }
  if (err instanceof ApiError) { res.status(err.status).json({ error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } }); return; }
  if (err instanceof SyntaxError || (typeof err === 'object' && err !== null && 'status' in err && err.status === 413)) { res.status(400).json({error:{code:'INVALID_BODY',message:'Invalid or oversized JSON body'}}); return; }
  console.error('Request failed', err instanceof Error ? err.name : 'UnknownError');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
};

