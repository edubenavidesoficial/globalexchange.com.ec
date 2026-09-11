# Sitio público Global Exchange

Aplicación de Vite con HTML, CSS y JavaScript. No utiliza Next.js ni las credenciales del CRM.

## Comandos

Desde esta carpeta: `npm ci`, `npm run dev`, `npm run check`, `npm test`, `npm run build` y `npm run preview`.

Desde la raíz del repositorio se pueden usar los comandos equivalentes `dev:frontend`, `check:frontend`, `test:frontend` y `build:frontend`.

## Organización

- `index.html`: portada.
- `pages/<ruta>/index.html`: entrada de cada página; se descubre automáticamente al compilar.
- `src/components/`: fragmentos compartidos y un componente de contenido por página cuando no hay reutilización interna.
- `src/css/main.css`: estilos comunes. `src/css/pages/`: estilos específicos.
- `src/js/main.js`: inicialización global y carga selectiva de módulos.
- `src/languages/`: idiomas y traducciones.
- `public/`: recursos accesibles por URL.
- `build/`: composición de HTML y configuración de entradas.
- `scripts/` y `tests/`: comprobaciones antes de publicar.

Un include ausente, circular o fuera del proyecto detiene la compilación. Los cambios de componentes HTML recargan el navegador en desarrollo. Las páginas internas conservan sus URLs anteriores.

Ver [Arquitectura general](../docs/ARQUITECTURA.md) para añadir páginas y conocer los límites de la integración.
