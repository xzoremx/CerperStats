// input_data/step_2_parametro.js
import { LAB_CONFIG } from "../../modules/_common/labs_config.js";

document.addEventListener("DOMContentLoaded", () => {
  // --- Recuperar laboratorio (clave y nombre visible) ---
  const labKey =
    sessionStorage.getItem("labSeleccionado") ||
    localStorage.getItem("labSeleccionado");
  const labName =
    sessionStorage.getItem("labNombreVisible") || labKey || "Laboratorio";

  const tipoAnalisis = sessionStorage.getItem("tipoAnalisis") || "mono";

  // --- Buscar configuración del laboratorio ---
  const config = LAB_CONFIG[labKey];

  // --- UI: título ---
  const title = document.getElementById("lab-title");
  title.textContent = `${labName} - Parámetro`;

  const paramContainer = document.getElementById("param-options");
  const customBlock = document.getElementById("custom-param");
  const inputCustom = document.getElementById("input-param");
  const confirmCustom = document.getElementById("confirm-param");

  // --- Opciones según tipo de análisis ---
  const opciones =
    tipoAnalisis === "multi"
      ? [
          { name: "Analista", icon: "user" },
          { name: "Otro", icon: "list" },
        ]
      : [
          { name: "Días", icon: "calendar" },
          { name: "Analista", icon: "user" },
          { name: "Equipos", icon: "cpu" },
          { name: "Otro", icon: "list" },
        ];

  // --- Renderizar botones ---
  opciones.forEach(opt => {
    const btn = document.createElement("button");
    btn.classList.add("select-btn");
    btn.dataset.param = opt.name;
    btn.innerHTML = `<i data-lucide="${opt.icon}"></i> ${opt.name}`;
    paramContainer.appendChild(btn);
  });

  if (window.lucide?.createIcons) lucide.createIcons();

  // --- Lógica de selección ---
  paramContainer.addEventListener("click", async e => {
    const btn = e.target.closest(".select-btn");
    if (!btn) return;

    const param = btn.dataset.param;
    if (param === "Otro") {
      customBlock.style.display = "block";
      inputCustom.focus();
      return;
    }
    await guardarYContinuar(param);
  });

  confirmCustom.addEventListener("click", async () => {
    const custom = inputCustom.value.trim();
    if (!custom) return alert("Ingrese un nombre válido para el parámetro.");
    await guardarYContinuar(custom);
  });

  // --- Botón Volver ---
  document.getElementById("go-back").addEventListener("click", () => {
    if (window.cerper?.openPage) window.cerper.openPage("input_data/step_1_type.html");
    else window.location.href = "step_1_type.html";
  });

  // --- Guardar y decidir siguiente paso ---
  async function guardarYContinuar(parametro) {
    sessionStorage.setItem("parametroSeleccionado", parametro);
    sessionStorage.removeItem("tipoDato");
    sessionStorage.removeItem("modoCualitativo");
    sessionStorage.removeItem("valoresPermitidos");

    if (config?.tiposDisponibles) {
      const tipos = config.tiposDisponibles.map(t => t.tipoDato);
      const tiposUnicos = [...new Set(tipos)];

      // Si el laboratorio maneja más de un tipo o tiene cualitativo → ir a step 3
      if (tiposUnicos.length > 1 || tiposUnicos.includes("cualitativo")) {
        return irAStep3Dato();
      }
    }

    // Caso contrario → ir a step 4
    return irAStep4();
  }

  function irAStep3Dato() {
    if (window.cerper?.openPage) window.cerper.openPage("input_data/step_3_dato.html");
    else window.location.href = "step_3_dato.html";
  }

  function irAStep4() {
    if (window.cerper?.openPage) window.cerper.openPage("input_data/step_4_k.html");
    else window.location.href = "step_4_k.html";
  }
});




