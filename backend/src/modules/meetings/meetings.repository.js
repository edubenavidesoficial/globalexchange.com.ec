import supabase from '../../config/supabase.js';

export async function createConsultationMeeting({ actorId, idempotencyKey, requestHash, payload }) {
    const { data, error } = await supabase.rpc('create_consultation_meeting', {
        p_actor_id: actorId,
        p_consultation_request_id: payload.consultationRequestId,
        p_idempotency_key: idempotencyKey,
        p_request_hash: requestHash,
        p_scheduled_date: payload.date,
        p_scheduled_time: payload.time,
        p_time_zone: payload.timeZone,
        p_duration_minutes: payload.durationMinutes,
        p_mode: payload.mode,
        p_assigned_to: payload.assignedTo,
        p_notes: payload.notes,
    });
    if (error) throw error;
    if (!data || typeof data !== 'object' || Array.isArray(data)
        || !data.consultation || typeof data.consultation !== 'object' || Array.isArray(data.consultation)
        || !data.meeting || typeof data.meeting !== 'object' || Array.isArray(data.meeting)) {
        throw new Error('Invalid RPC response');
    }
    return data;
}
