import express from 'express';

import programsRouter from './modules/programs/programs.routes.js';

const app = express();

app.use(express.json());

app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'Global Exchange API funcionando correctamente',
    });
});

app.use('/api/programs', programsRouter);

export default app;