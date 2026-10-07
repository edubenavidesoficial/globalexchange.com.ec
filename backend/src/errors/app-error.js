// Solo para mensajes y códigos públicos definidos por la aplicación.
// Nunca construir con mensajes, códigos o estados recibidos de proveedores.
export class AppError extends Error {
    constructor(statusCode, message, code) {
        super(message);
        this.statusCode = statusCode;
        if (code !== undefined) this.code = code;
    }
}
