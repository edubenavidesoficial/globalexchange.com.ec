import express from 'express';

import { authenticate } from '../../middlewares/authenticate.js';
import { getCurrentUser } from './auth.controller.js';

const router = express.Router();

router.get('/me', authenticate, getCurrentUser);

export default router;
