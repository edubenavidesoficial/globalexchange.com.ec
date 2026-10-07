import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../src/errors/app-error.js';
import { errorHandler } from '../src/middlewares/error-handler.js';

const generic = 'Ocurrió un error interno en el servidor.';
const sensitive = 'password=synthetic-secret SELECT * FROM users';

function handle(t, error) {
    const logs = [];
    t.mock.method(console, 'error', (...args) => logs.push(args));
    const response = {};
    const res = {
        status(status) { response.status = status; return res; },
        json(body) { response.body = body; return res; },
    };
    errorHandler(error, {
        headers: { authorization: 'Bearer synthetic-token', 'idempotency-key': 'synthetic-key' },
        body: { notes: 'private-notes', email: 'private@example.test', phone: 'private-phone' },
    }, res, () => assert.fail('Unexpected next'));
    return { response, logs };
}

for (const [status, message, code] of [
    [400, 'Datos inválidos.'],
    [403, 'Acceso denegado.'],
    [422, 'Campo inválido.', 'INVALID_FIELD'],
]) {
    test(`AppError ${status}: conserva contrato público`, t => {
        const error = new AppError(status, message, code);
        Object.assign(error, { details: sensitive, hint: sensitive, cause: new Error(sensitive), stack: sensitive });
        const { response, logs } = handle(t, error);
        assert.deepEqual(response, { status, body: { error: { ...(code ? { code } : {}), message } } });
        assert.deepEqual(logs, []);
    });
}

for (const statusCode of [undefined, 400, 404, 500]) {
    test(`Error desconocido statusCode=${statusCode}: respuesta y logs sanitizados`, t => {
        const error = new Error(sensitive);
        Object.assign(error, { statusCode, code: sensitive, expose: true,
            details: sensitive, hint: sensitive, cause: new Error(sensitive), stack: sensitive });
        const { response, logs } = handle(t, error);
        assert.deepEqual(response, { status: 500, body: { error: { message: generic } } });
        assert.deepEqual(logs, [[{ event: 'request_failed', statusCode: 500, code: 'INTERNAL_ERROR' }]]);
        assert.doesNotMatch(JSON.stringify({ response, logs }), /password|synthetic-secret|SELECT|details|hint|cause|stack|Bearer|synthetic-token|synthetic-key|private-/);
    });
}

test('objeto externo con status, code y expose no es AppError', t => {
    const { response, logs } = handle(t, { statusCode: 403, code: 'ACTOR_NOT_ALLOWED', expose: true, message: sensitive });
    assert.deepEqual(response, { status: 500, body: { error: { message: generic } } });
    assert.deepEqual(logs, [[{ event: 'request_failed', statusCode: 500, code: 'INTERNAL_ERROR' }]]);
});

test('AppError 500: mensaje genérico y solo código controlado en logs', t => {
    const { response, logs } = handle(t, new AppError(500, sensitive, 'INTERNAL_ERROR'));
    assert.deepEqual(response, { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: generic } } });
    assert.deepEqual(logs, [[{ event: 'request_failed', statusCode: 500, code: 'INTERNAL_ERROR' }]]);
});

test('fallo de parsing: traducción fija sin reflejar campos del parser', t => {
    const { response, logs } = handle(t, Object.assign(new Error(sensitive), {
        type: 'entity.parse.failed', statusCode: 500, code: sensitive, body: sensitive,
    }));
    assert.deepEqual(response, { status: 400, body: { error: { code: 'INVALID_JSON', message: 'El cuerpo JSON no es válido.' } } });
    assert.deepEqual(logs, []);
});
