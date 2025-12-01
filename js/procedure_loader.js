// Loader específico para procedure_select (reutilizable por otras vistas si se desea)
(function () {
  const OVERLAY_ID = "procedure-loader";
  const STYLE_ID = "procedure-loader-style";

  // Inyecta estilos apenas cargue el script
  ensureStyle();

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${OVERLAY_ID} {
        position: fixed;
        inset: 0;
        display: grid;
        place-items: center;
        background: rgba(5, 5, 7, 0.82);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        z-index: 5000;
        transition: opacity 200ms ease;
        opacity: 0;
        pointer-events: none;
      }
      #${OVERLAY_ID}.visible {
        opacity: 1;
        pointer-events: auto;
      }
      #${OVERLAY_ID} .loader-box {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: rgba(15, 15, 17, 0.9);
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 18px 45px rgba(0, 0, 0, 0.35);
        color: #e5e7eb;
        font-weight: 600;
        letter-spacing: 0.01em;
      }
      #${OVERLAY_ID} .dots {
        display: inline-flex;
        gap: 6px;
        align-items: center;
      }
      #${OVERLAY_ID} .dots span {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #22d3ee;
        opacity: 0.6;
        animation: procedure-dot 0.9s infinite ease-in-out;
      }
      #${OVERLAY_ID} .dots span:nth-child(2) { animation-delay: 0.15s; }
      #${OVERLAY_ID} .dots span:nth-child(3) { animation-delay: 0.3s; }
      @keyframes procedure-dot {
        0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
        40% { transform: scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureOverlay() {
    ensureStyle();
    let overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = OVERLAY_ID;
      overlay.innerHTML = `
        <div class="loader-box">
          <div class="dots" aria-hidden="true"><span></span><span></span><span></span></div>
          <p class="loader-text" style="margin:0;">Cargando...</p>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  function show(message = "Cargando...") {
    const overlay = ensureOverlay();
    const textEl = overlay.querySelector(".loader-text");
    if (textEl) textEl.textContent = message;
    overlay.classList.add("visible");
  }

  function hide() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    overlay.classList.remove("visible");
  }

  window.procLoader = { show, hide };

  // Si el overlay ya existe en el HTML, asegúrate de que tenga los estilos aplicados.
  ensureOverlay();
})();
