# CerperStats
Sistema de evaluación estadística de laboratorios (CERPER) construido como **app de escritorio en Electron** con un **backend en AWS (Proxy API + PostgreSQL + módulos Python)**.

## ¿Qué hace la app?

- Captura inputs (monoanalito / multianalito) con validación estructural.
- Ejecuta evaluaciones estadísticas en servidor (módulos Python) y guarda resultados/gráficos.
- Genera reportes PDF **localmente** (Electron + Puppeteer) y los guarda en servidor/DB.
- Permite revisión de sesiones y reportes por roles (analista / supervisor / admin).

## Componentes (arquitectura)

### 1) App Electron (cliente)

- UI: páginas HTML locales (`*.html`) + scripts en `js/` + estilos en `css/`.
- Seguridad: `contextIsolation: true`, `nodeIntegration: false` y API expuesta vía `preload.js`.
- Comunicación con backend: `main.js` usa `proxyFetch()` hacia el Proxy API y expone funciones vía IPC (por ejemplo `window.cerper.getSessionInfo`, `window.cerper.saveReportToDb`, etc.).
- Generación de PDFs: `main.js` crea PDFs con `modules/reports/*` usando Puppeteer (Chromium incluido en build) + `pdf-lib`.

### 2) Proxy API (backend Express)

Ubicado en `proxy/` (en producción corre en AWS Lightsail):

- Autenticación de usuarios: `/auth/login` (bcrypt contra tabla `usuarios`).
- Autorización de API: JWT “client token” en header `Authorization: Bearer ...` (middleware `verifyToken`).
- Endpoints: labs, sessions, inputs, evaluaciones, reports, results, tests formatting config.
- Admin: panel estático en `/admin-panel/` y API en `/admin` (usa header `X-Admin-Auth`).

### 3) PostgreSQL (backend)

Persistencia principal (usuarios, labs, sessions, inputs, results_general, reports, tests_catalog, etc.).

### 4) Módulos Python (evaluaciones)

En `modules/python/` (server-side). El proxy ejecuta `modules/_common/main.py` dentro de un virtualenv y guarda los resultados en PostgreSQL.

### 5) Registro web 

Carpeta `web/`: app Next.js para registro de usuarios (ver `docs/web_architecture.md`). La aprobación/activación se hace en el panel admin.

## Estructura del repositorio (alto nivel)

```text
.
├─ main.js / preload.js         # Proceso principal + puente seguro (IPC)
├─ *.html / css/ / js/          # UI Electron (páginas, estilos y lógica)
├─ input_data/                  # Vistas del flujo de ingreso de datos
├─ modules/
│  ├─ reports/                  # Plantillas + generador PDF (Electron)
│  ├─ python/                   # Módulos de evaluación (server-side)
│  └─ _common/                  # Runner/manifest compartido (server-side)
├─ proxy/                       # Backend Express (AWS/local)
├─ database/                    # Migrations y snapshots (PostgreSQL)
├─ web/                         # Registro web (Next.js)
├─ scripts/                     # Prebuild (embed config + chromium)
└─ docs/                        # Documentación (AWS, web, estados)
```

Nota: en builds empaquetados de Electron no se incluyen `proxy/` ni `modules/python/` (solo cliente + generador de PDFs).

## Flujo de uso (Analista)

1. `login.html` → login contra backend (`/auth/login`).
2. `procedure_select.html` → define procedimiento + contexto.
3. `input_data/input_data_info.html` → guía del flujo de carga.
4. `input_data/input_data_sheet.html` → ingreso/validación de lecturas; al confirmar crea una **sesión** (`POST /sessions`) y guarda inputs.
5. `evaluation_select.html` → seleccionar pruebas y ejecutar (backend corre módulos Python).
6. `evaluation_results.html` → ver resultados + gráficos (solo lectura).
7. `pdf_config.html` → generar PDFs localmente y **guardar** en servidor/DB (`POST /reports`).
8. `reports.html` → listar/descargar reportes guardados por sesión.

## Flujo de revisión (Supervisor/Admin)

- `sessions_panel.html` → lista sesiones (filtra por labs y procedimiento).
- `session_detail.html` → ficha técnica + acceso a resultados (`evaluation_results.html`) y reportes (`reports.html`).

## Estados de sesión (4)

`sessions.estado` se usa como indicador de progreso:

- `activa`: estado inicial al crear la sesión.
- `suficiente`: automático cuando hay ≥1 PDF guardado en DB para la sesión.
- `finalizada`: manual y revocable desde `pdf_config.html` (checkbox). Requiere ≥1 PDF guardado.
- `cancelada`: automático al cerrar la app si la sesión no tiene PDFs guardados (no se reanuda).

Detalle completo: `docs/session_states.md`.

## Desarrollo local

### Requisitos

- Node.js + npm (para Electron/Proxy/Web).
- (Opcional) PostgreSQL + Python si deseas correr el backend localmente.

### Configuración (cliente Electron)

Crear `.env` en la raíz (NO commitear):

```env
CERPER_PROXY_URL=http://localhost:4000/run-eval
CERPER_PROXY_TOKEN=__TOKEN_JWT__
# (opcional, legado) CERPER_EVAL_URL=...
```

El token se genera en el backend con `node proxy/gen-token.js <client>` (requiere `secrets/token_secret.txt` en el entorno del proxy).

### Ejecutar Electron

```bash
npm install
npm start
```

### Ejecutar Proxy API local (opcional)

1) Configurar credenciales de Postgres en `.env.local` (en la raíz, usado por `proxy/db.js`):

```env
PGHOST=localhost
PGPORT=5432
PGUSER=...
PGPASSWORD=...
PGDATABASE=cerperstats
```

2) Proveer `secrets/token_secret.txt` (no versionado) para JWT client tokens.

3) Levantar el servidor:

```bash
node proxy/server.js
```

### Tests

```bash
npm test
```

### Ejecutar registro web (opcional)

```bash
cd web
npm install
npm run dev
```

## Build / distribución (Electron)

- `npm run prebuild` ejecuta:
  - `scripts/copy-chrome.js` (copia Chromium de Puppeteer a `chrome-bundled/`)
  - `scripts/embed-config.js` (genera `config/embedded-env.js` para builds empaquetados)
- `npm run dist:win` genera instalable portable (config en `electron-builder.json`).

## Documentación adicional

- Backend en AWS: `docs/AWS_BACKEND.md`
- Producción on‑prem (infra/entregables/plan): `docs/PRODUCCION_ONPREM.md`
- Registro web (Next.js): `docs/web_architecture.md`
- Estados de sesión: `docs/session_states.md`
