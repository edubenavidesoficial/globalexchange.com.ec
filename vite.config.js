import { defineConfig } from 'vite';
import { resolve, dirname, isAbsolute } from 'path';
import fs from 'fs';

function htmlInclude() {
    const includePattern = /@@include\(['"](.+?)['"]\)/g;

    /**
     * Procesa los includes de un archivo de forma recursiva.
     *
     * @param {string} html Contenido HTML.
     * @param {string} htmlFile Archivo HTML que contiene el include.
     * @param {Set<string>} includeStack Archivos abiertos para evitar ciclos.
     * @returns {string}
     */
    function processIncludes(
        html,
        htmlFile,
        includeStack = new Set()
    ) {
        return html.replace(
            includePattern,
            (match, includePath) => {
                /*
                 * Las rutas que empiezan con "/" se resuelven
                 * desde la raíz del proyecto.
                 *
                 * Las rutas relativas se resuelven desde la
                 * carpeta del HTML que contiene el include.
                 */
                const fullPath = isAbsolute(includePath)
                    ? resolve(
                        process.cwd(),
                        includePath.replace(/^[/\\]+/, '')
                    )
                    : resolve(
                        dirname(htmlFile),
                        includePath
                    );

                if (includeStack.has(fullPath)) {
                    console.error(
                        `❌ Include circular detectado: ${fullPath}`
                    );

                    return (
                        `<!-- ERROR: Include circular ${includePath} -->`
                    );
                }

                try {
                    const content = fs.readFileSync(
                        fullPath,
                        'utf-8'
                    );

                    console.log(
                        `✅ Incluido: ${includePath} → ${fullPath}`
                    );

                    const nextStack = new Set(includeStack);
                    nextStack.add(fullPath);

                    /*
                     * También procesa includes que estén dentro
                     * de los propios componentes.
                     */
                    return processIncludes(
                        content,
                        fullPath,
                        nextStack
                    );
                } catch (error) {
                    console.error(
                        `❌ No se pudo incluir: ${includePath}`,
                        `\nRuta calculada: ${fullPath}`,
                        `\nError: ${error.message}`
                    );

                    return (
                        `<!-- ERROR: No se pudo incluir ${includePath} -->`
                    );
                }
            }
        );
    }

    return {
        name: 'html-include',

        transformIndexHtml(html, ctx) {
            /*
             * ctx.filename contiene la ruta absoluta del
             * index.html que Vite está procesando.
             */
            const htmlFile = ctx.filename
                ? resolve(ctx.filename)
                : resolve(process.cwd(), 'index.html');

            console.log(
                `🔍 Procesando HTML: ${htmlFile}`
            );

            return processIncludes(
                html,
                htmlFile,
                new Set([htmlFile])
            );
        }
    };
}

export default defineConfig({
    plugins: [
        htmlInclude()
    ],

    server: {
        port: 3000,
        open: true
    },

    build: {
        outDir: 'dist',
        assetsDir: 'assets',

        /*
         * Entradas HTML de la aplicación multipágina.
         * Esto es importante para npm run build.
         */
        rolldownOptions: {
            input: {
                home: resolve(
                    process.cwd(),
                    'index.html'
                ),

                localCourses: resolve(
                    process.cwd(),
                    'cursos-idioma-local/index.html'
                )
            }
        }
    }
});