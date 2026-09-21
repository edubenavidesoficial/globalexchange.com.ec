import supabase from '../../config/supabase.js';

export async function findActivePrograms() {
    const { data, error } = await supabase
        .from('programs')
        .select(`
            id, code, name, slug, category, description,
            image_path, page_url, color, destination_mode,
            age_mode, age_min, age_max, age_verified, priority,
            program_destinations (
                age_min, age_max, age_verified,
                destinations!inner (code, name)
            )
        `)
        .eq('active', true)
        .eq('include_in_finder', true)
        .eq('program_destinations.active', true)
        .eq('program_destinations.destinations.active', true)
        .order('priority', { ascending: false });

    if (error) {
        throw error;
    }

    return data;
}
