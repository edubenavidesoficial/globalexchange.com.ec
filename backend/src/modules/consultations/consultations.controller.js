import { createConsultation, listConsultations } from './consultations.service.js';

export async function getConsultations(req, res, next) {
    try {
        const consultations = await listConsultations();
        res.status(200).json({ data: consultations });
    } catch (error) {
        next(error);
    }
}

export async function createConsultationRequest(req, res, next) {
    try {
        const consultation = await createConsultation(req.body);

        res.status(201).json({
            data: consultation,
        });
    } catch (error) {
        next(error);
    }
}