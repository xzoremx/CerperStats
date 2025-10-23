// input_data/step_3_dato.js
import { LAB_CONFIG } from "../../modules/_common/labs_config.js";

document.addEventListener("DOMContentLoaded", () => {
  // --- Recuperar laboratorio (clave y nombre visible) ---
  const labKey =
    sessionStorage.getItem("labSeleccionado") ||
    localStorage.getItem("labSeleccionado");
  const labName =
    sessionStorage.getItem("labNombreVisible") || labKey || "Laboratorio";

  const title = document.getElementById("lab-title");
  const main = document.getElementById("main-container");

  // --- Obtener configuración del laboratorio ---
  const config = LAB_CONFIG[labKey];

  // --- Título ---
  title.textContent = `${labName} - Tipo de Dato`;

  // --- Validar configuración ---
  if (!config || !config.tiposDisponibles) {
    sessionStorage.setItem("tipoDato", "cuantitativo");
    avanzarPaso();
    return;
  }

  const tipos = config.tiposDisponibles;

  // --- Si solo hay un tipo, guardar y continuar ---
  if (tipos.length === 1) {
    const unico = tipos[0];
    sessionStorage.setItem("tipoDato", unico.tipoDato);
    if (unico.modo) sessionStorage.setItem("modoCualitativo", unico.modo);
    if (unico.valoresPermitidos)
      sessionStorage.setItem("valoresPermitidos", JSON.stringify(unico.valoresPermitidos));
    avanzarPaso();
    return;
  }

  // --- Si hay varios tipos (cuantitativo + cualitativo) ---
  const container = document.createElement("div");
  container.className = "form-block";

  const msg = document.createElement("h3");
  msg.textContent = "Seleccione el tipo de dato:";
  container.appendChild(msg);

  tipos.forEach(tipo => {
    const btn = document.createElement("button");
    btn.className = "select-btn";
    btn.dataset.tipo = tipo.tipoDato;

    btn.textContent =
      tipo.tipoDato === "cuantitativo"
        ? "Cuantitativo"
        : tipo.modo
        ? `Cualitativo (${tipo.modo})`
        : "Cualitativo";

    btn.addEventListener("click", () => {
      sessionStorage.setItem("tipoDato", tipo.tipoDato);

      if (tipo.tipoDato === "cualitativo") {
        const modos = tipos.filter(t => t.tipoDato === "cualitativo");

        if (modos.length > 1 && !tipo.modo) {
          mostrarSelectorDeModo(modos);
        } else {
          const modoSel = tipo.modo || "binario";
          sessionStorage.setItem("modoCualitativo", modoSel);
          if (tipo.valoresPermitidos)
            sessionStorage.setItem("valoresPermitidos", JSON.stringify(tipo.valoresPermitidos));
          avanzarPaso();
        }
      } else {
        avanzarPaso();
      }
    });

    container.appendChild(btn);
  });

  main.appendChild(container);

  // --- Botón Volver ---
  document.getElementById("go-back").addEventListener("click", () => {
    if (window.cerper?.openPage)
      window.cerper.openPage("input_data/step_2_parametro.html");
    else
      window.location.href = "step_2_parametro.html";
  });
});

// --- Selector secundario para modo cualitativo ---
function mostrarSelectorDeModo(modos) {
  const main = document.getElementById("main-container");
  main.innerHTML = "";

  const title = document.createElement("h3");
  title.textContent = "Seleccione el modo cualitativo:";
  main.appendChild(title);

  modos.forEach(m => {
    const btn = document.createElement("button");
    btn.className = "select-btn";
    btn.textContent = `Modo ${m.modo}`;
    btn.addEventListener("click", () => {
      sessionStorage.setItem("tipoDato", "cualitativo");
      sessionStorage.setItem("modoCualitativo", m.modo);
      if (m.valoresPermitidos)
        sessionStorage.setItem("valoresPermitidos", JSON.stringify(m.valoresPermitidos));
      avanzarPaso();
    });
    main.appendChild(btn);
  });
}

// --- Avanzar al siguiente paso ---
function avanzarPaso() {
  if (window.cerper?.openPage)
    window.cerper.openPage("input_data/step_4_k.html");
  else
    window.location.href = "step_4_k.html";
}
