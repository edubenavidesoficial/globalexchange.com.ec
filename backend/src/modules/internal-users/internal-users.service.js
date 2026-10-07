import { URLSearchParams } from 'node:url';
import { AppError } from '../../errors/app-error.js';
import { findAssignableSaleswomen } from './internal-users.repository.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listAssignableSaleswomen(rawQuery) {
    // URLSearchParams procesa todos los pares y conserva nombres duplicados.
    const params = new URLSearchParams(rawQuery);
    if (params.size !== 2 || params.getAll('role').length !== 1 ||
        params.getAll('active').length !== 1 ||
        params.get('role') !== 'vendedora' || params.get('active') !== 'true') {
        throw new AppError(400, 'Los filtros deben ser role=vendedora y active=true.');
    }

    const users = await findAssignableSaleswomen();
    if (!Array.isArray(users) || users.some(user =>
        !user || typeof user !== 'object' || Array.isArray(user) ||
        typeof user.id !== 'string' || user.id.length !== 36 || !UUID.test(user.id) ||
        typeof user.full_name !== 'string' || user.full_name.trim().length === 0 ||
        user.role !== 'vendedora')) {
        throw new Error('Invalid internal users response');
    }
    return users.map(user => ({
        id: user.id,
        fullName: user.full_name,
        role: user.role,
    }));
}
