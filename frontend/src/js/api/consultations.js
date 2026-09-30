export async function createConsultation(payload) {
    let response;

    try {
        response = await fetch('/api/consultations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
    } catch {
        throw new Error('No se pudo conectar. Revisa tu conexión e intenta nuevamente.');
    }

    const body = await response.json().catch(() => null);

    if (!response.ok) {
        const message = body?.error?.message;
        throw new Error(
            typeof message === 'string' && message.trim()
                ? message
                : 'No se pudo registrar la solicitud. Intenta nuevamente.'
        );
    }

    return body?.data;
}
