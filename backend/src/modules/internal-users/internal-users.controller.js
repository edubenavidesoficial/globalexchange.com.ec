import { listAssignableSaleswomen } from './internal-users.service.js';

export async function getAssignableSaleswomen(req, res, next) {
    try {
        // originalUrl conserva la query completa incluso dentro del router montado.
        const queryStart = req.originalUrl.indexOf('?');
        const rawQuery = queryStart === -1 ? '' : req.originalUrl.slice(queryStart + 1);
        const users = await listAssignableSaleswomen(rawQuery);
        res.status(200).json({ data: users });
    } catch (error) {
        next(error);
    }
}
