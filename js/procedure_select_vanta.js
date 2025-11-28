(function () {
  let vantaEffect = null;
  const MAX_RETRIES = 20;
  const RETRY_DELAY = 200;
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const LIBRARIES = [
    {
      id: "three-cdn",
      src: "https://unpkg.com/three@0.134.0/build/three.min.js",
      check: () => typeof window.THREE !== "undefined",
    },
    {
      id: "vanta-net-cdn",
      src: "https://unpkg.com/vanta@latest/dist/vanta.net.min.js",
      check: () => typeof window.VANTA?.NET === "function",
    },
  ];

  function destroyVanta() {
    if (vantaEffect?.destroy) {
      vantaEffect.destroy();
    }
    vantaEffect = null;
  }

  function initVanta() {
    if (prefersReducedMotion) return;
    const target = document.getElementById("procedure-hero");
    if (!target || vantaEffect || !window.VANTA?.NET || !window.THREE) return;

    vantaEffect = window.VANTA.NET({
      el: target,
      THREE: window.THREE,
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minHeight: 150.0,
      minWidth: 200.0,
      scale: 1.0,
      scaleMobile: 1.0,
      color: 0x5c6372,
      backgroundColor: 0x0f0f11,
      points: 5.0,
      maxDistance: 14.0,
      spacing: 26.0,
      showDots: true,
    });
  }

  function attemptInit(attempt = 0) {
    if (vantaEffect || attempt > MAX_RETRIES) return;
    if (window.VANTA?.NET && window.THREE) {
      initVanta();
      return;
    }
    setTimeout(() => attemptInit(attempt + 1), RETRY_DELAY);
  }

  function loadLibrary({ id, src, check }) {
    return new Promise((resolve, reject) => {
      if (check()) {
        resolve();
        return;
      }

      const existing = document.getElementById(id);
      if (existing) {
        existing.addEventListener(
          "load",
          () => {
            if (check()) resolve();
            else reject(new Error(`La libreria ${id} no expuso la API esperada`));
          },
          { once: true },
        );
        existing.addEventListener("error", () => reject(new Error(`No se pudo cargar ${src}`)), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.id = id;
      script.src = src;
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.addEventListener(
        "load",
        () => {
          if (check()) resolve();
          else reject(new Error(`La libreria ${id} no expuso la API esperada`));
        },
        { once: true },
      );
      script.addEventListener("error", () => reject(new Error(`No se pudo cargar ${src}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  function loadLibraries() {
    return LIBRARIES.reduce((promise, lib) => promise.then(() => loadLibrary(lib)), Promise.resolve());
  }

  function scheduleInit() {
    if (prefersReducedMotion) return;
    const start = () => {
      loadLibraries()
        .then(() => requestAnimationFrame(() => attemptInit()))
        .catch((err) => console.warn("[CerperStats] No se pudo cargar la animacion del hero:", err));
    };
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(start, { timeout: 800 });
    } else {
      setTimeout(start, 250);
    }
  }

  window.addEventListener("load", scheduleInit);

  window.addEventListener("resize", () => {
    try {
      vantaEffect?.resize?.();
    } catch (err) {
      console.warn("[CerperStats] No se pudo reajustar Vanta NET:", err);
    }
  });

  window.addEventListener("beforeunload", destroyVanta);
})();
