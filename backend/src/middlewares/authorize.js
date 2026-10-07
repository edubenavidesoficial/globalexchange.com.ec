import { AppError } from '../errors/app-error.js';

const VALID_ROLES = new Set(['admin', 'agendadora', 'vendedora']);

export function authorize(...allowedRoles) {
    if (allowedRoles.length === 0 ||
        allowedRoles.some(role => typeof role !== 'string' || !VALID_ROLES.has(role))) {
        throw new TypeError('authorize recibió una configuración de roles inválida.');
    }

    const roles = new Set(allowedRoles);

    return (req, res, next) => {
        const role = req.user?.role;

        if (typeof role !== 'string' || role.trim() === '') {
            return next(new AppError(401, 'Se requiere una autenticación válida.'));
        }

        if (!roles.has(role)) {
            return next(new AppError(403, 'No tienes permisos para realizar esta acción.'));
        }

        next();
    };
}
