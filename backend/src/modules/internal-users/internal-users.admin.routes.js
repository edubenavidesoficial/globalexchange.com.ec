import express from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { getAssignableSaleswomen } from './internal-users.controller.js';

const router = express.Router();

router.get('/', authenticate, authorize('admin', 'agendadora'), getAssignableSaleswomen);

export default router;
