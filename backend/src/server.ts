import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { prisma } from './db';
import { loggerMiddleware } from './middleware/logger';
import { errorHandler } from './middleware/errorHandler';
import { apiRateLimiter } from './middleware/rateLimit';

const app = express();

// Disable x-powered-by to protect technology signatures
app.disable('x-powered-by');

// Configure Helmet security headers
app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      // Dynamically echo the origin to support credentials and prevent CORS blocks on Vercel
      callback(null, true);
    },
    credentials: true,
  }),
);

// Body parser configuration
app.use(express.json());

// Global API rate limiting (100 req/hour)
app.use('/api/', apiRateLimiter);

// Disable caching for API calls to prevent 304 stale data mismatches
app.use('/api/', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Logger and execution time monitoring middleware
app.use(loggerMiddleware);

// Health Check Endpoint (Verifies active database connection)
app.get('/api/v1/health', async (req, res) => {
  try {
    // Run simple query to test active connections
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'ok',
      database: 'connected',
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: error.message,
    });
  }
});

// API Documentation Explorer Endpoint
app.get('/api/v1/docs', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>TerraTwin AI API Docs</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; line-height: 1.6; background: #0f172a; color: #f1f5f9; max-width: 900px; margin: 0 auto; }
          h1 { color: #10b981; border-bottom: 2px solid #1e293b; padding-bottom: 10px; }
          pre { background: #1e293b; padding: 15px; border-radius: 6px; overflow-x: auto; border: 1px solid #334155; color: #38bdf8; }
          .endpoint { border-bottom: 1px solid #1e293b; padding: 20px 0; }
          .method { font-weight: bold; padding: 4px 10px; border-radius: 4px; color: #fff; font-size: 0.85em; margin-right: 10px; }
          .get { background: #059669; }
          .post { background: #2563eb; }
          code { font-family: monospace; font-size: 1.1em; color: #34d399; }
        </style>
      </head>
      <body>
        <h1>TerraTwin AI API Docs (v1)</h1>
        <p>Production-ready REST APIs. Standard URL prefix: <code>/api/v1</code></p>
        
        <div class="endpoint">
          <h3><span class="method get">GET</span> <code>/api/v1/health</code></h3>
          <p>Verifies Express server lifecycle and database connections.</p>
          <pre>Response (200 OK):
{
  "status": "ok",
  "database": "connected"
}</pre>
        </div>

        <div class="endpoint">
          <h3><span class="method post">POST</span> <code>/api/v1/auth/register</code></h3>
          <p>Registers a new account. Returns JWT session token.</p>
        </div>

        <div class="endpoint">
          <h3><span class="method post">POST</span> <code>/api/v1/auth/login</code></h3>
          <p>Log in with email/password. Returns JWT session token.</p>
        </div>

        <div class="endpoint">
          <h3><span class="method get">GET</span> <code>/api/v1/carbon/entries</code></h3>
          <p>Fetches pagination list of user carbon logs.</p>
        </div>

        <div class="endpoint">
          <h3><span class="method post">POST</span> <code>/api/v1/carbon/entries</code></h3>
          <p>Adds a new manual carbon measurement entry.</p>
        </div>

        <div class="endpoint">
          <h3><span class="method post">POST</span> <code>/api/v1/track/location</code></h3>
          <p>Processes background GPS updates, detects commute modes, and logs carbon.</p>
        </div>
      </body>
    </html>
  `);
});

import authRouter from './routes/auth';
import carbonRouter from './routes/carbon';
import trackRouter from './routes/track';
import devicesRouter from './routes/devices';
import visionRouter from './routes/vision';
import agentRouter from './routes/agent';
import tokensRouter from './routes/tokens';
import twinRouter from './routes/twin';

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/carbon', carbonRouter);
app.use('/api/v1/track', trackRouter);
app.use('/api/v1/devices', devicesRouter);
app.use('/api/v1/vision', visionRouter);
app.use('/api/v1/agent', agentRouter);
app.use('/api/v1/tokens', tokensRouter);
app.use('/api/v1/twin', twinRouter);

if (process.env.NODE_ENV === 'test') {
  app.get('/api/v1/test-error', (req, res) => {
    throw new Error('Triggered server error');
  });
}

// Error Handler Middleware
app.use(errorHandler);

export default app;
