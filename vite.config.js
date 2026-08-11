import { defineConfig } from 'vite';
import { resolve, dirname, isAbsolute } from 'node:path';
import fs from 'node:fs';


/* ====================================================
   PLUGIN HTML INCLUDE
==================================================== */

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
                 * Las rutas que empiezan con "/"
                 * se resuelven desde la raíz del proyecto.
                 *
                 * Las rutas relativas se resuelven desde
                 * la carpeta del HTML que contiene el include.
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


                /* ==========================================
                   EVITAR INCLUDES CIRCULARES
                ========================================== */

                if (includeStack.has(fullPath)) {

                    console.error(
                        `Include circular detectado: ${fullPath}`
                    );

                    return '';
                }


                /* ==========================================
                   VERIFICAR ARCHIVO
                ========================================== */

                if (!fs.existsSync(fullPath)) {

                    console.error(
                        `Include no encontrado: ${fullPath}`
                    );

                    return match;
                }


                /* ==========================================
                   LEER COMPONENTE
                ========================================== */

                const includedHtml = fs.readFileSync(
                    fullPath,
                    'utf8'
                );


                /* ==========================================
                   PROCESAR INCLUDES INTERNOS
                ========================================== */

                const nextStack = new Set(includeStack);

                nextStack.add(fullPath);


                return processIncludes(
                    includedHtml,
                    fullPath,
                    nextStack
                );
            }
        );
    }


    /* ====================================================
       API DEL PLUGIN
    ==================================================== */

    return {

        name: 'html-include',

        enforce: 'pre',


        transformIndexHtml: {

            order: 'pre',

            handler(html, context) {

                const htmlFile = context.filename
                    ? resolve(context.filename)
                    : resolve(
                        process.cwd(),
                        'index.html'
                    );


                console.log(
                    `Procesando HTML: ${htmlFile}`
                );


                return processIncludes(
                    html,
                    htmlFile,
                    new Set([htmlFile])
                );
            }
        }
    };
}


/* ====================================================
   CONFIGURACIÓN VITE
==================================================== */

export default defineConfig({

    /* ==========================================
       PLUGINS
    ========================================== */

    plugins: [
        htmlInclude()
    ],


    /* ==========================================
       SERVIDOR DE DESARROLLO
    ========================================== */

    server: {

        port: 3000,

        open: true
    },


    /* ==========================================
       BUILD
    ========================================== */

    build: {

        outDir: 'dist',

        assetsDir: 'assets',


        /*
         * Entradas HTML de la aplicación multipágina.
         *
         * Todas las páginas internas se encuentran
         * actualmente dentro de /pages.
         */
        rolldownOptions: {

            input: {

                /* HOME */

                home: resolve(
                    process.cwd(),
                    'index.html'
                ),


                /* CONTACTOS */

                contactos: resolve(
                    process.cwd(),
                    'pages/contactos/index.html'
                ),


                /* CURSOS DE IDIOMAS EN EL EXTRANJERO */

                foreignCourses: resolve(
                    process.cwd(),
                    'pages/cursos-de-idiomas-en-el-extranjero-2/index.html'
                ),


                /* CURSOS DE IDIOMA LOCAL */

                localCourses: resolve(
                    process.cwd(),
                    'pages/cursos-idioma-local/index.html'
                ),


                /* EDUCACIÓN EN EL EXTERIOR */

                universityAccess: resolve(
                    process.cwd(),
                    'pages/educacion-en-el-exterior/index.html'
                ),


                /* ESPAÑOL PARA EXTRANJEROS */

                spanishEcotourism: resolve(
                    process.cwd(),
                    'pages/espanol-para-extranjeros-ecoturismo/index.html'
                ),


                /* NUESTRA HISTORIA */

                aboutPage: resolve(
                    process.cwd(),
                    'pages/nuestra-historia/index.html'
                ),


                /* PASANTÍAS PROFESIONALES */

                professionalInternships: resolve(
                    process.cwd(),
                    'pages/pasantias-profesionales/index.html'
                ),


                /* PREGUNTAS FRECUENTES */

                faq: resolve(
                    process.cwd(),
                    'pages/preguntas/index.html'
                ),


                /* PROGRAMA ESCOLAR */

                schoolProgram: resolve(
                    process.cwd(),
                    'pages/programa-escolar/index.html'
                ),


                /* PROGRAMA NANNY */

                nannyProgram: resolve(
                    process.cwd(),
                    'pages/programa-nanny/index.html'
                ),


                /* SUMMER CAMPS */

                summerCamps: resolve(
                    process.cwd(),
                    'pages/summer-camps/index.html'
                ),


                /* TESTIMONIOS */

                testimonials: resolve(
                    process.cwd(),
                    'pages/testimonios/index.html'
                )
            }
        }
    }
});