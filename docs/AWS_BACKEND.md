# CerperStats - Backend en AWS Lightsail

> Alternativa portable (AWS/on‑prem): ver `docs/DOCKER_BACKEND.md` (Docker Compose: proxy + PostgreSQL).

## Estructura de Archivos en el Servidor

```
/home/ubuntu/cerper-eval/
├── .env.local                 # Variables de entorno (PostgreSQL, etc.)
├── eval_service.py            # Servicio Python para ejecutar evaluaciones
├── proxy/                     # Servidor Express.js (API REST)
│   ├── server.js              # Punto de entrada del servidor
│   ├── db.js                  # Conexión a PostgreSQL con SSL
│   ├── package.json           # Dependencias Node.js
│   ├── gen-token.js           # Generador de tokens JWT
│   ├── lib/
│   │   └── runEvaluator.js    # Ejecutor de módulos Python
│   ├── routes/
│   │   ├── auth.js            # Autenticación (login)
│   │   ├── evaluaciones.js    # Evaluaciones, gráficos, resultados
│   │   ├── inputs.js          # Datos de entrada
│   │   ├── labs.js            # Laboratorios
│   │   ├── reports.js         # Reportes PDF
│   │   └── sessions.js        # Sesiones de usuario
│   └── node_modules/          # Dependencias instaladas
├── modules/                   # Módulos Python de evaluación estadística
│   ├── _common/
│   │   ├── main.py            # Ejecutor común de módulos
│   │   └── modules_manifest.json  # Registro de módulos disponibles
│   └── python/
│       ├── 1/                 # Módulo 1 (ej: normalidad)
│       │   ├── principal.py
│       │   └── graph.py
│       ├── 2/                 # Módulo 2 (ej: homogeneidad)
│       │   ├── principal.py
│       │   └── graph.py
│       └── ...                # Más módulos
└── secrets/
    └── token_secret.txt       # Secreto para firmar JWT
```

## Servicios del Sistema

### 1. Proxy Node.js (`cerper-proxy.service`)

```ini
# /etc/systemd/system/cerper-proxy.service
[Unit]
Description=CerperStats proxy
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/cerper-eval/proxy
Environment=PORT=4000
ExecStart=/usr/bin/node /home/ubuntu/cerper-eval/proxy/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Comandos útiles:**
```bash
sudo systemctl start cerper-proxy
sudo systemctl stop cerper-proxy
sudo systemctl restart cerper-proxy
sudo systemctl status cerper-proxy
sudo journalctl -u cerper-proxy -n 50 --no-pager  # Ver logs
```

### 2. PostgreSQL

**Ubicación de archivos:**
- Configuración: `/etc/postgresql/*/main/postgresql.conf`
- Autenticación: `/etc/postgresql/*/main/pg_hba.conf`
- Certificados SSL: `/etc/postgresql/certs/`

**Comandos útiles:**
```bash
sudo systemctl restart postgresql
sudo systemctl status postgresql
```

## Configuración

### Variables de Entorno (`.env.local`)

```env
PGHOST=localhost              # Host de PostgreSQL (localhost si está en el mismo servidor)
PGPORT=5432                   # Puerto de PostgreSQL
PGUSER=cerper_user            # Usuario de la base de datos
PGPASSWORD=<contraseña>       # Contraseña
PGDATABASE=cerperstats        # Nombre de la base de datos
```

### Certificados SSL de PostgreSQL

Los certificados deben coincidir con el `PGHOST`:

```bash
# Regenerar certificado (si es necesario)
cd /etc/postgresql/certs
sudo openssl req -new -x509 -days 3650 -nodes \
  -out server.crt \
  -keyout server.key \
  -subj "/CN=localhost"

