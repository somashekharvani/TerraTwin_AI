import { Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { RequestWithId } from './logger';

/**
 * Validation Middleware.
 * Validates request bodies against a Zod schema, returning clean 400 Bad Request descriptions on failure.
 */
export const validateBody = (schema: ZodSchema) => {
  return async (req: RequestWithId, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          requestId: req.id,
          error: {
            message: 'Input payload validation failed.',
            status: 400,
            details: error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
        });
      }
      next(error);
    }
  };
};
