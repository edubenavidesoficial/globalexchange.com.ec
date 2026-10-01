import express from 'express';

import { errorHandler } from './middlewares/error-handler.js';
import authRouter from './modules/auth/auth.routes.js';
import consultationsRouter from './modules/consultations/consultations.routes.js';
import programsRouter from './modules/programs/programs.routes.js';

const app = express();

app.use(express.json());

app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'Global Exchange API funcionando correctamente',
    });
});

app.use('/api/consultations', consultationsRouter);
app.use('/api/programs', programsRouter);
app.use('/api/auth', authRouter);

app.use(errorHandler);

export default app;
