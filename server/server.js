import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
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
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  next();
});

app.use(express.json());
app.use('/api', gameRoutes);

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: corsOrigin } });

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
