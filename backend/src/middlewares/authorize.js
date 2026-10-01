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
            const error = new Error('Se requiere una autenticación válida.');
            error.statusCode = 401;
            return next(error);
        }

        if (!roles.has(role)) {
            const error = new Error('No tienes permisos para realizar esta acción.');
            error.statusCode = 403;
            return next(error);
        }

        next();
    };
}
