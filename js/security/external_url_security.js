const { shell } = require('electron');
const { fileURLToPath } = require('url');
const path = require('path');

// === Sistema de seguridad de URLs externas ===
/**
 * Gestor centralizado de seguridad para URLs externas
 * Implementa: whitelist de dominios, validación estricta de protocolos,
 * sanitización y logging estructurado
 */
class ExternalUrlSecurityManager {
  constructor() {
    // Whitelist de dominios permitidos (solo estos dominios pueden abrirse)
    this.allowedDomains = new Set([
      'api.whatsapp.com',
      'fonts.googleapis.com',
      'fonts.gstatic.com',
      'unpkg.com', // Para Lucide icons CDN
    ]);

    // Protocolos permitidos (solo estos)
    this.allowedProtocols = new Set(['https:', 'http:', 'mailto:']);

    // Protocolos peligrosos explícitamente bloqueados
    this.dangerousProtocols = new Set([
      'javascript:',
      'data:',
      'vbscript:',
      'file:',
      'chrome-extension:',
      'chrome:',
      'edge:',
      'about:',
      'feed:',
    ]);

    // Caracteres peligrosos que indican intento de inyección
    this.dangerousChars = /[<>`]/;
    
    // Regex para validar formato de email básico
    this.emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  }

  /**
   * Normaliza y extrae el dominio de una URL
   * @param {URL} parsedUrl - URL parseada
   * @returns {string|null} - Dominio normalizado o null
   */
  extractDomain(parsedUrl) {
    const hostname = parsedUrl.hostname;
    if (!hostname) return null;
    
    // Normalizar: remover www. y convertir a minúsculas
    return hostname.replace(/^www\./, '').toLowerCase();
  }

  /**
   * Valida una URL mailto
   * @param {URL} parsedUrl - URL parseada
   * @returns {boolean} - true si es válida
   */
  validateMailto(parsedUrl) {
    const email = parsedUrl.pathname || parsedUrl.toString().replace(/^mailto:/i, '');
    if (!email || !email.includes('@')) {
      return false;
    }
    // Validar formato básico de email
    return this.emailRegex.test(email.split('?')[0].split('&')[0]);
  }

  /**
   * Valida si una URL está en la whitelist de dominios
   * @param {URL} parsedUrl - URL parseada
   * @returns {boolean} - true si está permitida
   */
  isDomainAllowed(parsedUrl) {
    const domain = this.extractDomain(parsedUrl);
    if (!domain) return false;
    return this.allowedDomains.has(domain);
  }

  /**
   * Valida si una URL es segura para abrir externamente
   * @param {string} url - URL a validar
   * @returns {{safe: boolean, reason?: string}} - Resultado de la validación
   */
  validateUrl(url) {
    // Validación básica de tipo y formato
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return { safe: false, reason: 'URL vacía o inválida' };
    }

    // Detectar caracteres peligrosos antes de parsear
    if (this.dangerousChars.test(url)) {
      return { safe: false, reason: 'Caracteres peligrosos detectados' };
    }

    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol.toLowerCase();

      // Bloquear protocolos peligrosos
      if (this.dangerousProtocols.has(protocol)) {
        return { safe: false, reason: `Protocolo peligroso bloqueado: ${protocol}` };
      }

      // Solo permitir protocolos específicos
      if (!this.allowedProtocols.has(protocol)) {
        return { safe: false, reason: `Protocolo no permitido: ${protocol}` };
      }

      // Validación específica por protocolo
      if (protocol === 'mailto:') {
        if (!this.validateMailto(parsedUrl)) {
          return { safe: false, reason: 'Formato de email inválido' };
        }
        // mailto está permitido si pasa la validación de formato
        return { safe: true };
      }

      // Para http/https, validar dominio contra whitelist
      if (protocol === 'http:' || protocol === 'https:') {
        const domain = this.extractDomain(parsedUrl);
        if (!this.isDomainAllowed(parsedUrl)) {
          return { 
            safe: false, 
            reason: `Dominio no permitido: ${domain || 'desconocido'}` 
          };
        }
        return { safe: true, domain };
      }

      return { safe: false, reason: 'Validación no implementada para este protocolo' };
    } catch (err) {
      // Si no se puede parsear, no es segura
      return { safe: false, reason: `Error parseando URL: ${err.message}` };
    }
  }

  /**
   * Registra intento de acceso bloqueado (para auditoría)
   * @param {string} url - URL bloqueada
   * @param {string} reason - Razón del bloqueo
   */
  logBlockedAttempt(url, reason) {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [CerperStats:URLSecurity] BLOQUEO:`, {
      url: url.substring(0, 100), // Limitar longitud en logs
      reason,
      type: 'external_url_attempt'
    });
  }

