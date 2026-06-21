import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface RequestWithId extends Request {
  id?: string;
  user?: { id: string; email: string };
}

/**
 * Performance and Request Monitoring Middleware.
 * Captures request details, correlation ID, execution duration, and server memory usage.
 */
export const loggerMiddleware = (req: RequestWithId, res: Response, next: NextFunction) => {
  const start = process.hrtime();
  // Ensure every request has a tracking ID
  req.id = (req.headers['x-request-id'] as string) || uuidv4();
  res.setHeader('X-Request-ID', req.id);

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
    const memory = process.memoryUsage();
    const heapMb = (memory.heapUsed / 1024 / 1024).toFixed(2);

    const logData = {
      requestId: req.id,
      timestamp: new Date().toISOString(),
      method: req.method,
      route: req.baseUrl + req.path,
      status: res.statusCode,
      duration: `${durationMs}ms`,
      memoryUsage: `${heapMb}MB`,
      userId: req.user?.id || 'anonymous',
    };

    // Print JSON formatting in production environment, simple logger in development
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(logData));
    } else {
      console.log(
        `[${logData.timestamp}] [${logData.requestId}] ${logData.method} ${logData.route} - ${logData.status} (${logData.duration}) - User: ${logData.userId} - Mem: ${logData.memoryUsage}`,
      );
    }
  });

  next();
};
