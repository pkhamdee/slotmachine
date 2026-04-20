import { Router } from 'express';
import {
  registerPlayer,
  getPlayer,
  spin,
  getHistory,
} from '../controllers/gameController.js';
import sessionRoutes from './sessionRoutes.js';

const router = Router();

router.use(sessionRoutes);

router.post('/players', registerPlayer);
router.get('/players/:playerId', getPlayer);
router.post('/players/:playerId/spin', spin);
router.get('/players/:playerId/history', getHistory);

export default router;
