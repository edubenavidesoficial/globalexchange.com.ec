import supabase from '../../config/supabase.js';

export async function findInternalUserById(id) {
    const { data, error } = await supabase
        .from('internal_users')
        .select('id, full_name, role, active')
        .eq('id', id)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
}
