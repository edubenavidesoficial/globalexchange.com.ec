import { getActivePrograms } from './programs.service.js';

export async function getPrograms(req, res, next) {
    try {
        const programs = await getActivePrograms();
        res.status(200).json({ data: programs });
    } catch (error) {
        next(error);
    }
}
