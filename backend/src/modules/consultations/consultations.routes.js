import express from 'express';

import {
    createConsultationRequest,
} from './consultations.controller.js';

const router = express.Router();

router.post('/', createConsultationRequest);

export default router;