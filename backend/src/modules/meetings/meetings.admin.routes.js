import express from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { getMeetings } from './meetings.controller.js';

const router = express.Router();
router.get('/', authenticate, authorize('admin', 'agendadora', 'vendedora'), getMeetings);
export default router;
