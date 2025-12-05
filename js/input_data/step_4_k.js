// input_data/step_4_k.js
document.addEventListener("DOMContentLoaded", () => {
  setupModernNumberInputs();
  const context = buildContext();

  const step4State = {
    ok: false,
    modified: false,
  };

  function emitStep4State() {
    document.dispatchEvent(
      new CustomEvent("step4:state", {
        detail: { ...step4State },
      })
    );
  }

  context.inputK?.addEventListener("input", () => {
    step4State.modified = true;
    validarEnteroK(context.inputK);
    toggleLecturas(context);
    evaluarStep4(context, step4State, emitStep4State);
  });

  context.inputN?.addEventListener("input", () => {
    step4State.modified = true;
    validarEntero(context.inputN);
    evaluarStep4(context, step4State, emitStep4State);
  });
  context.inputN1?.addEventListener("input", () => {
    step4State.modified = true;
    validarEntero(context.inputN1);
    evaluarStep4(context, step4State, emitStep4State);
  });
  context.inputN2?.addEventListener("input", () => {
    step4State.modified = true;
    validarEntero(context.inputN2);
    evaluarStep4(context, step4State, emitStep4State);
  });

  const showStep4 = (opts = {}) => {
    const shouldScroll = opts.scroll !== false;
    updateLabels(context);
    toggleLecturas(context);
    if (context.badge) context.badge.textContent = "Listo para continuar";
    
    if (context.section) {
      context.section.classList.remove("hidden");
      if (shouldScroll) {
        context.section.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  if (context.isUnified) {
    document.addEventListener("step3:completed", () => showStep4({ scroll: true }));
    if (sessionStorage.getItem("tipoDato")) {
      showStep4({ scroll: false });
    }
  } else {
    showStep4({ scroll: false });
  }

  document.addEventListener("parametro:seleccionado", () => updateLabels(context));
  document.addEventListener("analito:mode", () => updateLabels(context));

  emitStep4State();
});

function buildContext() {
  return {
    isUnified: Boolean(document.getElementById("step4-section")),
    section: document.getElementById("step4-section"),
    badge: document.getElementById("step4-badge"),
    status: document.getElementById("step4-status"),
    title: document.getElementById("step4-title") || document.getElementById("lab-title"),
    subtitle: document.getElementById("step4-subtitle") || document.querySelector(".subtitle"),
    paramName: document.getElementById("step4-param-name") || document.getElementById("param-name"),
    paramLabel:
      document.getElementById("step4-param-label") || document.getElementById("param-label"),
    paramSingular:
      document.getElementById("step4-param-singular") ||
      document.getElementById("param-singular"),
    inputK: document.getElementById("step4-input-k") || document.getElementById("input-k"),
    inputN: document.getElementById("step4-input-n") || document.getElementById("input-n"),
    lecturasContainer:
      document.getElementById("step4-lecturas-container") ||
      document.getElementById("lecturas-container"),
    lecturasK2: document.getElementById("step4-lecturas-k2") || document.getElementById("lecturas-k2"),
    inputN1: document.getElementById("step4-input-n1") || document.getElementById("input-n1"),
    inputN2: document.getElementById("step4-input-n2") || document.getElementById("input-n2"),
  };
}

function updateLabels(context) {
  const parametroRaw = sessionStorage.getItem("parametroSeleccionado");
  const parametro = parametroRaw || "elementos";
  const { singular, plural } = obtenerTextosParametro(parametro);

  if (context.paramName) context.paramName.textContent = plural;
  if (context.paramLabel) context.paramLabel.textContent = plural;
  if (context.paramSingular) context.paramSingular.textContent = singular;

  if (context.title) {
    context.title.textContent = `Define la cantidad de ${capitalize(plural)}`;
  }
  if (context.subtitle) {
    context.subtitle.innerHTML = `Ingrese el número de <strong>${plural}</strong> y de sus lecturas esperadas.`;
  }
  if (context.badge) {
    context.badge.textContent = parametroRaw
      ? `Parámetro definido: ${capitalize(plural)}`
      : "Esperando parámetros";
  }
}

function toggleLecturas(context) {
  const k = parseInt(context.inputK?.value ?? "0", 10);
  if (!context.inputK) return;

  const showK2 = k === 2;
  if (context.lecturasContainer) {
    context.lecturasContainer.classList.toggle("hidden", showK2);
    context.lecturasContainer.style.display = showK2 ? "none" : "flex";
  }
  if (context.lecturasK2) {
    context.lecturasK2.classList.toggle("hidden", !showK2);
    context.lecturasK2.style.display = showK2 ? "block" : "none";
  }

  if (context.status) {
    context.status.textContent = showK2
      ? "k=2 permite definir lecturas independientes."
      : "Usa el mismo numero de lecturas por elemento.";
  }
}

function evaluarStep4(context, step4State, emitStep4State) {
  const k = parseInt(context.inputK?.value ?? "0", 10);
  if (!Number.isInteger(k) || k < 2) {
    step4State.ok = false;
    emitStep4State();
    return;
  }

  let lecturas = [];
  if (k === 2) {
    const n1 = parseInt(context.inputN1?.value ?? "0", 10);
    const n2 = parseInt(context.inputN2?.value ?? "0", 10);
    if (!Number.isInteger(n1) || n1 < 1 || !Number.isInteger(n2) || n2 < 1) {
      step4State.ok = false;
      emitStep4State();
      return;
    }
    lecturas = [n1, n2];
  } else {
    const n = parseInt(context.inputN?.value ?? "0", 10);
    if (!Number.isInteger(n) || n < 1) {
      step4State.ok = false;
      emitStep4State();
      return;
    }
    lecturas = Array(k).fill(n);
  }

  sessionStorage.setItem("K", String(k));
  sessionStorage.setItem("lecturasPorParametro", JSON.stringify(lecturas));
  if (context.badge) context.badge.textContent = "Configuracion guardada";

  step4State.ok = true;
  emitStep4State();
}

function obtenerTextosParametro(parametro) {
  const limpio = (parametro || "elementos").trim();
  let singular = limpio.toLowerCase();
  let plural = limpio.toLowerCase();
  if (singular.endsWith("s") && singular.length > 1) {
    plural = singular;
    singular = singular.slice(0, -1);
  } else {
    plural = `${singular || "elemento"}s`;
  }
  return {
    singular: singular || "elemento",
    plural: plural || "elementos",
  };
}

function validarEntero(field) {
  if (!field) return;
  const val = field.value.trim();
  if (!val) return;
  const num = Number(val);
  if (!Number.isInteger(num) || num < 1) {
    notify("Por favor, ingrese solo numeros enteros positivos (sin decimales).", "error");
    field.value = Math.max(1, Math.floor(num || 1));
  }
}

function validarEnteroK(field) {
  if (!field) return;
  const val = field.value.trim();
  if (!val) return;
  const num = Number(val);
  if (!Number.isInteger(num)) {
    notify("Por favor, ingrese solo numeros enteros positivos (sin decimales).", "error");
    field.value = Math.max(2, Math.floor(num || 2));
  } else if (num < 2) {
    notify("La cantidad de elementos debe ser al menos 2.", "error");
    field.value = 2;
  }
}

function notify(message, type = "info") {
  const existing = document.querySelector(".notify");
  if (existing) existing.remove();

  const div = document.createElement("div");
  div.className = `notify ${type}`;
  div.textContent = message;
  document.body.appendChild(div);

  setTimeout(() => div.classList.add("show"), 50);
  setTimeout(() => div.classList.remove("show"), 3000);
  setTimeout(() => div.remove(), 3500);
}

function capitalize(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function setupModernNumberInputs() {
  const buttons = document.querySelectorAll(".modern-number-btn");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const inputId = btn.dataset.target;
      if (!inputId) return;
      const step = parseInt(btn.dataset.step || "1", 10);
      if (Number.isNaN(step)) return;

      const input = document.getElementById(inputId);
      if (!input) return;

      const minAttr = input.getAttribute("min");
      const maxAttr = input.getAttribute("max");
      const min = minAttr !== null ? parseInt(minAttr, 10) : null;
      const max = maxAttr !== null ? parseInt(maxAttr, 10) : null;

      let value = parseInt(input.value, 10);
      if (Number.isNaN(value)) value = min ?? 0;
      value += step;
      if (min !== null && value < min) value = min;
      if (max !== null && value > max) value = max;

      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });
}
