export function errorHandler(error, req, res, next) {
    const statusCode = error.statusCode || 500;

    if (statusCode >= 500) {
        console.error(error);
    }

    res.status(statusCode).json({
        error: {
            message:
                statusCode >= 500
                    ? 'Ocurrió un error interno en el servidor.'
                    : error.message,
        },
    });
}