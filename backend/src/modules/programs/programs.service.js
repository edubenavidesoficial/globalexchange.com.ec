import { findActivePrograms } from './programs.repository.js';

export async function getActivePrograms() {
    const programs = await findActivePrograms();

    return programs.map((program) => ({
        id: program.id,
        code: program.code,
        name: program.name,
        slug: program.slug,
        category: program.category,
        description: program.description,
        imagePath: program.image_path,
        pageUrl: program.page_url,
        color: program.color,
        destinationMode: program.destination_mode,
        ageMode: program.age_mode,
        ageMin: program.age_min,
        ageMax: program.age_max,
        ageVerified: program.age_verified,
        priority: program.priority,
        destinations: program.program_destinations.map((association) => ({
            code: association.destinations.code,
            name: association.destinations.name,
            ageMin: association.age_min,
            ageMax: association.age_max,
            ageVerified: association.age_verified,
        })),
    }));
}
