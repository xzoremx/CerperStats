# 🚀 Pasos para Generar el Ejecutable - CerperStats

## ✅ Estado Actual

- [x] Archivo `.env` creado con URL del backend
- [x] Script `embed-config.js` mejorado con validaciones
- [x] Documentación completa creada
- [ ] Backend verificado (debes hacerlo tú)
- [ ] Ejecutable generado
- [ ] Ejecutable probado en otra PC

---

## 📍 Paso 1: Verificar que el Backend Esté Corriendo

Antes de generar el ejecutable, **verifica que tu servidor backend esté accesible**:

```bash
# Desde tu navegador o terminal en tu laptop:
curl https://someone-teddy-about-strengths.trycloudflare.com/auth/verify
```

**Deberías recibir**:
- Una respuesta JSON (puede ser error 401 o similar)
- **NO** un error de conexión o timeout

**Si el servidor NO responde**:
1. Asegúrate de que el proceso `proxy` esté corriendo
2. Verifica que el túnel de Cloudflare esté activo
3. Prueba acceder manualmente a la URL desde tu navegador

---

## 📍 Paso 2: Generar el Ejecutable

Una vez verificado el backend:

```bash
# Asegúrate de estar en el directorio del proyecto
cd /ruta/a/CerperStats

# Generar el ejecutable
npm run dist:win
```

### ¿Qué va a pasar?

El script ejecutará automáticamente:

1. **`prebuild`** (se ejecuta automáticamente):
   - ✅ Copia Chromium de Puppeteer → `chrome-bundled/`
   - ✅ Valida que `.env` existe
   - ✅ Valida que `CERPER_PROXY_URL` está configurado
   - ✅ Genera `config/embedded-env.js` con la URL ofuscada

2. **`electron-builder`**:
   - ✅ Empaqueta la aplicación
   - ✅ Incluye Chrome en `extraResources/chrome-win64/`
   - ✅ Crea el ejecutable portable

3. **Resultado**:
   ```
   dist/CerperStats-Portable-<version>.exe
   ```

### Tiempo estimado
- ~5-10 minutos dependiendo de tu máquina
- El paso más lento es copiar Chromium (~300 MB)

---

## 📍 Paso 3: Probar el Ejecutable

### En tu laptop (donde lo compilaste):

```bash
# Ejecutar directamente desde dist/
./dist/CerperStats-Portable-*.exe
```

**Prueba**:
1. Abrir la app
2. Intentar hacer login
3. Verificar que NO muestre "fetch fail"
4. Verificar que se conecte al backend correctamente

### En otra PC (la prueba real):

1. **Copia el ejecutable** a otra PC:
   ```
   dist/CerperStats-Portable-<version>.exe
   ```

2. **Requisitos en la otra PC**:
   - Windows 10/11 (x64)
   - Conexión a internet (para acceder al backend)
   - **NO necesita** Node.js, npm, ni nada instalado

3. **Ejecutar y probar login**

**Si funciona**: ✅ ¡Problema resuelto!

**Si aún muestra "fetch fail"**:
- Verifica que la otra PC tenga acceso a internet
- Verifica que el backend siga corriendo
- Verifica que la URL de Cloudflare Tunnel siga activa
- Abre DevTools (Ctrl+Shift+I) y revisa errores en Console/Network

---

## 🐛 Problemas Comunes Durante el Build

### Error: "Archivo .env no encontrado"
**Solución**: Ya está resuelto, el archivo `.env` ya existe.

### Error: "chrome-bundled not found"
**Causa**: Puppeteer no está instalado correctamente
**Solución**:
```bash
rm -rf node_modules package-lock.json
npm install
npm run dist:win
```

### Error: "ENOENT: no such file or directory, scandir 'chrome-bundled'"
**Causa**: El script `copy-chrome.js` falló
**Solución**:
```bash
node scripts/copy-chrome.js
npm run dist:win
```

### Advertencia: El build es muy grande (~500 MB)
**Normal**: El ejecutable incluye Chromium completo para generar PDFs.

---

## 📊 Checklist Final

Antes de distribuir el ejecutable a usuarios finales:

- [ ] El backend está en producción (no es temporal)
- [ ] La URL del backend es estable (no cambiará)
- [ ] El backend tiene certificado SSL válido (https://)
- [ ] Probaste el login en al menos 2 PCs diferentes
- [ ] Probaste la generación de PDFs
- [ ] El ejecutable tiene el ícono correcto
- [ ] Renombraste el ejecutable si es necesario

---

## 🔄 ¿Necesitas Cambiar la URL del Backend?

Si en el futuro necesitas cambiar la URL del servidor:

1. Edita `.env` con la nueva URL
2. Vuelve a ejecutar `npm run dist:win`
3. Redistribuye el nuevo ejecutable

**Importante**: No puedes cambiar la URL de un ejecutable ya generado. Debes recompilar.

---

## 📞 Siguiente Paso

**Ejecuta ahora**:
```bash
npm run dist:win
```

Y avísame si encuentras algún error durante el proceso.
