import express from 'express';

import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { getConsultations } from './consultations.controller.js';

const router = express.Router();

router.get('/', authenticate, authorize('admin', 'agendadora', 'vendedora'), getConsultations);

export default router;
