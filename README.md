# CerperStats

Sistema de evaluacion estadistica de laboratorios (CERPER) construido como **app de escritorio en Electron** con un **backend en AWS (Proxy API + PostgreSQL + modulos Python)**.

## Que hace la app?

- Captura inputs (monoanalito / multianalito) con validacion estructural.
- Ejecuta evaluaciones estadisticas en servidor (modulos Python) y guarda resultados/graficos.
- Genera reportes PDF **localmente** (Electron + Puppeteer) y los guarda en servidor/DB.
- Permite revision de sesiones y reportes por roles (analista / supervisor / admin).

## Componentes (arquitectura)

### 1) App Electron (cliente)

- UI: paginas HTML locales (`*.html`) + scripts en `js/` + estilos en `css/`.
- Seguridad: `contextIsolation: true`, `nodeIntegration: false` y API expuesta via `preload.js`.
- Comunicacion con backend: `main.js` usa `proxyFetch()` hacia el Proxy API y expone funciones via IPC (por ejemplo `window.cerper.getSessionInfo`, `window.cerper.saveReportToDb`, etc.).
- Generacion de PDFs: `main.js` crea PDFs con `modules/reports/*` usando Puppeteer (Chromium incluido en build) + `pdf-lib`.

### 2) Proxy API (backend Express)

Ubicado en `proxy/` (en produccion corre en AWS Lightsail):

- Autenticacion de usuarios: `/auth/login` (bcrypt contra tabla `usuarios`).
- Autorizacion de API: JWT "client token" en header `Authorization: Bearer ...` (middleware `verifyToken`).
- Endpoints: labs, sessions, inputs, evaluaciones, reports, results, tests formatting config.
- Admin: panel estatico en `/admin-panel/` y API en `/admin` (usa header `X-Admin-Auth`).

### 3) PostgreSQL (BD)

Persistencia principal (usuarios, labs, sessions, inputs, results_general, reports, tests_catalog, etc.).

### 4) Modulos Python (evaluaciones)

En `modules/python/` (server-side). El proxy ejecuta `modules/_common/main.py` dentro de un virtualenv y guarda los resultados en PostgreSQL.

### 5) Registro web

Carpeta `web/`: app Next.js para registro de usuarios (ver `docs/web_architecture.md`). La aprobacion/activacion se hace en el panel admin.

## Estructura del repositorio

```text
.
├── main.js / preload.js         # Proceso principal + puente seguro (IPC)
├── *.html / css/ / js/          # UI Electron (paginas, estilos y logica)
├── input_data/                  # Vistas del flujo de ingreso de datos
├── modules/
│   ├── reports/                 # Plantillas + generador PDF (Electron)
│   ├── python/                  # Modulos de evaluacion (server-side)
│   └── _common/                 # Runner/manifest compartido (server-side)
├── proxy/                       # Backend Express (AWS/local)
├── database/                    # Migrations y snapshots (PostgreSQL)
├── web/                         # Registro web (Next.js)
├── scripts/                     # Prebuild (embed config + chromium)
├── secrets/                     # Token JWT (no versionado el contenido)
├── docker-compose.yml           # PostgreSQL + Proxy API (dev local)
└── docs/                        # Documentacion (AWS, web, estados)
```

Nota: en builds empaquetados de Electron no se incluyen `proxy/` ni `modules/python/` (solo cliente + generador de PDFs).

## Flujo de uso (Analista)

1. `login.html` - login contra backend (`/auth/login`).
2. `procedure_select.html` - define procedimiento + contexto.
3. `input_data/input_data_info.html` - guia del flujo de carga.
4. `input_data/input_data_sheet.html` - ingreso/validacion de lecturas; al confirmar crea una **sesion** (`POST /sessions`) y guarda inputs.
5. `evaluation_select.html` - seleccionar pruebas y ejecutar (backend corre modulos Python).
6. `evaluation_results.html` - ver resultados + graficos (solo lectura).
7. `pdf_config.html` - generar PDFs localmente y **guardar** en servidor/DB (`POST /reports`).
8. `reports.html` - listar/descargar reportes guardados por sesion.

