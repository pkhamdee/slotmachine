import { Router } from 'express';
import {
  getHallOfFame,
  getSessionState,
  startNextRound,
  resetTournament,
  purgeUsers,
  listPlayers,
  adminLogin,
} from '../controllers/sessionController.js';
import { requireAdminAuth } from '../middleware/adminAuth.js';

const router = Router();

router.get('/sessions/current', getSessionState);
router.get('/hall-of-fame', getHallOfFame);

router.post('/admin/login', adminLogin);
router.post('/admin/next-round', requireAdminAuth, startNextRound);
router.post('/admin/reset', requireAdminAuth, resetTournament);
router.post('/admin/purge-users', requireAdminAuth, purgeUsers);
router.get('/admin/players', requireAdminAuth, listPlayers);

export default router;
