document.addEventListener("DOMContentLoaded", () => {
  const lab = sessionStorage.getItem("labSeleccionado") || localStorage.getItem("labSeleccionado");
  const tipoAnalisis = sessionStorage.getItem("tipoAnalisis") || "mono"; // mono o multi
  const tipoDato = sessionStorage.getItem("tipoDato") || "cuantitativo";

  const title = document.getElementById("lab-title");
  title.textContent = `${lab} - Parámetro (${tipoDato})`;

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

  // Generar botones
  opciones.forEach(opt => {
    const btn = document.createElement("button");
    btn.classList.add("select-btn");
    btn.dataset.param = opt.name;
    btn.innerHTML = `<i data-lucide="${opt.icon}"></i> ${opt.name}`;
    paramContainer.appendChild(btn);
  });

  lucide.createIcons(); // render icons

  // --- Lógica de selección ---
  paramContainer.addEventListener("click", async e => {
    if (!e.target.closest(".select-btn")) return;
    const param = e.target.closest(".select-btn").dataset.param;

    if (param === "Otro") {
      // Mostrar campo para definir parámetro personalizado
      customBlock.style.display = "block";
      inputCustom.focus();
      return;
    }

    await guardarYContinuar(param);
  });

  // --- Confirmar parámetro personalizado ---
  confirmCustom.addEventListener("click", async () => {
    const custom = inputCustom.value.trim();
    if (!custom) return alert("Ingrese un nombre válido para el parámetro.");
    await guardarYContinuar(custom);
  });

  // --- Botón Volver ---
  document.getElementById("go-back").addEventListener("click", () => {
    if (window.cerper && window.cerper.openPage) {
      window.cerper.openPage("input_data/step_1_type.html");
    } else {
      window.location.href = "step_1_type.html";
    }
  });

  // --- Función auxiliar ---
  async function guardarYContinuar(parametro) {
    sessionStorage.setItem("parametroSeleccionado", parametro);
    console.log(`Parámetro seleccionado: ${parametro}`);

    if (window.cerper && window.cerper.openPage) {
      await window.cerper.openPage("input_data/step_4_k.html");
    } else {
      window.location.href = "step_4_k.html";
    }
  }
});
