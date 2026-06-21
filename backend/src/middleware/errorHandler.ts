import { Response, NextFunction } from 'express';
import { RequestWithId } from './logger';

/**
 * Centered Error Handler Middleware.
 * Catches all route exceptions, correlates with Request ID, and formats uniform JSON error responses.
 */
export const errorHandler = (err: any, req: RequestWithId, res: Response, next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const requestId = req.id || 'unknown';

  const errorResponse = {
    requestId,
    error: {
      message: status === 500 && process.env.NODE_ENV === 'production' ? 'Internal Server Error' : message,
      status,
    },
  };

  // Log error with correlation ID
  if (process.env.NODE_ENV === 'production') {
    console.error(
      JSON.stringify({
        requestId,
        timestamp: new Date().toISOString(),
        level: 'error',
        status,
        message,
      }),
    );
  } else {
    console.error(
      `[${new Date().toISOString()}] [${requestId}] [ERROR] Status: ${status} - Message: ${message}\n${err.stack || ''}`,
    );
  }

  // Prevent double response
  if (res.headersSent) {
    return next(err);
  }

  res.status(status).json(errorResponse);
};
