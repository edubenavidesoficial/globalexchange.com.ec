import { cancelMeeting, confirmMeeting, listMeetings, rescheduleMeeting } from './meetings.service.js';
import { MeetingError } from './meetings.errors.js';

export async function getMeetings(req, res, next) {
    try {
        const start = req.originalUrl.indexOf('?');
        const data = await listMeetings(start < 0 ? '' : req.originalUrl.slice(start + 1), req.user);
        res.status(200).json({ data });
    } catch (error) {
        next(error);
    }
}

export async function postConsultationMeeting(req, res, next) {
    try {
        const idempotencyKey = requireIdempotencyKey(req);
        const result = await confirmMeeting({
            actorId: req.user.id,
            consultationRequestId: req.params.id,
            idempotencyKey,
            body: req.body,
        });
        // La RPC no distingue creación de replay: ambos retornan 201.
        res.status(201).json({ data: result });
    } catch (error) {
        next(error);
    }
}

function requireIdempotencyKey(req) {
    // Contar rawHeaders antes de que una lectura normal oculte duplicados.
    let count = 0;
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
        if (req.rawHeaders[i].toLowerCase() === 'idempotency-key') count++;
    }
    if (count !== 1) throw new MeetingError('INVALID_IDEMPOTENCY_KEY');
    return req.get('Idempotency-Key');
}

export async function patchMeetingSchedule(req, res, next) {
    try {
        if (!req.is('application/json')) throw new MeetingError('INVALID_REQUEST');
        const data = await rescheduleMeeting({ actorId: req.user.id, meetingId: req.params.id,
            idempotencyKey: requireIdempotencyKey(req), body: req.body });
        res.status(200).json({ data });
    } catch (error) { next(error); }
}

export async function patchMeetingCancel(req, res, next) {
    try {
        if (!req.is('application/json')) throw new MeetingError('INVALID_REQUEST');
        const data = await cancelMeeting({ actorId: req.user.id, meetingId: req.params.id,
            idempotencyKey: requireIdempotencyKey(req), body: req.body });
        res.status(200).json({ data });
    } catch (error) { next(error); }
}
