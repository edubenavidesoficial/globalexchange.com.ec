import express from 'express';

import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { getConsultations } from './consultations.controller.js';
import { postConsultationMeeting } from '../meetings/meetings.controller.js';

const router = express.Router();

router.get('/', authenticate, authorize('admin', 'agendadora', 'vendedora'), getConsultations);
router.post('/:id/meeting', authenticate, authorize('admin', 'agendadora'), postConsultationMeeting);

export default router;
