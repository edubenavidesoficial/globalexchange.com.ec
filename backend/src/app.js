import express from 'express';

const app = express();

app.use(express.json());

app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'Global Exchange API funcionando correctamente',
    });
});

export default app;