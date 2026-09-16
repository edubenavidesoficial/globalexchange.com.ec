import app from './app.js';
import env from './config/env.js';

app.listen(env.port, () => {
    console.log(
        `Global Exchange API ejecutándose en http://localhost:${env.port}`
    );
});