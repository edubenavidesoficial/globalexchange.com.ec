# Ambientación del frontend

El sistema está en `src/css/components/page-decor.css`, importado desde `src/css/main.css`.
No usa JavaScript, imágenes adicionales, librerías ni animaciones.

## Uso

Activa la decoración en una sección de contenido (no en todo un documento con fondos opacos intermedios):

```html
<section class="mi-seccion page-decor page-decor--arc page-decor--reverse">
    <span class="page-decor__art" aria-hidden="true"></span>
    <!-- Contenido existente -->
</section>
```

La capa genera dos figuras con `::before` y `::after`. `isolation: isolate` y `z-index: -1`
las sitúan encima del fondo de la sección y detrás del contenido. Solo la capa decorativa
recorta su desbordamiento. `pointer-events: none` y `aria-hidden` la excluyen de la interacción
y de los lectores de pantalla. No aplicar a un contenedor con un modal global o navegación fija.

## Ajustes

En `:root`: `--decor-mint`, `--decor-lilac` y `--decor-sky` controlan la paleta global.
En `.page-decor` o una variante específica:

| Variable | Control |
| --- | --- |
| `--decor-color`, `--decor-secondary` | Colores de las figuras |
| `--decor-size` | Tamaño base responsive |
| `--decor-top`, `--decor-bottom` | Posición vertical |
| `--decor-edge` | Cuánto sale la figura por los bordes |
| `--decor-opacity` | Intensidad |
| `--decor-radius` | Silueta de la figura principal |

Variantes combinables: `page-decor--lavender`, `page-decor--arc`, `page-decor--reverse`
(invierte los lados) y `page-decor--quiet` (más discreta para zonas ya decoradas).
El breakpoint de 700px reduce tamaño y opacidad. Las formas son estáticas incluso sin
reduced motion y se ocultan al imprimir. Para variantes nuevas, cambiar variables en lugar
de copiar las reglas de las figuras.

## Aplicación y archivos HTML modificados

Todos los siguientes archivos están bajo `src/components/`:

| Página / sección | Archivo | Variante |
| --- | --- | --- |
| Inicio / Global | `about/About.html` | arc |
| Inicio / Program Finder | `program-finder/Program_Finder.html` | lavender quiet |
| Inicio / servicios y agenda | `services/Services.html` | reverse quiet |
| Programas / catálogo | `pages/programas/Programs_Page.html` | lavender |
| Resultados Finder | `pages/program-finder/Program_Finder_Results.html` | arc reverse |
| Testimonios / experiencias | `pages/testimonios/Testimonials_Page.html` | quiet |
| Preguntas | `pages/preguntas/Faq_Page.html` | lavender reverse |
| Nuestra Historia / historia y escuela | `pages/nuestra-historia/About_Page.html` | arc; reverse quiet |
| Cursos locales | `pages/cursos-idioma-local/Local_Courses_Page.html` | reverse |
| Cursos en el extranjero | `pages/cursos-de-idiomas-en-el-extranjero-2/Foreign_Courses_Page.html` | arc |
| Educación en el exterior | `pages/educacion-en-el-exterior/University_Access_Page.html` | lavender |
| Pasantías | `pages/pasantias-profesionales/Professional_Internships_Page.html` | arc reverse |
| Nanny | `pages/programa-nanny/Nanny_Program_Page.html` | lavender reverse |
| Programa escolar | `pages/programa-escolar/School_Program_Page.html` | base turquesa |
| Summer Camps | `pages/summer-camps/Summer_Camps_Page.html` | lavender |
| Ausbildung | `pages/ausbildung/Ausbildung_Page.html` | arc |
| Educación Dual | `pages/educacion-dual/Dual_Education_Page.html` | reverse |
| Español y ecoturismo | `pages/espanol-para-extranjeros-ecoturismo/Spanish_Ecotourism_Page.html` | reverse |

Contactos conserva su redirección al formulario de Inicio. Se revisaron las 17 entradas de
Vite. Los heroes fotográficos, el carrusel de Testimonios, el header, el footer y Closing
Experience conservan su decoración existente para evitar acumulación visual.
