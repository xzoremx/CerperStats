/**
 * Auth Guard - Protege páginas que requieren autenticación válida
 * Incluir este script en todas las páginas excepto login.html
 *
 * Funcionalidades:
 * 1. Verifica que el usuario esté logueado (currentUser en main process)
 * 2. Verifica el token del proxy al cargar la página
 * 3. Escucha eventos de sesión expirada durante el uso
 * 4. Redirige a login.html cuando la autenticación falla
 */
(function() {
  'use strict';

  const AUTH_GUARD_INITIALIZED = '__authGuardInitialized';
  if (window[AUTH_GUARD_INITIALIZED]) return;
  window[AUTH_GUARD_INITIALIZED] = true;

  /**
   * Redirige a login limpiando la sesión
   */
  async function redirectToLogin(reason = 'session_expired') {
    console.warn('[AuthGuard] Redirigiendo a login:', reason);

    // Limpiar sessionStorage
    sessionStorage.clear();

    // Limpiar estado de autenticación en main process
    if (window.cerper?.logout) {
      try { await window.cerper.logout(); } catch (_) {}
    }

    // Redirigir a login
    if (window.cerper?.openPage) {
      window.cerper.openPage('login.html');
    } else {
      window.location.href = 'login.html';
    }
  }

  /**
   * Muestra mensaje de error antes de redirigir
   */
  function showExpiredMessage(message, autoRedirect = true) {
    // Evitar múltiples overlays
    if (document.getElementById('auth-expired-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'auth-expired-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 15, 18, 0.95);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      backdrop-filter: blur(8px);
    `;

    const box = document.createElement('div');
    box.style.cssText = `
      background: linear-gradient(135deg, rgba(30,30,35,0.98), rgba(20,20,25,0.98));
      border: 1px solid rgba(255,100,100,0.3);
      border-radius: 16px;
      padding: 32px 48px;
      text-align: center;
      max-width: 400px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    `;

    box.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 16px;">&#9888;&#65039;</div>
      <h2 style="color: #ff8080; margin: 0 0 12px 0; font-size: 20px;">Sesión Expirada</h2>
      <p style="color: #a0a0a0; margin: 0 0 24px 0; font-size: 14px;">${message || 'Tu sesión ha expirado. Serás redirigido al inicio de sesión.'}</p>
      <div style="color: #606060; font-size: 12px;">Redirigiendo en <span id="auth-countdown">3</span>s...</div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    if (autoRedirect) {
      let countdown = 3;
      const countdownEl = document.getElementById('auth-countdown');

      const interval = setInterval(() => {
        countdown--;
        if (countdownEl) countdownEl.textContent = countdown;
        if (countdown <= 0) {
          clearInterval(interval);
          redirectToLogin('token_expired');
        }
      }, 1000);
    }
  }

  /**
   * Verifica la sesión del usuario en el main process
   */
  async function verifyUserSession() {
    if (!window.cerper?.getCurrentUser) return true;

    try {
      const res = await window.cerper.getCurrentUser();
      if (!res?.ok || !res?.user) {
        return false;
      }
      return true;
    } catch (err) {
      console.error('[AuthGuard] Error verificando usuario:', err);
      return false;
    }
  }

  /**
   * Verifica el token del proxy
   */
  async function verifyProxyToken() {
    if (!window.cerper?.verifyToken) return { valid: true }; // Si no está disponible, asumir válido

    try {
      const result = await window.cerper.verifyToken();
      if (result.ok && result.valid === false) {
        return { valid: false, reason: result.reason || 'token_expired' };
      }
      if (!result.ok) {
        // Error de conexión - no invalidar la sesión por errores de red
        console.warn('[AuthGuard] Error de conexión al verificar token:', result.error);
        return { valid: true, connectionError: true };
      }
      return { valid: true };
    } catch (err) {
      console.error('[AuthGuard] Error verificando token:', err);
      return { valid: true, connectionError: true };
    }
  }

  /**
   * Verificación completa al cargar la página
   */
  async function verifyOnLoad() {
    // 1. Verificar sesión del usuario
    const userValid = await verifyUserSession();
    if (!userValid) {
      redirectToLogin('no_user_session');
      return;
    }

    // 2. Verificar token del proxy
    const tokenResult = await verifyProxyToken();
    if (!tokenResult.valid) {
      showExpiredMessage('El token de autenticación ha expirado.');
    }
  }

  /**
   * Inicializa el guard
   */
  function init() {
    // Registrar listener para eventos de sesión expirada (401 durante uso)
    if (window.cerper?.onSessionExpired) {
      window.cerper.onSessionExpired((data) => {
        showExpiredMessage(data?.message || 'La sesión ha expirado.');
      });
    }

    // Verificar al cargar la página
    verifyOnLoad();
  }

  // Esperar a que cerper esté disponible
  if (window.cerper) {
    init();
  } else {
    // Esperar un momento por si el preload aún no terminó
    const checkCerper = setInterval(() => {
      if (window.cerper) {
        clearInterval(checkCerper);
        init();
      }
    }, 50);

    // Timeout después de 2 segundos
    setTimeout(() => {
      clearInterval(checkCerper);
      if (!window.cerper) {
        console.error('[AuthGuard] window.cerper no disponible después de 2s');
      }
    }, 2000);
  }
})();
