// input_data/step_3_dato.js
document.addEventListener("DOMContentLoaded", async () => {
  const labKey =
    sessionStorage.getItem("labSeleccionado") ||
    localStorage.getItem("labSeleccionado");
  const labName =
    sessionStorage.getItem("labNombreVisible") || labKey || "Laboratorio";
  const isUnifiedPage = Boolean(document.getElementById("step3-section"));

  if (isUnifiedPage) {
    await initUnifiedStep3({ labKey, labName });
  } else {
    await initStandaloneStep3({ labKey, labName });
  }
});

const step3State = {
  ok: false,
  modified: false,
};

function emitStep3State() {
  document.dispatchEvent(
    new CustomEvent("step3:state", {
      detail: { ...step3State },
    })
  );
}

async function initStandaloneStep3({ labKey, labName }) {
  const title = document.getElementById("lab-title");
  const main = document.getElementById("main-container");
  if (title) title.textContent = `${labName} - Tipo de Dato`;

  const tipos = await cargarTipos(labKey);

  if (!tipos.length) {
    guardarTipoDato({ tipoDato: "cuantitativo" }, false);
    irAStep4({ labName });
    return;
  }

  if (tipos.length === 1) {
    guardarTipoDato(tipos[0], false);
    irAStep4({ labName });
    return;
  }

  const container = document.createElement("div");
  container.className = "form-block";

  const msg = document.createElement("h3");
  msg.textContent = "Seleccione el tipo de dato:";
  container.appendChild(msg);

  tipos.forEach(tipo => {
    const btn = document.createElement("button");
    btn.className = "select-btn";
    btn.dataset.tipo = tipo.tipoDato;

    if (tipo.tipoDato === "cuantitativo") {
      btn.textContent = "Cuantitativo";
    } else {
      const modoTexto = tipo.modo
        ? tipo.modo.charAt(0).toUpperCase() + tipo.modo.slice(1)
        : null;
      btn.textContent = modoTexto ? `Cualitativo - ${modoTexto}` : "Cualitativo";
    }

    btn.addEventListener("click", () => {
      guardarTipoDato(tipo, true);
      irAStep4({ labName });
    });

    container.appendChild(btn);
  });

  main?.appendChild(container);

  document.getElementById("go-back")?.addEventListener("click", () => {
    const step2 = document.getElementById("step2-section");
    if (step2) {
      step2.scrollIntoView({ behavior: "smooth" });
      return;
    }
    console.warn("[CerperStats] Paso 2 no disponible para volver en esta pagina.");
  });
}

async function initUnifiedStep3({ labKey, labName }) {
  const step3Section = document.getElementById("step3-section");
  const step3Badge = document.getElementById("step3-badge");
  const step3Placeholder = document.getElementById("step3-placeholder");
  const step3Options = document.getElementById("step3-options");
  const step3Status = document.getElementById("step3-status");
  const step3Instruction = document.getElementById("step3-instruction");
  const step3GoBack = document.getElementById("step3-go-back");

  if (step3Instruction) {
    step3Instruction.textContent = `Laboratorio asignado: ${labName}`;
  }

  step3GoBack?.addEventListener("click", () => scrollToSection("step2-section"));

  const tipos = await cargarTipos(labKey);

  if (!tipos.length) {
    guardarTipoDato({ tipoDato: "cuantitativo" }, false);
    step3Section?.classList.add("hidden");
    irAStep4({ labName });
    return;
  }

  if (tipos.length === 1) {
    guardarTipoDato(tipos[0], false);
    step3Section?.classList.add("hidden");
    irAStep4({ labName });
    return;
  }

  if (step3Badge) step3Badge.textContent = "Modo pendiente";
  if (step3Placeholder) {
    step3Placeholder.textContent =
      "Selecciona la opcion que mejor describa el dato que vas a ingresar.";
  }
  if (step3Status) {
    step3Status.textContent = "Elige el tipo que describe el contenido del dato.";
  }

  if (step3Options) {
    step3Options.innerHTML = "";
    tipos.forEach(tipo => {
      const tipoNormalizado = tipo.tipoDato.toLowerCase();
      const label =
        tipoNormalizado === "cuantitativo"
          ? "Cuantitativo"
          : tipo.modo
          ? `Cualitativo - ${tipo.modo.charAt(0).toUpperCase() + tipo.modo.slice(1)}`
          : "Cualitativo";
      const icon = tipoNormalizado === "cuantitativo" ? "activity" : "color-swatch";
      const button = document.createElement("button");
      button.className =
        "flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-sm text-white hover:border-orange-400/70 hover:bg-orange-500/10 transition-all";
      button.innerHTML = `
        <span class="flex items-center gap-2">
          <i data-lucide="${icon}" class="w-4 h-4 text-orange-200"></i>
          <span class="font-geist">${label}</span>
        </span>
        <span class="text-[11px] text-gray-400 group-hover:text-orange-200">Elegir</span>
      `;
      button.addEventListener("click", () => {
        guardarTipoDato(tipo, true);
        if (step3Badge) {
          const base = tipo.tipoDato.charAt(0).toUpperCase() + tipo.tipoDato.slice(1);
          step3Badge.textContent = `Seleccionado: ${base}`;
        }
        if (step3Status) {
          step3Status.textContent = "Tipo guardado, define ahora las cantidades.";
        }
        irAStep4({ labName });
      });
      step3Options.appendChild(button);
    });

    if (typeof lucide !== "undefined" && lucide.createIcons) {
      lucide.createIcons();
    }
  }
}

