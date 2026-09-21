import express from 'express';

import { getPrograms } from './programs.controller.js';

const router = express.Router();

router.get('/', getPrograms);

export default router;