  /**
   * Registra acceso permitido (para auditoría)
   * @param {string} url - URL permitida
   * @param {string|null} domain - Dominio extraído (opcional, solo para http/https)
   */
  logAllowedAccess(url, domain) {
    const timestamp = new Date().toISOString();
    let domainInfo = domain;
    
    // Si no se proporciona dominio, intentar extraerlo (solo para http/https)
    if (!domainInfo && url && (url.startsWith('http://') || url.startsWith('https://'))) {
      try {
        domainInfo = this.extractDomain(new URL(url));
      } catch (e) {
        domainInfo = 'unknown';
      }
    } else if (!domainInfo) {
      // Para mailto y otros protocolos sin dominio
      domainInfo = 'N/A';
    }
    
    console.log(`[${timestamp}] [CerperStats:URLSecurity] PERMITIDO:`, {
      domain: domainInfo,
      type: 'external_url_access'
    });
  }
}

// Instancia global del gestor de seguridad
const urlSecurityManager = new ExternalUrlSecurityManager();

/**
 * Función de validación pública (mantiene compatibilidad)
 * @param {string} url - URL a validar
 * @returns {boolean} - true si es segura
 */
function isSafeExternalUrl(url) {
  const result = urlSecurityManager.validateUrl(url);
  if (!result.safe) {
    urlSecurityManager.logBlockedAttempt(url, result.reason);
    return false;
  }
  urlSecurityManager.logAllowedAccess(url, result.domain);
  return true;
}

function openExternalIfSafe(url, event) {
  if (event) event.preventDefault();
  if (!isSafeExternalUrl(url)) return;

  shell.openExternal(url).catch(err => {
    console.error('[CerperStats] Error abriendo URL externa:', url, err);
  });
}

function isAllowedLocalFileNavigation(navigationUrl, appRoot, allowedLocalFiles) {
  try {
    if (!appRoot || !allowedLocalFiles || !(allowedLocalFiles instanceof Set)) {
      return false;
    }
    const filePath = fileURLToPath(navigationUrl);
    const normalizedPath = path.normalize(filePath);
    const insideApp =
      normalizedPath === appRoot || normalizedPath.startsWith(appRoot + path.sep);
    if (!insideApp) return false;
    return allowedLocalFiles.has(normalizedPath);
  } catch {
    return false;
  }
}

function registerExternalUrlSecurity(webContents, { appRoot, allowedLocalFiles } = {}) {
  if (!webContents) {
    throw new Error('[CerperStats] webContents requerido para seguridad de URLs externas');
  }

  // Interceptar enlaces externos y abrirlos en el navegador del sistema
  webContents.setWindowOpenHandler(({ url }) => {
    openExternalIfSafe(url);
    return { action: 'deny' };
  });

  // Interceptar navegación a URLs externas (cuando se hace clic en un enlace)
  webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      const protocol = parsedUrl.protocol.toLowerCase();
      
      if (protocol === 'file:') {
        if (!isAllowedLocalFileNavigation(navigationUrl, appRoot, allowedLocalFiles)) {
          event.preventDefault();
          console.warn('[CerperStats] Navegacion file:// bloqueada:', navigationUrl);
        }
        return;
      }

      // Solo interceptar URLs externas (http, https, mailto)
      if (protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:') {
        openExternalIfSafe(navigationUrl, event);
        return;
      }
      // Bloquear cualquier otro protocolo
      event.preventDefault();
      console.warn('[CerperStats] Protocolo de navegacion no permitido:', protocol);
    } catch (err) {
      // Si no se puede parsear la URL, prevenir navegación por seguridad
      event.preventDefault();
      console.warn('[CerperStats] Error parseando URL, navegación bloqueada:', navigationUrl, err.message);
    }
  });
}

module.exports = {
  registerExternalUrlSecurity,
};