async function cargarTipos(labKey) {
  let tipos = [];
  try {
    const loader = window.cerper?.getLabModules;
    if (typeof loader === "function") {
      const res = await loader.call(window.cerper, labKey);
      if (res?.ok && Array.isArray(res.data)) {
        tipos = res.data
          .map(row => {
            const tipoDato = (row.tipo_dato || "").toString().trim();
            if (!tipoDato) return null;
            const modo =
              (row.modo ?? row.modo_cualitativo ?? "").toString().trim() || null;
            const valoresPermitidos = row.valores_permitidos ?? null;
            return { tipoDato, modo, valoresPermitidos };
          })
          .filter(Boolean);
      }
    }
  } catch (err) {
    console.error("[CerperStats] Error leyendo modulos:", err);
  }
  return tipos;
}

function guardarTipoDato(tipo, modified) {
  const tipoDato = tipo?.tipoDato || "cuantitativo";
  sessionStorage.setItem("tipoDato", tipoDato);

  if (tipo?.modo) {
    sessionStorage.setItem("modoCualitativo", tipo.modo);
  } else {
    sessionStorage.removeItem("modoCualitativo");
  }

  const valores = parseValoresPermitidos(tipo?.valoresPermitidos);
  if (valores) {
    sessionStorage.setItem("valoresPermitidos", JSON.stringify(valores));
  } else {
    sessionStorage.removeItem("valoresPermitidos");
  }

  step3State.ok = true;
  step3State.modified = !!modified;
  emitStep3State();
}

function parseValoresPermitidos(valor) {
  if (!valor && valor !== 0) return null;

  let listado = valor;
  if (typeof listado === "string") {
    try {
      listado = JSON.parse(listado.replace(/'/g, '"'));
    } catch {
      listado = listado
        .split(",")
        .map(v => parseFloat(v.trim()))
        .filter(v => !Number.isNaN(v));
    }
  }

  if (!Array.isArray(listado)) {
    listado = [listado];
  }

  const sanitizado = listado
    .map(v => {
      if (typeof v === "string") v = v.trim();
      return Number(v);
    })
    .filter(val => !Number.isNaN(val));

  return sanitizado.length ? sanitizado : null;
}

function irAStep4({ labName }) {
  const step4Section = document.getElementById("step4-section");
  const step3Section = document.getElementById("step3-section");
  const step4StepLabel = document.getElementById("step4-step-label");
  if (step4Section) {
    if (step3Section && step3Section.classList.contains("hidden") && step4StepLabel) {
      step4StepLabel.textContent = "Paso 3";
      step4StepLabel.classList.remove("text-purple-300/80");
      step4StepLabel.classList.add("text-orange-300/80");
    }
    document.dispatchEvent(
      new CustomEvent("step3:completed", {
        detail: { labName },
      })
    );
    step4Section.classList.remove("hidden");
    step4Section.scrollIntoView({ behavior: "smooth" });
    return;
  }

  console.warn("[CerperStats] No se encontro la seccion del paso 4 en esta pagina.");
}

function scrollToSection(id) {
  const target = document.getElementById(id);
  if (target) target.scrollIntoView({ behavior: "smooth" });
}

