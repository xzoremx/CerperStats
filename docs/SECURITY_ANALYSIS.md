# Analisis de Seguridad - CerperStats

**Fecha de analisis:** 2026-01-16
**Tipo de aplicacion:** Desktop (Electron) + Backend (Express.js/PostgreSQL)
**Contexto:** Aplicacion empresarial para evaluacion estadistica de laboratorios CERPER

---

## Resumen Ejecutivo

CerperStats es una aplicacion de escritorio Electron que se conecta a un backend REST API para gestionar evaluaciones estadisticas de laboratorios. El analisis revela un nivel de seguridad **MODERADO-ALTO** con varias buenas practicas implementadas y mejoras recientes en seguridad.

### Clasificacion de Riesgos (Actualizado)

| Nivel | Cantidad | Descripcion |
|-------|----------|-------------|
| CRITICO | 1 | Credenciales en .env (pendiente) |
| ALTO | 2 | IDOR, interpolacion SQL |
| MEDIO | 5 | Recomendados para hardening |
| BAJO | 3 | Mejoras opcionales |
| MITIGADO | 2 | Sandbox, HTTPS |
| ELIMINADO | 1 | Panel admin removido |

---

## 1. HALLAZGOS CRITICOS

### 1.1 Credenciales Expuestas en Archivo .env (CRITICO)

**Archivo:** `.env` (raiz del proyecto)
**Severidad:** CRITICA
**Estado:** PRESENTE EN REPOSITORIO

**Descripcion:**
El archivo `.env` contiene credenciales en texto plano que NO deberian estar versionadas:

```
PGPASSWORD=PristonXzoreX105
CERPER_PROXY_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
PGHOST=3.210.242.5
```

**Riesgos:**
- Exposicion de credenciales de base de datos de produccion
- Token JWT de cliente comprometido
- IP publica del servidor expuesta
- Cualquier persona con acceso al repositorio tiene acceso completo al sistema

**Recomendaciones:**
1. **INMEDIATO:** Rotar todas las credenciales expuestas (password DB, token JWT, secret)
2. Agregar `.env` al `.gitignore` (verificar que no este ya)
3. Eliminar el archivo del historial de git con `git filter-branch` o BFG Repo-Cleaner
4. Usar un gestor de secretos (AWS Secrets Manager, HashiCorp Vault)
5. Documentar un `.env.example` sin valores reales

### 1.2 Sandbox Habilitado en Electron (CORREGIDO)

**Archivo:** `main.js:121`
**Severidad:** CRITICA (resuelta)

```javascript
webPreferences: {
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
}
```

**Descripcion:**
Se habilito `sandbox: true` para reducir la superficie de ataque del proceso renderer.

**Riesgos (cuando estaba deshabilitado):**
- Si un atacante logra ejecutar codigo en el renderer (XSS), tiene mayor superficie de ataque
- Acceso potencial a APIs del sistema operativo

**Recomendaciones:**
1. Mantener `sandbox: true` habilitado
2. Si se deshabilita por dependencias, documentar la justificacion
3. Implementar Content-Security-Policy estricta

---

## 2. HALLAZGOS DE SEVERIDAD ALTA

### 2.1 HTTPS via Cloudflare Tunnel (MITIGADO)

**Archivo:** `.env`, `config/embedded-env.js`
**Severidad:** ALTA (mitigada)
**Estado:** IMPLEMENTADO via Cloudflare Tunnel

```env
# Configuracion actual (pre-produccion)
CERPER_PROXY_URL=https://someone-teddy-about-strengths.trycloudflare.com/run-eval
```

**Descripcion:**
Se implemento HTTPS mediante Cloudflare Tunnel (Quick Tunnel). El trafico entre el cliente Electron y el backend ahora viaja cifrado.

**Arquitectura:**
```
Cliente Electron --HTTPS--> Cloudflare Edge --HTTP--> localhost:4000 (servidor)
```

**Riesgos mitigados:**
- Tokens JWT ahora viajan cifrados
- Credenciales de login protegidas en transito
- Datos sensibles de evaluaciones cifrados

**Limitaciones actuales (pre-produccion):**
- URL dinamica (cambia si se reinicia cloudflared)
- Para produccion: configurar tunel nombrado con URL fija

**Recomendaciones para produccion:**
1. Configurar tunel nombrado con dominio propio
2. Validar en codigo que `CERPER_PROXY_URL` use `https://`
3. Considerar certificate pinning para mayor seguridad

### ~~2.2 Autenticacion Admin via Header Base64~~ (ELIMINADO)

**Estado:** ELIMINADO - Panel de administracion removido del proyecto.

