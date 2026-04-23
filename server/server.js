import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import gameRoutes from './src/routes/gameRoutes.js';
import sessionManager from './src/services/SessionManager.js';

// Use path relative to this file so .env is found regardless of CWD
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '.env') });

const app = express();

app.disable('x-powered-by');

// Restrict CORS to the configured origin (dev: Vite; prod: same-origin via Nginx)
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: corsOrigin }));

// Security headers on every API response
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'none'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'; navigate-to 'none'");
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  next();
});

app.use(express.json());
app.use('/api', gameRoutes);

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: corsOrigin } });

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const pubClient = new Redis(REDIS_URL);
const subClient = pubClient.duplicate();
pubClient.on('error', (err) => console.error('Redis pub error:', err.message));
subClient.on('error', (err) => console.error('Redis sub error:', err.message));
io.adapter(createAdapter(pubClient, subClient));

const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI;

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    sessionManager.init(io);
    await sessionManager.start();
    httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