sudo chown postgres:postgres server.crt server.key
sudo chmod 600 server.key
sudo chmod 644 server.crt
sudo systemctl restart postgresql
```

**Verificar certificado:**
```bash
openssl x509 -in /etc/postgresql/certs/server.crt -noout -subject -dates
```

## API Endpoints

### Autenticación
| Método | Endpoint | Descripción | Rate Limit |
|--------|----------|-------------|------------|
| POST | `/auth/login` | Iniciar sesión | 5 req/15 min |

### Evaluaciones
| Método | Endpoint | Descripción | Rate Limit |
|--------|----------|-------------|------------|
| GET | `/evaluaciones` | Listar evaluaciones disponibles | 100 req/min |
| POST | `/evaluaciones/run` | Ejecutar evaluaciones | 100 req/min |
| GET | `/evaluaciones/progress/:session_id` | Progreso de ejecución | 100 req/min |
| GET | `/evaluaciones/graficos/:session_id` | Obtener gráficos | 100 req/min |
| GET | `/evaluaciones/resultados/:session_id` | Obtener resultados | 100 req/min |

### Otros
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET/POST | `/labs/*` | Gestión de laboratorios |
| GET/POST | `/inputs/*` | Datos de entrada |
| GET/POST | `/sessions/*` | Sesiones de usuario |
| GET/POST | `/reports/*` | Generación de reportes |
| GET | `/tests/formatting-config` | Configuración dinámica de formateo (value_mappings, column_labels) |

## Límites Configurables

### Rate Limiting (en `server.js`)
- **Login**: 5 requests cada 15 minutos
- **API general**: 100 requests por minuto

### Límites de consulta (en `routes/evaluaciones.js`)
- **Gráficos por sesión**: 500 (variable: `CERPER_GRAFICOS_MAX_TESTS`)
- **Resultados por sesión**: 500 (variable: `CERPER_RESULTADOS_MAX_TESTS`)

### Concurrencia de ejecución (multianalito)
- `CERPER_EVAL_CONCURRENCY_MULTI`: cantidad de **analitos** a procesar en paralelo (default `1`).
  - Recomendación: en instancias con poca RAM (ej. 0.5 GB), mantener `1` para evitar swap/OOM. En instancias ≥ 2 GB, probar `2` y ajustar.

## Flujo de Ejecución de Evaluaciones

```
┌─────────────────┐
│  App Electron   │
│    (Cliente)    │
└────────┬────────┘
         │ HTTP Request
         ▼
┌─────────────────┐
│  Proxy Node.js  │
│   (Puerto 4000) │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌──────────────┐
│ PostgreSQL │ │ Python Modules │
│  (SSL)  │ │ (Estadísticas) │
└───────┘ └──────────────┘
```

1. La app Electron envía request a `/evaluaciones/run`
2. El proxy valida el JWT token
3. Consulta los datos de entrada desde PostgreSQL
4. Ejecuta los módulos Python correspondientes
5. Guarda resultados (gráficos, dataframes) en PostgreSQL
6. Retorna respuesta al cliente

## Troubleshooting

### Error de certificado SSL
```
ERR_TLS_CERT_ALTNAME_INVALID: Host: X is not cert's CN: Y
```
**Solución**: El `PGHOST` debe coincidir con el `CN` del certificado SSL.

### Ver logs del proxy
```bash
sudo journalctl -u cerper-proxy -f  # En tiempo real
sudo journalctl -u cerper-proxy -n 100  # Últimas 100 líneas
```

### Verificar conexión a PostgreSQL
```bash
psql -h localhost -U cerper_user -d cerperstats
```

### Reiniciar todo
```bash
sudo systemctl restart postgresql
sudo systemctl restart cerper-proxy
```

## Despliegue de Actualizaciones

1. Subir archivos actualizados al servidor (ej: vía `scp` o `rsync`)
2. Si hay nuevas dependencias Node.js:
   ```bash
   cd /home/ubuntu/cerper-eval/proxy
   npm install
   ```
3. Reiniciar el proxy:
   ```bash
   sudo systemctl restart cerper-proxy
   ```

## Módulos Python de Evaluación

### Estructura de un Módulo

Cada módulo de evaluación estadística tiene la siguiente estructura:

```
modules/python/{module_id}/
├── principal.py    # Lógica principal de la evaluación
└── graph.py        # Generación de gráficos (matplotlib/plotly)
```

### Manifest de Módulos

El archivo `modules/_common/modules_manifest.json` registra todos los módulos disponibles:

```json
{
  "entries": [
    {
      "module_id": 1,
      "catalog_id": 1,
      "name": "Prueba de Normalidad",
      "runtime": "python"
    },
    {
      "module_id": 2,
      "catalog_id": 2,
      "name": "Prueba de Homogeneidad",
      "runtime": "python"
    }
  ]
}
```

### Entorno Virtual Python

El entorno virtual está en `/home/ubuntu/cerper-eval/.env/`:

```bash
# Activar entorno virtual
source /home/ubuntu/cerper-eval/.env/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Desactivar
deactivate
```

**Dependencias típicas:**
- `pandas` - Manipulación de datos
- `numpy` - Cálculos numéricos
- `scipy` - Estadísticas
- `matplotlib` - Gráficos
- `plotly` - Gráficos interactivos

## Base de Datos PostgreSQL

### Tablas Principales

| Tabla | Descripción |
|-------|-------------|
| `usuarios` | Usuarios del sistema |
| `sessions` | Sesiones de análisis |
| `inputs_monoanalito` | Datos de entrada (monoanalito) |
| `inputs_multianalito` | Datos de entrada (multianalito) |
| `tests_catalog` | Catálogo de pruebas estadísticas |
| `test_modules` | Módulos asociados a cada prueba |
| `results_general` | Resultados de evaluaciones (gráficos, dataframes) |
| `session_selected_tests` | Pruebas seleccionadas por sesión |
| `logs_sistema` | Logs de auditoría |

### Configuración de Formateo (`tests_catalog`)

El frontend puede renderizar etiquetas y estilos desde DB usando:
- `tests_catalog.column_labels` (JSONB): `{ "p_value": "P-Value", "prueba_normalidad": "Prueba", ... }`
- `tests_catalog.value_mappings` (JSONB): `{ "normal_dist": { "label": "✓ Sí", "class": "df-value-true", "style": { "text_color": "#059669", "bg_from": "rgba(16,185,129,0.12)", "bg_to": "rgba(5,150,105,0.08)" } } }`

Nota: por seguridad, el cliente solo acepta colores `#hex`, `rgb()`, `rgba()` o `transparent` desde `style`.

### Campos Importantes en `results_general`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | serial | ID único del resultado |
| `session_id` | int | ID de la sesión |
| `catalog_id` | int | ID del test del catálogo |
| `nivel` | int | Nivel del análisis |
| `analito` | varchar | Nombre del analito |
| `resultado_pc` | jsonb | Dataframe con resultados |
| `grafico_data` | text | Imagen en base64 |
| `conclusion` | text | Conclusión del análisis |
| `conclusion_status` | varchar | Estado: 'ok', 'warning', 'danger' |
| `creado_en` | timestamp | Fecha de creación |

### Conexión Manual

```bash
# Conectar a PostgreSQL
psql -h localhost -U cerper_user -d cerperstats

# Consultas útiles
\dt                          # Listar tablas
\d results_general           # Describir tabla
SELECT COUNT(*) FROM results_general WHERE session_id = 123;
```

## Seguridad

### Autenticación JWT

El proxy usa JWT para autenticar requests:

1. El cliente hace login en `/auth/login`
2. Si es válido, el cliente guarda el token
3. En cada request, envía el header: `Authorization: Bearer <token>`
4. El proxy valida el token con el secreto en `secrets/token_secret.txt`

### Generación de Token (para desarrollo)

```bash
cd /home/ubuntu/cerper-eval/proxy
node gen-token.js
```

### SSL/TLS

- PostgreSQL usa SSL obligatorio (`ssl = on` en postgresql.conf)
- El proxy valida el certificado del servidor (`rejectUnauthorized: true`)
- Los certificados están en `/etc/postgresql/certs/`

## Monitoreo

### Verificar Estado de Servicios

```bash
# Estado del proxy
sudo systemctl status cerper-proxy

# Estado de PostgreSQL
sudo systemctl status postgresql

# Uso de disco
df -h

# Uso de memoria
free -h

# Procesos Node.js
ps aux | grep node

# Procesos PostgreSQL
ps aux | grep postgres
```

### Logs

```bash
# Logs del proxy (tiempo real)
sudo journalctl -u cerper-proxy -f

# Logs de PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-*-main.log

# Logs del sistema
sudo tail -f /var/log/syslog
```

## Backup

### Backup de Base de Datos

```bash
# Crear backup
pg_dump -h localhost -U cerper_user -d cerperstats > backup_$(date +%Y%m%d).sql

# Restaurar backup
psql -h localhost -U cerper_user -d cerperstats < backup_20260105.sql
```

### Backup de Archivos

```bash
# Backup completo del directorio
tar -czvf cerper-eval-backup.tar.gz /home/ubuntu/cerper-eval/
```

## IP y Red

- **IP Estática (pública)**: `3.210.242.5`
- **IP Privada**: `172.26.5.56`
- **Puerto del Proxy**: `4000`
- **Puerto PostgreSQL**: `5432` (solo localhost)

### Firewall (si aplica)

```bash
# Ver reglas
sudo ufw status

# Permitir puerto del proxy (si es necesario)
sudo ufw allow 4000/tcp
```
