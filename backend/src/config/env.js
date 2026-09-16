import 'dotenv/config';

const requiredEnvVariables = [
    'SUPABASE_URL',
    'SUPABASE_SECRET_KEY',
];

for (const variable of requiredEnvVariables) {
    if (!process.env[variable]) {
        throw new Error(
            `Falta la variable de entorno requerida: ${variable}`
        );
    }
}

const env = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT) || 3000,

    supabase: {
        url: process.env.SUPABASE_URL,
        secretKey: process.env.SUPABASE_SECRET_KEY,
    },
};

export default env;