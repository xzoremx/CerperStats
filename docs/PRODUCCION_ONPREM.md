# CerperStats – Propuesta de puesta en producción (On‑Premise)

Este documento responde a los puntos solicitados por TI para migrar CerperStats desde AWS a infraestructura local administrada por CERPER.

## 1) Infraestructura necesaria (servidor + software + ciberseguridad)

### 1.1 Objetivo

Hospedar el backend de CerperStats dentro de la red de CERPER para que:

- La app Electron (clientes) consuma la API en red local.
- Los datos residan en PostgreSQL on‑prem (y se respalden según políticas internas).
- Se mantenga un control centralizado de usuarios/roles y auditoría.

### 1.2 Arquitectura propuesta

**Opción recomendada (simple y consistente con el diseño actual):**

- 1 servidor Linux (Ubuntu LTS) ejecutando:
  - Proxy API (Node/Express) `proxy/server.js`
  - PostgreSQL
  - Runtime Python + virtualenv para módulos de evaluación
  - (Opcional) Nginx como reverse proxy para HTTPS y control de cabeceras

**Alternativa equivalente (más simple de operar):**

- Docker Compose (proxy + PostgreSQL en contenedores) — ver `docs/DOCKER_BACKEND.md`.

**Opción escalable (si crece el uso):**

- Servidor A: Proxy API + runtime Python
- Servidor B: PostgreSQL dedicado (con disco/IOPS priorizados)

### 1.3 Requisitos de hardware (sizing inicial)

El dimensionamiento final depende de volumen, retención y concurrencia. Para una carga baja (p. ej. ~10 reportes PDF/mes,
~1000 imágenes/mes, ~10k inputs/mes) se puede iniciar con un sizing compacto y escalar según monitoreo:

- CPU: 2–4 cores (escalable a 4–8)
- RAM: 4–8 GB (escalable a 8–16)
- Disco: 60–120 GB SSD (ideal NVMe), con espacio para:
  - DB + índices + crecimiento
  - logs
  - (ideal) backups en storage separado; ajustar si TI exige retención local
- Red: 1 Gbps (mínimo) en LAN

### 1.4 Requisitos de software (backend)

- OS: Ubuntu 22.04 LTS (recomendado) o equivalente.
- Node.js LTS (para `proxy/server.js`).
- PostgreSQL 14+ (o versión definida por TI).
- Python 3.10+ + virtualenv para ejecutar evaluaciones (módulos en `modules/python/` y runner en `modules/_common/main.py`).
- Gestión de procesos:
  - systemd (Linux) para servicio del proxy (ver patrón en `docs/AWS_BACKEND.md`).
  - Alternativa: PM2 (si TI lo prefiere).

### 1.5 Red y puertos

- Proxy API: puerto `4000/tcp` (o el que defina TI).
- PostgreSQL: `5432/tcp` **solo** accesible desde el proxy (idealmente no expuesto a clientes).
- Recomendación: acceso al proxy restringido por firewall a subredes internas CERPER.

### 1.6 Seguridad (ciberseguridad)

Puntos críticos a formalizar con TI:

- **HTTPS** entre clientes Electron y Proxy API (recomendado), especialmente porque:
  - el token de cliente viaja en `Authorization: Bearer ...`
  - el panel admin usa `X-Admin-Auth` (credenciales base64) y requiere transporte cifrado
- **Gestión de secretos**:
  - `secrets/token_secret.txt` (firma/verificación de tokens del proxy) debe existir en el servidor y no versionarse.
  - credenciales de DB en `.env.local` (servidor) y token/URL embebidos en el cliente (build).
- **Hardening**:
  - actualizaciones del OS
  - firewall (allowlist), fail2ban (si aplica), backups cifrados, rotación de logs
- **Auditoría / trazabilidad**:
  - logs del proxy (systemd/journal o PM2)
  - logs en DB ya existentes (tabla `logs_sistema` en flujo de auth/admin)

### 1.7 Cuestionario para cotización (inputs necesarios)

Para cotizar inversión y riesgo, TI debe definir:

1. Número de usuarios concurrentes esperados (analistas/supervisores/admin).
2. Volumen esperado (sesiones/mes) y retención de datos (años).
3. Política de backups: frecuencia, retención, offsite, RPO/RTO.
4. Red: subredes autorizadas, VPN/segmentación, si se requiere acceso remoto.
5. Requerimiento de alta disponibilidad (HA) o “best effort”.
6. Política de certificados (CA interna vs público) para HTTPS y para PostgreSQL (SSL).

