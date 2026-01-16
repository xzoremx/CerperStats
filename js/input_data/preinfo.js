// input_data/preinfo.js
import { dataService } from "../../modules/_common/dataService.js";

function clearWizardCache() {
  const keys = [
    // Sesión (wizard / edición)
    "sessionID",
    "monoAnalitoDatos",
    "multiAnalitoDatos",

    // Preinfo
    "metodo",
    "producto",
    "ensayo",
    "expediente",
    "unidad",

    // Pasos 1-4
    "tipoAnalisis",
    "parametroSeleccionado",
    "tipoDato",
    "modoCualitativo",
    "valoresPermitidos",
    "K",
    "lecturasPorParametro",
  ];

  keys.forEach((k) => {
    try {
      sessionStorage.removeItem(k);
    } catch (_) { }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  // === Detectar sessionID sin contexto del wizard (evita contaminación desde vistas) ===
  const activeSessionId = sessionStorage.getItem("sessionID");
  const hasStep4Cache = Boolean(sessionStorage.getItem("K")) && Boolean(sessionStorage.getItem("lecturasPorParametro"));
  if (activeSessionId && !hasStep4Cache) {
    console.warn("[preinfo] sessionID sin cache del paso 4 detectado, limpiando cache del wizard.");
    clearWizardCache();
    window.notify?.("Se limpió una sesión previa detectada. Inicia una nueva carga.", "info");
  }

  // Si hay sessionID activo, el usuario deberia estar en input_data_sheet.html
  const stillActiveSessionId = sessionStorage.getItem("sessionID");
  if (stillActiveSessionId) {
    console.warn("[preinfo] Sesion activa detectada, redirigiendo a input_data_sheet.html");
    if (typeof notify === "function") {
      notify("Hay una sesion activa. Redirigiendo...", "warning");
    }
    setTimeout(() => {
      if (window.cerper?.openPage) {
        window.cerper.openPage("input_data/input_data_sheet.html");
      } else {
        window.location.href = "input_data_sheet.html";
      }
    }, 500);
    return; // Detener inicializacion
  }

  const inputs = {
    metodo: document.getElementById("metodo"),
    producto: document.getElementById("producto"),
    ensayo: document.getElementById("ensayo"),
    expediente: document.getElementById("expediente"),
    unidad: document.getElementById("unidad"),
  };

  // === Restaurar datos desde sessionStorage (cache) ===
  Object.entries(inputs).forEach(([key, input]) => {
    if (input) {
      const cached = sessionStorage.getItem(key);
      if (cached) {
        input.value = cached;
      }
    }
  });

  const goMenu = document.getElementById("go-menu");
  const labTitle = document.getElementById("lab-title");
  const step1Section = document.getElementById("step1-section");
  const headerLogo = document.getElementById("header-logo");
  const headerTitle = document.getElementById("header-title");
  const labSubtitle = document.getElementById("lab-subtitle");
  const labSubtitleIcon = document.getElementById("lab-subtitle-icon");
  const procedureDescription = document.getElementById("procedure-description");

  const preinfoState = {
    ok: false,
    modified: false,
  };

  const VALIDATION_DELAY = 600;
  let validationTimer = null;
  let validationRunId = 0;
  let lastSavedSnapshot = "";

  function emitPreinfoState() {
    document.dispatchEvent(
      new CustomEvent("preinfo:state", {
        detail: { ...preinfoState },
      })
    );
  }

  const normalizeAssetPath = src => {
    if (!src) return "";
    if (/^https?:/i.test(src) || src.startsWith("data:")) return src;
    if (src.startsWith("../")) return src;
    return `../${src.replace(/^\//, "")}`;
  };

  const labKey = sessionStorage.getItem("labSeleccionado") || localStorage.getItem("labSeleccionado");
  const labName = sessionStorage.getItem("labNombreVisible") || labKey || "Laboratorio";
  const proc =
    sessionStorage.getItem("procedimientoSeleccionado") ||
    localStorage.getItem("procedimientoSeleccionado") ||
    "Procedimiento";

  if (labTitle) labTitle.textContent = `${labName} - ${proc}`;
  if (labSubtitle) labSubtitle.textContent = labName || "Laboratorio";

  // Inicializar icono del laboratorio
  function initLabIcon() {
    if (!labSubtitleIcon) return;

    const DEFAULT_LAB_ICON = "flask-conical";
    const DEFAULT_LAB_COLOR = "#22d3ee";

    const storedIcon =
      sessionStorage.getItem("labIcon") ||
      localStorage.getItem("labIcon") ||
      "";
    const labIcon = storedIcon || DEFAULT_LAB_ICON;

    const storedColor =
      sessionStorage.getItem("labColor") ||
      localStorage.getItem("labColor") ||
      "";
    const labColor = (storedColor || DEFAULT_LAB_COLOR).trim();

    if (labColor) {
      labSubtitleIcon.style.color = labColor;
    }

    if (window.IconSafety?.attachIcon) {
      window.IconSafety.attachIcon(labSubtitleIcon, labIcon).then((ok) => {
        if (!ok) {
          labSubtitleIcon.innerHTML = `<i data-lucide="${DEFAULT_LAB_ICON}" class="w-3 h-3"></i>`;
        }
        if (window.lucide?.createIcons) {
          window.lucide.createIcons();
        }
      });
    } else {
      labSubtitleIcon.innerHTML = `<i data-lucide="${DEFAULT_LAB_ICON}" class="w-3 h-3"></i>`;
      if (window.lucide?.createIcons) {
        window.lucide.createIcons();
      }
    }
  }

  initLabIcon();

  const storedTitle = sessionStorage.getItem("procedimientoTitulo") || proc;
  const storedDesc =
    sessionStorage.getItem("procedimientoDescripcion") || procedureDescription?.textContent || "";
  const storedImg =
    sessionStorage.getItem("procedimientoImagen") || headerLogo?.getAttribute("src");

  if (headerTitle && storedTitle) headerTitle.textContent = storedTitle;
  if (procedureDescription && storedDesc) procedureDescription.textContent = storedDesc;
  if (headerLogo && storedImg) {
    headerLogo.src = normalizeAssetPath(storedImg);
    headerLogo.alt = `Logotipo de ${storedTitle}`;
  }

  const shouldLoadLabConfig = labKey && window.cerper?.getLabByKey;
  if (shouldLoadLabConfig) {
    (async () => {
      try {
        const res = await window.cerper.getLabByKey(labKey);
        if (res?.ok && res.data) {
          const lab = res.data;
          const placeholders = {
            metodo: lab.metodo_default || "",
            producto: lab.producto_default || "",
            ensayo: lab.ensayo_default || "",
            expediente: lab.expediente_demo || "",
            unidad: lab.unidad_default || "",
          };
          Object.entries(placeholders).forEach(([id, text]) => {
            const input = document.getElementById(id);
            if (input && text) input.placeholder = text;
          });
          console.log(
            `[CerperStats] Placeholders cargados desde BD para ${labKey}:`,
            placeholders
          );
        } else {
          console.warn(
            `[CerperStats] No se encontro configuracion para labKey: ${labKey}`
          );
        }
      } catch (err) {
        console.error(
          "[CerperStats] Error cargando configuracion del laboratorio:",
          err
        );
      }
    })();
  } else {
    console.log(
      "[CerperStats] Saltando fetch de lab al no estar en Electron o faltar labKey"
    );
  }

  // Marcar modificaciones en cualquier input
  Object.values(inputs).forEach(input => {
    input?.addEventListener("input", () => {
      preinfoState.modified = true;
      preinfoState.ok = false;
      emitPreinfoState();
      debounceValidate();
    });
  });

  emitPreinfoState();

  // Si hay datos cacheados, validar automáticamente al cargar
  const hasCachedData = Object.values(inputs).some(input => input?.value?.trim());
  if (hasCachedData) {
    // Pequeño delay para que los placeholders se carguen primero
    setTimeout(() => {
      validateAndPersist();
    }, 100);
  }

  async function validateAndPersist() {
    const currentRun = ++validationRunId;
    const data = Object.fromEntries(
      Object.entries(inputs).map(([k, el]) => [k, (el?.value || "").trim()])
    );

    const allFilled = Object.values(data).every(v => v !== "");
    if (!allFilled) {
      Object.entries(inputs).forEach(([, el]) => {
        if (!el) return;
        if (!el.value.trim()) {
          el.classList.remove("input-error", "input-valid");
        }
      });
      return;
    }

    const validations = [
      {
        ok: dataService.validateExpedienteFormat(data.expediente),
        field: "expediente",
        message: "Formato de expediente invalido (Ej: EXMA-04264-2025 o OSMA-04264-2025-001)",
      },
      {
        ok: dataService.validateMetodo(data.metodo),
        field: "metodo",
        message: "El metodo ingresado no tiene un formato valido.",
      },
      {
        ok: dataService.validateProducto(data.producto),
        field: "producto",
        message: "Ingrese un nombre de producto valido.",
      },
      {
        ok: dataService.validateEnsayo(data.ensayo),
        field: "ensayo",
        message: "Ingrese una descripcion de ensayo valida",
      },
      {
        ok: dataService.validateUnidad(data.unidad),
        field: "unidad",
        message: "Ingrese una unidad de medida valida (ej: mg/L, %, ug/kg, etc.).",
      },
    ];

    validations.forEach(v => {
      const el = inputs[v.field];
      if (el) {
        el.classList.toggle("input-error", !v.ok);
        el.classList.toggle("input-valid", v.ok);
      }
    });

    const firstError = validations.find(v => !v.ok);
    if (firstError) {
      if (currentRun === validationRunId) {
        notify(firstError.message, "error");
      }
      preinfoState.ok = false;
      emitPreinfoState();
      return;
    }

    const found = await dataService.getExpediente(data.expediente);
    if (currentRun !== validationRunId) return;

    if (found) {
      inputs.metodo.value = found.metodo || data.metodo || "";
      inputs.producto.value = found.producto || data.producto || "";
      inputs.ensayo.value = found.ensayo || data.ensayo || "";
      inputs.unidad.value = found.unidad || data.unidad || "";
      data.metodo = inputs.metodo.value.trim();
      data.producto = inputs.producto.value.trim();
      data.ensayo = inputs.ensayo.value.trim();
      data.unidad = inputs.unidad.value.trim();
    }

    const snapshot = JSON.stringify(data);
    const isNew = snapshot !== lastSavedSnapshot;

    if (found && isNew) {
      notify("Expediente existente cargado desde base local.", "info");
    }

    dataService.savePreinfo(data);
    lastSavedSnapshot = snapshot;

    preinfoState.ok = true;
    emitPreinfoState();
    document.dispatchEvent(new CustomEvent("preinfo:ready", { detail: data }));

  }

  function debounceValidate() {
    clearTimeout(validationTimer);
    validationTimer = setTimeout(validateAndPersist, VALIDATION_DELAY);
  }

  if (goMenu) {
    goMenu.addEventListener("click", () => {
      if (window.cerper && window.cerper.openPage) {
        window.cerper.openPage("procedure_select.html");
      } else {
        window.location.href = "../procedure_select.html";
      }
    });
  }
});
