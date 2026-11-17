# biblioteca/: documentos y PDFs de estudio

Todos los documentos de consulta (guías oficiales, bancos históricos, libros libres y material de apoyo) viven aquí organizados por área según el temario **EGEL Plus ISOFT 2026**.

| Carpeta | Contenido / Área del examen |
| --- | --- |
| `A1-analisis/` | Análisis de Sistemas de Software (requerimientos) |
| `A2-diseno/` | Diseño de Sistemas de Software (arquitectura, módulos, datos, interfaces) |
| `A3-desarrollo/` | Desarrollo de Sistemas de Software (lenguajes, paradigmas, entornos, datos, plataformas) |
| `A4-gestion/` | Gestión de Proyectos de Software (tiempo, costo, riesgo, calidad, metodologías) |
| `L-lenguaje-comunicacion/` | Comprensión lectora y redacción indirecta |
| `general/` | Guías oficiales Ceneval, bancos de preguntas y técnicas de estudio |
| `guias-3/` | Compendio histórico de guías por tema |
| `libros/` | Referencias bibliográficas |
| `legacy/` | Material histórico de versiones anteriores del EGEL |

## Reglas para agregar material
1. **Nombre del archivo**: `autor-anio-titulo-corto.pdf`, en minúsculas, sin acentos ni espacios. Ejemplo: `cervantes-2016-arquitectura-de-software.pdf`.
2. **Derechos de autor**: sube solo material con licencia libre, de dominio público, de tu autoría o con permiso del autor.
   Para libros comerciales, registra la referencia en `contenido/recursos.json` **sin** el archivo.
3. **Regístralo** en `contenido/recursos.json` con el campo `"archivo": "biblioteca/A2-diseno/<archivo>.pdf"` para que aparezca en la Biblioteca de [egelsoft.astriom.org](https://egelsoft.astriom.org).
4. Peso máximo recomendado: 50 MB por archivo (GitHub rechaza archivos de más de 100 MB).
5. Ejecuta `node scripts/validar.mjs` para verificar que todas las rutas existen.