## 2) Entregables (manuales + diseño lógico), gestión de cambio y respaldo

### 2.1 Entregables de documentación (propuesta)

**Manual de usuario (operación):**

- Flujo analista (inputs → evaluaciones → PDFs → guardado).
- Flujo supervisor/admin (panel de sesiones, revisión, reportes).

**Manual de administración / TI (operación):**

- Instalación del backend (proxy + postgres + python).
- Alta/baja de usuarios y roles (admin panel).
- Gestión de tokens del proxy (generación/rotación).
- Backups, restauración y verificación.
- Actualización/rollback de versión.

**Diseño lógico / técnico:**

- Arquitectura de componentes y flujos.
- API endpoints principales (proxy).
- Modelo de estados de sesión: `docs/session_states.md`.
- Esquema DB (snapshots/migrations en `database/`).

### 2.2 Entregables técnicos (propuesta)

- Código fuente (repositorio) y tags/versiones.
- Instalador/portable de Electron (Windows) generado con `electron-builder`.
- Scripts de prebuild (`scripts/`) y configuración de empaquetado (`electron-builder.json`).
- Checklist de despliegue (pre‑requisitos, smoke tests, verificación post‑deploy).

### 2.3 Gestión de cambio (propuesta)

- Definir ambientes:
  - `DEV` (desarrollo)
  - `UAT` (validación con usuarios CERPER)
  - `PROD` (producción)
- Flujo de release:
  1) backup DB
  2) deploy proxy
  3) validación `/health`
  4) despliegue cliente Electron (si cambia URL/token o versión)
  5) monitoreo post‑deploy
- Plan de rollback:
  - rollback de proxy a release anterior
  - restore DB (si hay migración incompatible)

### 2.4 Respaldo de información (propuesta)

- Respaldo PostgreSQL (pg_dump o estrategia definida por TI).
- Retención y verificación de restore (prueba mensual/trimestral).
- Considerar cifrado en repositorio de backups y control de accesos.

## 3) Alcance del aplicativo, etapas y estimación de tiempo

### 3.1 Alcance (para producción on‑prem)

Incluye:

- Backend on‑prem: Proxy API + PostgreSQL + módulos Python.
- Cliente Electron: conectividad hacia backend on‑prem (URL/token) + generación de PDFs local.
- Panel admin (activación de usuarios y configuración).
- Migración de datos desde AWS (si aplica).

No incluye (salvo que se solicite):

- Alta disponibilidad (cluster/replicación) fuera de la estrategia estándar de TI.
- Refactors mayores para soportar Windows server si TI exige ese OS (hoy el backend está documentado/operado con patrones Linux).

### 3.2 Etapas sugeridas

1) **Levantamiento y evaluación** (TI + desarrollo)
- confirmar arquitectura objetivo (1 servidor vs 2)
- confirmar seguridad (HTTPS, segmentación, rotación de secretos)
- definir sizing y cotización

2) **Preparación de entorno on‑prem** (TI)
- provisionar servidor(es)
- configurar OS, firewall, certificados
- instalar Node/Python/PostgreSQL

3) **Despliegue backend + smoke tests** (desarrollo + TI)
- deploy proxy
- deploy python venv/módulos
- configurar DB y credenciales
- pruebas de `/health`, login, creación de sesión, corrida de evaluación

4) **Migración de datos (si aplica)** (TI + desarrollo)
- export/import
- verificación de integridad

5) **UAT / Piloto** (usuarios + TI + desarrollo)
- validación funcional
- validación de rendimiento y soporte

6) **Go‑Live** (TI)
- backups habilitados
- monitoreo
- soporte inicial

### 3.3 Estimación de tiempo (referencial)

Depende de la disponibilidad de infraestructura y políticas internas. Rango típico:

- Evaluación + diseño de despliegue: **3–5 días hábiles**
- Setup de servidores (TI): **3–10 días hábiles** (depende de compras/aprobaciones)
- Deploy + pruebas + ajustes: **3–7 días hábiles**
- Migración de datos + validación: **2–5 días hábiles**
- UAT/Piloto: **1–2 semanas**

Total estimado (sin compras): **2–4 semanas**. Con compras/aprobaciones: depende del lead time de TI.

## Referencias internas del repo

- Backend AWS (base para on‑prem): `docs/AWS_BACKEND.md`
- Registro web (si se usa): `docs/web_architecture.md`
- Estados de sesión: `docs/session_states.md`
