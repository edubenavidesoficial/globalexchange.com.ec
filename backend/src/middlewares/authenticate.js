import {
    isAuthApiError,
    isAuthSessionMissingError,
} from '@supabase/supabase-js';

import supabase from '../config/supabase.js';
import { AppError } from '../errors/app-error.js';
import { findInternalUserById } from '../modules/internal-users/internal-users.repository.js';

const INVALID_IDENTITY_CODES = new Set([
    'bad_jwt',
    'no_authorization',
    'user_not_found',
    'session_not_found',
    'session_expired',
    'user_banned',
]);

function authenticationError() {
    return new AppError(401, 'Se requiere una autenticación válida.');
}

function isInvalidIdentity(error) {
    return isAuthSessionMissingError(error) || (
        isAuthApiError(error) &&
        error.status >= 400 && error.status < 500 && (
            INVALID_IDENTITY_CODES.has(error.code) ||
            (!error.code && [401, 403].includes(error.status))
        )
    );
}

export async function authenticate(req, res, next) {
    const authorization = req.headers.authorization;
    const match = typeof authorization === 'string'
        ? /^Bearer +(\S+)$/i.exec(authorization)
        : null;

    if (!match || match[0] !== authorization) {
        return next(authenticationError());
    }

    let identity;
    try {
        const { data, error } = await supabase.auth.getUser(match[1]);

        if (error) {
            throw error;
        }

        identity = data?.user;
    } catch (error) {
        // Conservar la causa para diagnóstico; el error-handler sanitiza la respuesta.
        return next(isInvalidIdentity(error)
            ? authenticationError()
            : new Error('No se pudo verificar la identidad con el proveedor.', {
                cause: error,
            }));
    }

    if (!identity || typeof identity.id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity.id)) {
        return next(authenticationError());
    }

    let internalUser;
    try {
        internalUser = await findInternalUserById(identity.id);
    } catch (error) {
        return next(new Error('No se pudo consultar el perfil interno.', {
            cause: error,
        }));
    }

    if (!internalUser || internalUser.active !== true) {
        return next(new AppError(403, 'No tienes acceso al sistema interno.'));
    }

    req.user = {
        id: internalUser.id,
        fullName: internalUser.full_name,
        role: internalUser.role,
    };

    next();
}
