import { AppError } from '../errors/app-error.js';

export function errorHandler(error, req, res, next) {
    if (error?.type === 'entity.parse.failed') {
        return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'El cuerpo JSON no es válido.' } });
    }
    const controlled = error instanceof AppError;
    const statusCode = controlled ? error.statusCode : 500;

    if (statusCode >= 500) {
        // Las causas del proveedor pueden incluir tokens, SQL o datos personales.
        console.error({ event: 'request_failed', statusCode,
            code: controlled ? (error.code ?? 'INTERNAL_ERROR') : 'INTERNAL_ERROR' });
    }

    res.status(statusCode).json({
        error: {
            ...(controlled && error.code !== undefined ? { code: error.code } : {}),
            message:
                statusCode >= 500
                    ? 'Ocurrió un error interno en el servidor.'
                    : error.message,
        },
    });
}
