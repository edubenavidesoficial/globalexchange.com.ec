import supabase from '../../config/supabase.js';

export async function findMeetings({ fromUTC, toUTC, assignedUserId }) {
    // Hints por columnas FK declaradas en las migraciones, no por inferencia
    // entre las tres relaciones meetings -> internal_users.
    let query = supabase.from('meetings').select(`
        id, consultation_request_id, scheduled_at, time_zone, duration_minutes,
        mode, status, version,
        consultation:consultation_requests!consultation_request_id (
            id, full_name, phone, email,
            program:programs!program_id (id, code, name)
        ),
        assigned_user:internal_users!assigned_to (id, full_name)
    `, { count: 'exact' })
        .gte('scheduled_at', fromUTC).lt('scheduled_at', toUTC);
    if (assignedUserId !== null) query = query.eq('assigned_to', assignedUserId);
    const { data, error, count } = await query
        .order('scheduled_at', { ascending: true }).order('id', { ascending: true });
    if (error) throw error;
    // PostgREST puede limitar filas por configuración. Nunca presentar un
    // calendario parcial como si estuviese completo, ni paginar silenciosamente.
    if (!Array.isArray(data) || !Number.isInteger(count) || count !== data.length) {
        throw new Error('Incomplete meetings response');
    }
    return data;
}

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