Los archivos `proxy/routes/admin.js` y `proxy/admin/` fueron eliminados ya que no se planea desarrollar un panel de administracion en esta fase.

### 2.3 Falta de Autorizacion por Recursos (ALTA)

**Archivos:** `proxy/routes/sessions.js`, `proxy/routes/inputs.js`, `proxy/routes/reports.js`
**Severidad:** ALTA

**Descripcion:**
Las rutas protegidas verifican que el token JWT sea valido, pero NO verifican que el usuario tenga permiso para acceder al recurso especifico.

Ejemplo en `sessions.js`:
```javascript
router.get('/:sessionId', async (req, res) => {
  const sessionId = Number(req.params.sessionId);
  // No verifica que la sesion pertenezca al usuario autenticado
  const { rows } = await pool.query(`SELECT s.* FROM sessions s WHERE s.id = $1`, [sessionId]);
});
```

**Riesgos:**
- Un usuario autenticado puede acceder a sesiones de otros usuarios
- IDOR (Insecure Direct Object Reference)
- Escalacion horizontal de privilegios

**Recomendaciones:**
1. Implementar verificacion de ownership en cada endpoint
2. Ejemplo: `WHERE s.id = $1 AND s.usuario_id = $2`
3. Para supervisores/admin: verificar rol antes de permitir acceso cross-user

### 2.4 Inyeccion SQL Potencial por Interpolacion de Tabla (ALTA)

**Archivo:** `proxy/routes/inputs.js:5-10`
**Severidad:** ALTA

```javascript
function resolveInputTable(tipoAnalisis) {
  const normalized = (tipoAnalisis || '').toLowerCase();
  return normalized === 'multi' || normalized === 'multianalito'
    ? 'inputs_multianalito'
    : 'inputs_monoanalito';
}

// Uso:
const table = resolveInputTable(tipoAnalisis);
await pool.query(`INSERT INTO ${table} ...`);  // Interpolacion directa
```

**Descripcion:**
Aunque el valor esta controlado (solo 2 opciones), el patron de interpolar nombres de tabla es peligroso y puede llevar a errores futuros.

**Riesgos:**
- Si se agrega otro valor sin validacion, podria permitir SQL injection
- El patron establece un mal precedente

**Recomendaciones:**
1. Usar mapeo explicito con whitelist
2. Considerar usar ORM o query builder
3. Agregar comentarios de advertencia en el codigo

---

## 3. HALLAZGOS DE SEVERIDAD MEDIA

### 3.1 Rate Limiting Insuficiente para Endpoints Sensibles

**Archivo:** `proxy/server.js:22-36`
**Severidad:** MEDIA

```javascript
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 5,  // 5 intentos
});
```

**Descripcion:**
- Login: 5 intentos cada 15 minutos (adecuado)
- API general: 100 req/min (podria ser insuficiente para ataques)
- Endpoints criticos como `/evaluaciones/run` usan el limite general

**Recomendaciones:**
1. Rate limiting especifico para endpoints costosos (`/evaluaciones/run`)
2. Implementar rate limiting por usuario ademas de por IP
3. Considerar CAPTCHA despues de N intentos fallidos de login

### 3.2 Almacenamiento de Datos Sensibles en SessionStorage

**Archivo:** `js/login.js:48-64`
**Severidad:** MEDIA

```javascript
sessionStorage.setItem("usuario", user.username);
sessionStorage.setItem("usuario_id", user.id);
sessionStorage.setItem("rol", user.rol || "analista");
```

**Descripcion:**
Datos del usuario se almacenan en sessionStorage del renderer process.

**Riesgos:**
- Si hay XSS, estos datos son accesibles
- Datos persisten durante la sesion del navegador

**Recomendaciones:**
1. El patron actual (datos en main process + IPC) es correcto
2. Minimizar datos almacenados en renderer
3. No almacenar tokens o credenciales en sessionStorage

### 3.3 Logging de Informacion Sensible

**Archivos:** Multiples
**Severidad:** MEDIA

```javascript
console.error('[API] Error en login', err);
console.log('[REGISTER] Nuevo registro recibido:', createdUsername);
```

**Descripcion:**
Logs pueden contener informacion sensible que termina en archivos de log o consola.

**Recomendaciones:**
1. Implementar logging estructurado (Winston, Pino)
2. Sanitizar datos sensibles antes de loggear
3. Configurar niveles de log apropiados para produccion

### 3.4 Token JWT sin Expiracion Corta

**Archivo:** `.env` (token analizado)
**Severidad:** MEDIA

