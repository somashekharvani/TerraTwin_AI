import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import app from './server';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Initialize Socket.io Server
export const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[WebSocket] Client connected: ${socket.id}`);
  }

  socket.on('disconnect', () => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
    }
  });
});

// Start Server Listening
server.listen(PORT, () => {
  console.log(
    `[Server] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`,
  );
});

// Graceful Shutdown Handler
const shutdown = () => {
  console.log('[Server] Gracefully shutting down...');
  server.close(() => {
    console.log('[Server] HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
