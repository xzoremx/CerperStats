# 📦 Instrucciones para Generar el Ejecutable

## ⚠️ **IMPORTANTE: Configuración Previa Requerida**

Antes de generar el ejecutable, **debes configurar la URL del servidor backend**. Sin esto, el ejecutable **NO FUNCIONARÁ** en otras PCs.

---

## 🔧 **Pasos para Configurar y Generar el Build**

### **1. Configurar el Archivo .env**

El ejecutable necesita saber dónde está el servidor backend para funcionar correctamente.

```bash
# 1. Copia el archivo de ejemplo
cp .env.example .env

# 2. Edita el archivo .env
# Usa tu editor favorito (nano, vim, notepad, VSCode, etc.)
nano .env
```

### **2. Configurar la URL del Backend**

Edita `.env` y configura `CERPER_PROXY_URL` con la URL real de tu servidor:

#### **Para desarrollo local** (solo funciona en tu PC):
```env
CERPER_PROXY_URL=http://localhost:4000
```

#### **Para distribución** (funciona en cualquier PC):
```env
CERPER_PROXY_URL=https://tu-servidor.com
CERPER_PROXY_TOKEN=tu_token_secreto_aqui
```

**Ejemplos de URLs válidas:**
- `https://api.cerper.com`
- `https://servidor.ejemplo.com:8080`
- `https://tu-dominio.trycloudflare.com`
- `http://192.168.1.100:4000` (solo funciona en la misma red)

### **3. Generar el Ejecutable**

```bash
# Instalar dependencias (si aún no lo hiciste)
npm install

# Generar el ejecutable Windows
npm run dist:win
```

El script automáticamente:
1. ✅ Validará que `.env` existe
2. ✅ Verificará que `CERPER_PROXY_URL` esté configurado
3. ⚠️ Advertirá si usas `localhost` (no funcionará en otras PCs)
4. ✅ Generará `config/embedded-env.js` con la configuración ofuscada
5. ✅ Copiará Chrome/Chromium para generación de PDFs
6. ✅ Creará el ejecutable en la carpeta `dist/`

---

## 📍 **Ubicación del Ejecutable**

Después del build, el ejecutable estará en:

```
dist/CerperStats-Portable-<version>.exe
```

---

## 🐛 **Solución de Problemas Comunes**

### **Error: "Archivo .env no encontrado"**

**Causa**: No creaste el archivo `.env`

**Solución**:
```bash
cp .env.example .env
nano .env  # Edita y configura CERPER_PROXY_URL
```

---

### **Error: "CERPER_PROXY_URL no está configurado"**

**Causa**: El archivo `.env` existe pero está vacío o no tiene `CERPER_PROXY_URL`

**Solución**:
```bash
nano .env  # Agrega: CERPER_PROXY_URL=https://tu-servidor.com
```

---

### **Advertencia: "CERPER_PROXY_URL está configurado con localhost"**

**Causa**: Estás usando `localhost` o `127.0.0.1`

**Impacto**: El ejecutable **NO funcionará en otras PCs** porque intentará conectarse a `localhost` (que no existe en esas máquinas).

**Solución**: Cambia a una URL pública o IP accesible desde otras PCs:
```env
CERPER_PROXY_URL=https://tu-servidor.com
```

---

### **El ejecutable muestra "fetch fail" al hacer login en otra PC**

**Causa**: Alguna de estas:
1. No configuraste `.env` antes del build
2. Usaste `localhost` en `.env`
3. El servidor backend no está accesible desde la otra PC

**Solución**:
1. Verifica que el servidor backend esté corriendo y accesible públicamente
2. Reconfigura `.env` con la URL correcta
3. Vuelve a generar el ejecutable con `npm run dist:win`

---

## 🔒 **Seguridad**

### **¿Es seguro embeber las URLs en el ejecutable?**

- ✅ **Sí**: Las URLs públicas pueden ser embebidas (ej: `https://api.cerper.com`)
- ⚠️ **Cuidado**: El token (`CERPER_PROXY_TOKEN`) se ofusca con Base64, pero **no es encriptación real**
- 🔐 **Recomendación**: Usa autenticación adicional en el backend (JWT, OAuth, etc.)

### **El archivo .env nunca se incluye en el ejecutable**

Por seguridad, el archivo `.env` está en `.gitignore` y se excluye del build. Solo se embebe la configuración mínima necesaria en `config/embedded-env.js`.

---

## 📋 **Checklist Pre-Build**

Antes de generar el ejecutable para distribución, verifica:

- [ ] Creaste el archivo `.env` (copia de `.env.example`)
- [ ] Configuraste `CERPER_PROXY_URL` con una URL pública/accesible
- [ ] El servidor backend está corriendo y es accesible desde internet
- [ ] (Opcional) Configuraste `CERPER_PROXY_TOKEN` para seguridad adicional
- [ ] No usaste `localhost` ni `127.0.0.1` (a menos que sea solo para pruebas locales)
- [ ] Instalaste las dependencias con `npm install`

---

## 📞 **Soporte**

Si el ejecutable sigue sin funcionar en otras PCs después de seguir estos pasos:

1. Verifica que el servidor backend esté realmente accesible:
   ```bash
   curl https://tu-servidor.com/auth/verify
   ```

2. Revisa los logs del servidor backend

3. Prueba el ejecutable en otra PC con acceso a internet

---

**Última actualización**: $(date)
