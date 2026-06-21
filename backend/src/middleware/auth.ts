import { Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { RequestWithId } from './logger';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-at-least-32-chars-long';

/**
 * Authentication Middleware.
 * Decodes JWT headers and populates req.user.
 */
export const authMiddleware = (req: RequestWithId, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      requestId: req.id,
      error: {
        message: 'Access denied. No authentication token provided.',
        status: 401,
      },
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      requestId: req.id,
      error: {
        message: 'Access denied. Invalid or expired token.',
        status: 401,
      },
    });
  }
};
