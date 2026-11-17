# Contribuir al banco EGEL Plus ISOFT

Proyecto mantenido en [github.com/josprox/ExamenIsoftEGEL](https://github.com/josprox/ExamenIsoftEGEL) y publicado en [egelsoft.astriom.org](https://egelsoft.astriom.org).

El contenido editable está en `contenido/`; React lo presenta y Laravel lo importa a la base de datos MySQL. Revisa la [guía de julio de 2026](biblioteca/general/guia-sustentante-egel-plus-isoft-julio-2026.pdf) antes de asignar un área o subárea.

## Preguntas

1. Agrega preguntas **originales** al banco apropiado de `contenido/preguntas/`. Cada archivo declara `temario`, `area`, `banco`, `estimulos` y `preguntas`.
2. Usa un ID único y una de las subáreas de `contenido/temarios/egel-plus-isoft-2026.json`.
3. Incluye tres opciones con explicación individual, el índice `correcta` (0, 1 o 2), `estrategia`, `conceptos` y al menos una fuente cuyo ID exista en `contenido/recursos.json`.
4. Ejecuta `npm run validar`. Para ver las preguntas nuevas en Laravel, ejecuta `php artisan egel:importar` dentro de `backend/`.

Ejemplo mínimo:

```json
{
  "id": "A2-015",
  "subarea": "2.2",
  "formato": "cuestionamiento-directo",
  "nivel": "satisfactorio",
  "base": "Un equipo necesita separar responsabilidades de dos módulos.",
  "pregunta": "¿Qué decisión favorece el bajo acoplamiento?",
  "opciones": [
    { "texto": "Una interfaz pequeña y estable", "explicacion": "Correcta. Reduce dependencias entre módulos." },
    { "texto": "Compartir todas las variables internas", "explicacion": "Incorrecta. Aumenta las dependencias." },
    { "texto": "Duplicar la lógica de negocio", "explicacion": "Incorrecta. Introduce inconsistencias y no define una interfaz." }
  ],
  "correcta": 0,
  "estrategia": "Identifica qué opción reduce lo que un módulo necesita conocer del otro.",
  "conceptos": ["Acoplamiento"],
  "fuentes": [{ "recurso": "sommerville-2016", "detalle": "Diseño de software" }]
}
```

Los formatos válidos son `cuestionamiento-directo`, `completamiento`, `ordenamiento` (requiere `lista`) y `multirreactivo` (requiere un `estimulo` registrado). El banco `reto` requiere también `trampa`.

Para Lenguaje y Comunicación, usa los **ámbitos** de la guía: `L1.1` estudio, `L1.2` literario, `L1.3` participación social; `L2.1` estudio y `L2.2` participación social. Identificación, interpretación, evaluación y las dimensiones de redacción se pueden registrar en `conceptos`, pero no sustituyen al ámbito.

## Recursos y guías

Registra referencias y documentos en `contenido/recursos.json`; guarda los PDF de consulta en `biblioteca/` y usa una ruta relativa al repositorio en `archivo`. Las guías Markdown viven en `contenido/guias/` y se registran en `contenido/manifest.json`.

El simulacro completo selecciona 203 reactivos con los cupos de la guía entre los bancos distintos de `reto`. Si falta contenido en alguna subárea, la API responde con un error en vez de entregar un simulacro incompleto.
