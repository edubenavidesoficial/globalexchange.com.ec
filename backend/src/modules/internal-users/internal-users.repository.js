import supabase from '../../config/supabase.js';

export async function findAssignableSaleswomen() {
    const { data, error } = await supabase
        .from('internal_users')
        .select('id, full_name, role')
        .eq('role', 'vendedora')
        .eq('active', true)
        .order('full_name', { ascending: true })
        .order('id', { ascending: true });

    if (error) {
        throw error;
    }

    return data;
}

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
