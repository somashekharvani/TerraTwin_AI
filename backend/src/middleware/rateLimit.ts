import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import { RequestWithId } from './logger';

/**
 * Global Rate Limiter middleware.
 * Restricts client requests to 100 requests per hour per IP.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: (req: Request) => {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return 1000;
    }
    return 300;
  },
  standardHeaders: true, // Return rate limit info in standard headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  handler: (req: Request, res: any) => {
    const customReq = req as RequestWithId;
    res.status(429).json({
      requestId: customReq.id || 'unknown',
      error: {
        message: 'Too many requests. API rate limit exceeded.',
        status: 429,
      },
    });
  },
});
