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
app.use(cors());
app.use(express.json());
app.use('/api', gameRoutes);

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

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