El token JWT tiene una expiracion relativamente larga. El payload decodificado muestra:
```json
{
  "client": "electron-app",
  "iat": 1768519077,
  "exp": 1768605477  // ~1 dia
}
```

**Recomendaciones:**
1. Implementar refresh tokens
2. Tokens de acceso con expiracion de 15-60 minutos
3. Refresh tokens con expiracion de 7-30 dias
4. Implementar revocacion de tokens

### 3.5 Falta de Validacion de Content-Type

**Archivo:** `proxy/server.js`
**Severidad:** MEDIA

No se valida explicitamente que el Content-Type sea `application/json` antes de procesar el body.

**Recomendaciones:**
1. Agregar middleware para validar Content-Type
2. Rechazar requests con Content-Type inesperado

---

## 4. HALLAZGOS DE SEVERIDAD BAJA

### 4.1 DevTools Accesibles en Produccion

**Archivo:** `main.js:154-157`
**Severidad:** BAJA

```javascript
} else if (key === 'i' && input.shift) {
  event.preventDefault();
  mainWindow.webContents.toggleDevTools();
}
```

**Descripcion:**
Los DevTools pueden abrirse con Ctrl+Shift+I incluso en builds de produccion.

**Recomendaciones:**
1. Deshabilitar DevTools en produccion
2. `webPreferences: { devTools: !app.isPackaged }`

### 4.2 Headers de Seguridad HTTP Faltantes

**Archivo:** `proxy/server.js`
**Severidad:** BAJA

No se configuran headers de seguridad HTTP.

