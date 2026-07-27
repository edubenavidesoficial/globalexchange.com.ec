import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

function htmlInclude() {
    return {
        name: 'html-include',
        transformIndexHtml(html) {
            console.log('🔍 Procesando index.html con htmlInclude...');
            let replacedCount = 0;
            const result = html.replace(/@@include\(['"](.+?)['"]\)/g, (match, filePath) => {
                replacedCount++;
                const fullPath = resolve(process.cwd(), filePath);
                console.log(`📄 Incluyendo archivo #${replacedCount}: ${filePath} → ${fullPath}`);
                try {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    console.log(`✅ Leído: ${fullPath} (${content.length} caracteres)`);
                    // Buscar si contiene el JSON de Typed
                    if (content.includes('settings--937c14f')) {
                        console.log(`🎯 ¡Encontrado settings--937c14f en ${filePath}!`);
                    }
                    return content;
                } catch (error) {
                    console.error(`❌ Error al incluir: ${filePath}`, error.message);
                    return `<!-- ERROR: No se pudo incluir ${filePath} -->`;
                }
            });
            console.log(`✅ Total de includes procesados: ${replacedCount}`);
            return result;
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