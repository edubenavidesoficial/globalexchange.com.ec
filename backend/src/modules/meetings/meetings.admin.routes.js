import express from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { getMeetings, patchMeetingCancel, patchMeetingSchedule } from './meetings.controller.js';

const router = express.Router();
router.get('/', authenticate, authorize('admin', 'agendadora', 'vendedora'), getMeetings);
router.patch('/:id/schedule', authenticate, authorize('admin', 'agendadora'), patchMeetingSchedule);
router.patch('/:id/cancel', authenticate, authorize('admin', 'agendadora'), patchMeetingCancel);
export default router;
