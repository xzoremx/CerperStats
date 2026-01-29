# CerperStats – Backend con Docker (Proxy + PostgreSQL)

Este setup permite levantar el backend completo con `docker compose`:

- `proxy` (Node/Express) + Python (venv `.env/`) + módulos en `modules/`
- `postgres` (DB) con volumen persistente

> Recomendado para migraciones AWS → on‑prem y para entornos donde se quiere evitar instalar Node/Python/Postgres manualmente.

## Requisitos

- Docker Engine
- Docker Compose (plugin `docker compose`)

## 1) Preparar secretos

En el host donde correrá Docker:

1. Crear carpeta `secrets/`
2. Crear `secrets/token_secret.txt` (un string aleatorio)

Ejemplo:
```bash
mkdir -p secrets
openssl rand -hex 32 > secrets/token_secret.txt
```

## 2) Variables de entorno para Docker Compose

Crea un archivo `.env` en el mismo folder que `docker-compose.yml`:

```env
POSTGRES_PASSWORD=una_clave_fuerte
CERPER_EVAL_CONCURRENCY_MULTI=1
```

## 3) Levantar servicios

```bash
docker compose up -d --build
```

Health check del proxy:
```bash
curl http://localhost:4000/health
```

## AWS (build en servidor con layout `/home/ubuntu/cerper-eval`)

En AWS tu carpeta normalmente tiene `proxy/` con su propio `package.json` (no existe el `package.json` del repo raíz).
En ese caso construye usando:

```bash
cd /home/ubuntu/cerper-eval
docker build -f proxy/Dockerfile.aws -t cerperstats-proxy:latest .
```

## 4) Migrar datos desde AWS (recomendado)

En AWS (Lightsail/Ubuntu), generar dump en formato custom:
```bash
pg_dump -h localhost -U cerper_user -d cerperstats -Fc -f cerperstats.dump
```

Copiar `cerperstats.dump` al host on‑prem (PC/VM con Docker).

Restaurar dentro del contenedor:
```bash
docker compose exec -T postgres pg_restore -U cerper_user -d cerperstats -c < cerperstats.dump
```

## 5) Notas importantes

- PostgreSQL queda expuesto solo a `localhost` por `127.0.0.1:5432:5432`. Si TI necesita acceder desde otra máquina, cambien el binding con cuidado.
- En Docker, por defecto el proxy usa `CERPER_PG_SSL=false` (sin SSL entre contenedores). Para entornos que exigen SSL, ajusta `proxy/db.js` y monta certificados.
- El volumen `cerper_pgdata` contiene la DB. Para backup:
  ```bash
  docker compose exec -T postgres pg_dump -U cerper_user -d cerperstats -Fc > backup.dump
  ```