**Recomendaciones:**
1. Implementar Helmet.js
2. Headers recomendados:
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Strict-Transport-Security` (con HTTPS)
   - `Content-Security-Policy`

### 4.3 Soft Delete sin Anonimizacion

**Archivo:** `proxy/routes/admin.js:298-333`
**Severidad:** BAJA

```javascript
// Soft delete: marcar como inactivo
const result = await pool.query(`
  UPDATE usuarios SET activo = false WHERE id = $1
`, [userId]);
```

**Descripcion:**
Al "eliminar" usuarios, los datos personales permanecen en la base de datos.

**Recomendaciones:**
1. Considerar anonimizacion de datos para cumplir con GDPR/regulaciones locales
2. Documentar politica de retencion de datos

---

## 5. BUENAS PRACTICAS IMPLEMENTADAS

### 5.1 Seguridad en Electron (Correctamente Implementado)

| Configuracion | Estado | Archivo |
|---------------|--------|---------|
| `contextIsolation` | true | `main.js:119` |
| `nodeIntegration` | false | `main.js:120` |
| `enableRemoteModule` | false | `main.js:122` |
| `webSecurity` | true | `main.js:123` |
| `allowRunningInsecureContent` | false | `main.js:124` |

### 5.2 Sistema de URLs Externas Seguro

**Archivo:** `js/security/external_url_security.js`

Implementacion robusta de:
- Whitelist de dominios permitidos
- Bloqueo de protocolos peligrosos (`javascript:`, `data:`, `file:`)
- Validacion de mailto
- Logging de intentos bloqueados
- Prevencion de navegacion no autorizada

### 5.3 Hashing de Contrasenas con bcrypt

**Archivo:** `proxy/routes/auth.js:40`, `proxy/routes/register.js:167`

```javascript
const isValid = await bcrypt.compare(password, user.hash_password);
const hash_password = await bcrypt.hash(password, saltRounds);  // saltRounds = 10
```

### 5.4 Prevencion de Enumeracion de Usuarios

**Archivo:** `proxy/routes/register.js:116`

El registro devuelve respuesta generica independientemente de si el username existe.

### 5.5 Validacion de Inputs en Frontend

**Archivo:** `js/input_data/validation_utils.js`

Funciones puras de validacion bien estructuradas para datos numericos.

### 5.6 Lista Blanca de Rutas en Electron

**Archivo:** `main.js:10-26`

```javascript
const ROUTES = new Set([
  'login.html',
  'menu.html',
  // ...
]);
```

Solo las rutas explicitamente permitidas pueden ser cargadas.

### 5.7 SSL en Conexion a PostgreSQL

**Archivo:** `proxy/db.js:15-21`

```javascript
ssl: {
  rejectUnauthorized: true,
  ca: fs.existsSync(certPath) ? fs.readFileSync(certPath).toString() : undefined,
}
```

### 5.8 Autenticacion JWT para API

**Archivo:** `proxy/server.js:112-122`

Middleware `verifyToken` aplicado a todas las rutas protegidas.

### 5.9 Rate Limiting Implementado

**Archivo:** `proxy/server.js:22-36`

Limitacion de intentos de login y requests generales.

### 5.10 Logging de Auditoria

**Archivo:** `proxy/routes/auth.js:42-48`, `proxy/routes/admin.js:176-179`

Acciones criticas (login, creacion/modificacion de usuarios) se registran en `logs_sistema`.

---

## 6. RECOMENDACIONES PARA DESPLIEGUE EMPRESARIAL

### 6.1 Infraestructura

1. **HTTPS Obligatorio**
   - Certificados TLS validos (Let's Encrypt o CA empresarial)
   - Redireccion HTTP -> HTTPS
   - HSTS habilitado

2. **Segmentacion de Red**
   - Backend en red privada
   - Solo exponer puertos necesarios
   - Firewall con reglas restrictivas

3. **Backup y Recuperacion**
   - Backups cifrados de PostgreSQL
   - Pruebas periodicas de restore
   - RPO/RTO definidos

### 6.2 Gestion de Secretos

1. **Nunca versionar secretos**
2. Usar gestores de secretos (AWS Secrets Manager, HashiCorp Vault)
3. Rotacion periodica de credenciales
4. Secretos diferentes por ambiente (dev/staging/prod)

### 6.3 Monitoreo y Alertas

1. Monitoreo de intentos de login fallidos
2. Alertas por patrones anomalos
3. Logging centralizado (ELK, CloudWatch)
4. Health checks automatizados

### 6.4 Actualizaciones

1. Mantener dependencias actualizadas (`npm audit`)
2. Monitorear CVEs de Electron, Node.js, PostgreSQL
3. Plan de parcheo de emergencia

### 6.5 Politicas de Acceso

1. Principio de minimo privilegio
2. Revision periodica de usuarios activos
3. Desactivacion automatica por inactividad
4. Logs de acceso admin auditados

---

## 7. MATRIZ DE REMEDIACION PRIORIZADA

| # | Hallazgo | Severidad | Estado | Prioridad |
|---|----------|-----------|--------|-----------|
| 1 | Credenciales en .env | CRITICA | PENDIENTE | INMEDIATO |
| 2 | Rotar credenciales expuestas | CRITICA | PENDIENTE | INMEDIATO |
| 3 | ~~Implementar HTTPS~~ | ~~ALTA~~ | COMPLETADO | ~~Semana 1~~ |
| 4 | Autorizacion por recursos (IDOR) | ALTA | PENDIENTE | Semana 1-2 |
| 5 | ~~Habilitar sandbox Electron~~ | ~~CRITICA~~ | COMPLETADO | ~~Semana 1~~ |
| 6 | ~~Panel admin~~ | ~~ALTA~~ | ELIMINADO | N/A |
| 7 | Rate limiting granular | MEDIA | PENDIENTE | Semana 2 |
| 8 | Headers de seguridad (Helmet) | BAJA | PENDIENTE | Semana 3 |
| 9 | Refresh tokens | MEDIA | PENDIENTE | Semana 3-4 |
| 10 | Deshabilitar DevTools prod | BAJA | PENDIENTE | Semana 3 |

### Progreso de Remediacion

- **COMPLETADO:** 2 items (Sandbox, HTTPS)
- **ELIMINADO:** 1 item (Panel admin removido)
- **PENDIENTE CRITICO:** 2 items (Credenciales .env)
- **PENDIENTE ALTO:** 1 item (IDOR)

---

## 8. CONCLUSION

CerperStats demuestra un esfuerzo consciente por implementar seguridad, especialmente en la capa de Electron donde se siguen las mejores practicas (context isolation, node integration deshabilitado, sandbox habilitado, whitelist de rutas).

**Mejoras recientes implementadas:**
- HTTPS via Cloudflare Tunnel (pre-produccion)
- Sandbox habilitado en Electron

**Vulnerabilidades pendientes para produccion:**

1. **Credenciales expuestas** en el repositorio (CRITICO)
2. **Falta de autorizacion** a nivel de recursos - IDOR (ALTO)

**Para produccion se recomienda:**
- Remediar inmediatamente las credenciales en .env
- Implementar verificacion de ownership en endpoints
- Configurar tunel Cloudflare nombrado con URL fija
- Implementar un proceso de revision de seguridad antes de cada release
- Considerar una auditoria de seguridad externa antes del go-live

---

**Analisis realizado por:** Claude (Analista de Ciberseguridad)
**Metodologia:** Revision estatica de codigo fuente
**Alcance:** Cliente Electron, Backend Express.js, configuracion
**Limitaciones:** No incluye pruebas de penetracion ni analisis dinamico