## Flujo de revision (Supervisor/Admin)

- `sessions_panel.html` - lista sesiones (filtra por labs y procedimiento).
- `session_detail.html` - ficha tecnica + acceso a resultados (`evaluation_results.html`) y reportes (`reports.html`).

## Estados de sesion (4)

`sessions.estado` se usa como indicador de progreso:

- `activo`: estado inicial al crear la sesion.
- `suficiente`: automatico cuando hay >=1 PDF guardado en DB para la sesion.
- `finalizada`: manual y revocable desde `pdf_config.html` (checkbox). Requiere >=1 PDF guardado.
- `cancelada`: automatico al cerrar la app si la sesion no tiene PDFs guardados y no tiene resultados guardados (sesion "incompleta").

Detalle completo: `docs/session_states.md`.

## Build / distribucion (Electron)

- `npm run prebuild` ejecuta:
  - `scripts/copy-chrome.js` (copia Chromium de Puppeteer a `chrome-bundled/`)
  - `scripts/embed-config.js` (genera `config/embedded-env.js` para builds empaquetados)
- `npm run dist:win` genera instalable portable (config en `electron-builder.json`).

Nota: `chrome-bundled/` (~350 MB) no se versiona en Git. Se genera automaticamente con `npm install` (hook `postinstall`) o con `npm run prebuild`.

## Tests

```bash
npm test
```

## Documentacion adicional

- Backend en AWS: `docs/AWS_BACKEND.md`
- Produccion on-prem (infra/entregables/plan): `docs/PRODUCCION_ONPREM.md`
- Registro web (Next.js): `docs/web_architecture.md`
- Estados de sesion: `docs/session_states.md`

---

## Lanzar el proyecto localmente

### Requisitos

- **Node.js** (v18+) + npm
- **Docker Desktop** (para PostgreSQL y Proxy API)

### Paso 1: Instalar dependencias

```bash
npm install
```

Esto tambien genera automaticamente `chrome-bundled/` (Chromium para generacion de PDFs).

### Paso 2: Levantar PostgreSQL + Proxy API con Docker

Abrir **Docker Desktop** y luego ejecutar:

```bash
docker-compose up -d
```

Esto levanta dos contenedores:

| Servicio   | Puerto | Descripcion                    |
|------------|--------|--------------------------------|
| `postgres` | 5433   | PostgreSQL 16 (BD cerperstats) |
| `proxy`    | 4000   | Proxy API Express              |

Verificar que esten corriendo:

```bash
docker ps
```

### Paso 3: Configurar variables de entorno

Crear un archivo `.env` en la raiz del proyecto (no se versiona):

```env
PGHOST=127.0.0.1
PGPORT=5433
PGUSER=cerper_user
PGPASSWORD=<tu_contraseña>
PGDATABASE=cerperstats
CERPER_PROXY_URL=http://localhost:4000/run-eval
CERPER_PROXY_TOKEN=<token_jwt>
POSTGRES_PASSWORD=<tu_contraseña>
CERPER_EVAL_CONCURRENCY_MULTI=1
```

### Paso 4: Generar token JWT

El token es necesario para que Electron se comunique con el Proxy. Requiere `secrets/token_secret.txt`.

```bash
node proxy/gen-token.js electron-client
```

Copiar el token generado en `CERPER_PROXY_TOKEN` dentro del `.env`.

> **Nota:** El token expira cada 7 dias. Si al hacer login ves `ECONNREFUSED` o errores de autenticacion, regenera el token con el mismo comando.

### Paso 5: Lanzar la app

```bash
npm start
```

### Resumen rapido (si ya tienes todo configurado)

```bash
# 1. Abrir Docker Desktop
# 2. Levantar servicios
docker-compose up -d
# 3. Lanzar Electron
npm start
```

Si el token JWT expiro:

```bash
node proxy/gen-token.js electron-client
# Copiar el token en .env -> CERPER_PROXY_TOKEN
npm start
```
