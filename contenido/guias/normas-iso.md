# Normas ISO e IEEE más usadas en el EGEL Plus ISOFT

En el examen no te piden memorizar el número de cláusula, sino **identificar qué norma resuelve una necesidad del caso** o **clasificar un requerimiento/métrica** dentro del modelo correcto.

## 1. Resumen rápido por área del examen

| Norma | Qué regula / define | Dónde aparece | Pista clave en el caso |
|---|---|---|---|
| **ISO/IEC 25010** (SQuaRE) | Calidad del producto de software y calidad en uso | 1.1, 2.1, 4.2 | Atributos de calidad (seguridad, desempeño, fiabilidad, usabilidad) |
| **ISO/IEC 25002** | Guía general y estructura de la familia SQuaRE (25000) | 1.1, 4.2 | Marco general para evaluar calidad del producto y datos |
| **ISO/IEC/IEEE 29148** | Ingeniería de requerimientos y estructura de la **SRS** | 1.1, 1.3 | Especificación de requerimientos (antes IEEE 830) |
| **ISO/IEC/IEEE 42010** | Descripción de **arquitectura** (vistas y puntos de vista) | 2.1 | Documentar vistas arquitectónicas y *stakeholders* |
| **ISO/IEC 12207** | Procesos del **ciclo de vida** del software | 4.2, 4.3 | Adquisición, suministro, desarrollo, operación y mantenimiento |
| **ISO/IEC/IEEE 29119** | Estándar de **pruebas de software** (procesos, documentación, técnicas) | 3.3, 4.2 | Plan de pruebas, casos de prueba, cobertura |
| **ISO 9241** (y **WCAG 2.2**) | Ergonomía, **usabilidad** e interacción humano-computadora | 2.3 | Usabilidad (9241-11 / 9241-110) y accesibilidad web (POUR) |
| **ISO/IEC 27001 / 27002** | Sistema de Gestión de **Seguridad de la Información (SGSI)** | 1.1, 4.2 | Controles de seguridad, confidencialidad, auditoría, riesgos |
| **ISO 9001 / ISO/IEC 90003** | Gestión de **calidad de procesos** (90003 aplica 9001 al software) | 4.2 | Certificación de procesos organizacionales y mejora continua |
| **ISO/IEC 15504 (SPICE) / CMMI** | Evaluación y **madurez de procesos** | 4.2, 4.3 | Niveles de capacidad/madurez (1 Inicial → 5 Optimizado) |
| **ISO 21500 / PMBOK** | Guía para la **gestión de proyectos** | 4.1 | Alcance, cronograma, costos, riesgos, interesados |

---

## 2. La más preguntada: ISO/IEC 25010 (edición 2023 vs. 2011)

La guía 2026 contempla el modelo **SQuaRE** con sus **9 características de calidad del producto** (en 2023 *Usabilidad* pasó a llamarse *Capacidad de interacción*, *Portabilidad* pasó a *Flexibilidad* y se añadió *Protección / Safety*):

1. **Adecuación funcional:** completitud, corrección y pertinencia funcional (*¿hace lo que el negocio necesita?*).
2. **Eficiencia de desempeño:** comportamiento temporal (latencia), utilización de recursos y capacidad.
3. **Compatibilidad:** coexistencia e **interoperabilidad** (*intercambiar datos con otro sistema mediante estándares como HL7/REST*).
4. **Capacidad de interacción** *(antes Usabilidad)*: reconocibilidad, **capacidad de aprendizaje** (*usuario nuevo sin capacitación en X min*), operabilidad, protección frente a errores, estética e **inclusividad**.
5. **Fiabilidad:** madurez, disponibilidad, **tolerancia a fallos** (*sigue operando sin caer*) y **recuperabilidad** (*se cae y vuelve en RTO con pérdida máxima RPO*).
6. **Seguridad:** **confidencialidad** (*solo autorizados ven*), **integridad** (*evitar alteración*), **no repudio** (*no poder negar una acción firmada*), **responsabilidad / accountability** (*bitácora rastreable*), **autenticidad** y **resistencia**.
7. **Mantenibilidad:** modularidad, reusabilidad, analizabilidad, capacidad de ser modificado y **capacidad de ser probado**.
8. **Flexibilidad** *(antes Portabilidad)*: **adaptabilidad** (*correr en otro SO/nube sin reescribir*), instalabilidad, escalabilidad y reemplazabilidad.
9. **Protección (Safety):** evitar daños a personas, bienes o entorno ante fallas del sistema.

> 💡 **Calidad en uso (ISO/IEC 25010):** evalúa el sistema siendo usado por personas reales en su contexto (*efectividad, eficiencia, satisfacción, ausencia de riesgo y cobertura de contexto*).

---

## 3. Requerimientos y Arquitectura: 29148 vs. 42010

- **ISO/IEC/IEEE 29148** *(sustituyó a IEEE 830)*:
  - Define características de un buen requerimiento: **necesario, no ambiguo, completo, singular, factible, verificable y trazable**.
  - Estructura la **SRS** (*Software Requirements Specification*): describe **QUÉ** hace el sistema y sus restricciones, **no** el diseño interno.
- **ISO/IEC/IEEE 42010** *(antes IEEE 1471)*:
  - Define cómo documentar una **arquitectura**: cada *stakeholder* tiene preocupaciones (*concerns*) que se responden mediante **puntos de vista** (*viewpoints*) concretados en **vistas** (*views*).

---

## 4. Calidad de Proceso vs. Calidad de Producto (trampa clásica)

En el EGEL suelen mezclar estas normas como distractores entre sí:

- **¿Evalúa el software terminado (código, tiempos, seguridad, usabilidad)?** → **ISO/IEC 25010** (calidad del producto).
- **¿Evalúa cómo trabaja la organización o el proceso de desarrollo?** → **ISO 9001 / 90003**, **ISO/IEC 12207**, **ISO/IEC 15504 (SPICE)** o **CMMI**.
- **¿Evalúa pruebas de software?** → **ISO/IEC/IEEE 29119** (partes 1–5: conceptos, proceso, documentación, técnicas y pruebas basadas en palabras clave).
- **¿Evalúa seguridad organizacional, controles de acceso y análisis de riesgos de información?** → **ISO/IEC 27001 / 27002**.

---

## 5. Accesibilidad e IHC: ISO 9241 y WCAG 2.2

- **ISO 9241-11:** define la usabilidad mediante tres ejes medibles: **eficacia**, **eficiencia** y **satisfacción** en un contexto específico de uso.
- **ISO 9241-110:** principios de diálogo (adecuación a la tarea, autodescriptivo, controlabilidad, conformidad con expectativas, tolerancia a errores).
- **WCAG 2.2 (W3C, principios POUR):**
  - **Perceptible:** texto alternativo (`alt`), contraste suficiente, subtítulos.
  - **Operable:** todo utilizable con teclado (`Tab`), sin trampas de foco, tiempo suficiente.
  - **Comprensible:** lenguaje claro, errores descriptivos, navegación predecible.
  - **Robusto:** HTML semántico válido compatible con lectores de pantalla.
