import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

// Plugin para incluir archivos HTML con @@include
function htmlInclude() {
    return {
        name: 'html-include',
        transformIndexHtml(html) {
            // Busca @@include('ruta/al/archivo.html')
            return html.replace(/@@include\(['"](.+?)['"]\)/g, (match, filePath) => {
                try {
                    const fullPath = resolve(process.cwd(), filePath);
                    // Lee el contenido del archivo
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    return content;
                } catch (error) {
                    console.error(`❌ Error al incluir: ${filePath}`, error.message);
                    return `<!-- ERROR: No se pudo incluir ${filePath} -->`;
                }
            });
        }
    };
}

export default defineConfig({
    plugins: [htmlInclude()],
    server: {
        port: 3000,
        open: true
    },
    build: {
        outDir: 'dist',
        assetsDir: 'assets'
    }
});