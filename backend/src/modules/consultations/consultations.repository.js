import supabase from '../../config/supabase.js';

export async function findConsultations() {
    const { data, error } = await supabase
        .from('consultation_requests')
        .select(`
            id,
            program_id,
            full_name,
            phone,
            email,
            city,
            mode,
            preferred_date,
            preferred_time,
            message,
            status,
            created_at,
            program:programs (id, code, name)
        `)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

    if (error) {
        throw error;
    }

    return data;
}

export async function findActiveProgramByCode(programCode) {
    const { data, error } = await supabase
        .from('programs')
        .select('id, code, name')
        .eq('code', programCode)
        .eq('active', true)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
}

export async function createConsultationRequest(consultation) {
    const { data, error } = await supabase
        .from('consultation_requests')
        .insert({
            program_id: consultation.programId,
            full_name: consultation.fullName,
            phone: consultation.phone,
            email: consultation.email,
            city: consultation.city,
            mode: consultation.mode,
            preferred_date: consultation.preferredDate,
            preferred_time: consultation.preferredTime,
            message: consultation.message,
        })
        .select(`
            id,
            program_id,
            full_name,
            phone,
            email,
            city,
            mode,
            preferred_date,
            preferred_time,
            message,
            status,
            created_at
        `)
        .single();

    if (error) {
        throw error;
    }

    return data;
}