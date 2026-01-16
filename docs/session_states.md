# Estados de sesión (`sessions.estado`)

## Estados soportados (4)

`sessions.estado` se maneja como `text`, pero la app considera estos 4 valores:

- `activo`: estado inicial al crear la sesión.
- `suficiente`: automático cuando existe al menos 1 PDF guardado en base de datos para la sesión.
- `finalizada`: manual (revocable) desde `pdf_config.html` mediante un checkbox. Requiere al menos 1 PDF guardado.
- `cancelada`: automático al cerrar el programa si la sesión no tiene PDFs guardados *y* no tiene resultados guardados (sesión “incompleta”).

La columna no es `NOT NULL`, así que pueden existir `NULL` o valores históricos; en UI se tratan como “desconocido”.

## ¿Cuándo se actualiza?

- **Creación** → `activo`
  - UI: `js/input_data/step_5_sheet.js` llama `window.cerper.insertSession(...)`
  - Backend: `POST /sessions` en `proxy/routes/sessions.js`

- **Primer PDF guardado** → `suficiente` (si no estaba `finalizada`)
  - UI: `js/pdf_config.js` guarda reportes vía `window.cerper.saveReportToDb(...)`
  - Backend: `POST /reports` en `proxy/routes/reports.js` actualiza la sesión a `suficiente`

- **Marcar “finalizado”** → `finalizada` / **desmarcar** → `suficiente` (o `activo` si no hay PDFs)
  - UI: checkbox “Marcar como finalizado el proceso” en `pdf_config.html` (lógica en `js/pdf_config.js`)
  - Backend: `PATCH /sessions/:sessionId/status` en `proxy/routes/sessions.js` (valida `missing_reports`)

- **Cerrar app sin PDFs ni resultados** → `cancelada`
  - Main process: `main.js` llama `POST /sessions/cancel-incomplete` al salir
  - Backend: `POST /sessions/cancel-incomplete` en `proxy/routes/sessions.js` cancela sesiones `activo` sin PDFs ni resultados

## Mapeo visual (panel de sesiones)

En `js/sessions_panel.js` el semáforo se calcula a partir de `estado`:

- Verde: `activo` (y alias tolerados como `activa`, `abierta`)
- Azul: `suficiente`
- Morado: `finalizada` (y alias tolerados como `completada`, etc.)
- Rojo: `cancelada` (y alias tolerados como `cerrada`)
- Naranja: cualquier otro valor o `NULL`
