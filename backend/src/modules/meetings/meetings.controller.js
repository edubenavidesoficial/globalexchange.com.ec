import { confirmMeeting } from './meetings.service.js';
import { MeetingError } from './meetings.errors.js';

export async function postConsultationMeeting(req, res, next) {
    try {
        // rawHeaders permite detectar duplicados incluso si el servidor los combina.
        let count = 0;
        for (let i = 0; i < req.rawHeaders.length; i += 2) {
            if (req.rawHeaders[i].toLowerCase() === 'idempotency-key') count += 1;
        }
        if (count !== 1) throw new MeetingError('INVALID_IDEMPOTENCY_KEY');
        const result = await confirmMeeting({
            actorId: req.user.id,
            consultationRequestId: req.params.id,
            idempotencyKey: req.get('Idempotency-Key'),
            body: req.body,
        });
        // La RPC no distingue creación de replay: ambos retornan 201.
        res.status(201).json({ data: result });
    } catch (error) {
        next(error);
    }
}
