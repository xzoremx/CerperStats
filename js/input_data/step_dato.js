import { LAB_CONFIG } from "../../modules/labs_config.js";

document.addEventListener("DOMContentLoaded", () => {
  const lab = sessionStorage.getItem("labSeleccionado") || localStorage.getItem("labSeleccionado");
  const tipoLab = LAB_CONFIG[lab]?.tipoDato || "cuantitativo";

  const title = document.getElementById("lab-title");
  const main = document.getElementById("main-container");

  // Mostrar nombre del laboratorio
  title.textContent = `${lab} - Tipo de Dato`;

  // Si el laboratorio no requiere elección, avanzar automáticamente
  if (tipoLab === "cuantitativo" || tipoLab === "cualitativo") {
    console.log(`Laboratorio ${lab} usa tipo de dato fijo: ${tipoLab}`);
    sessionStorage.setItem("tipoDato", tipoLab);
    avanzarPaso();
    return;
  }

  // Si es mixto (o caso especial futuro), mostrar opciones
  document.querySelectorAll(".select-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const tipo = btn.dataset.type;
      sessionStorage.setItem("tipoDato", tipo);
      console.log(`Tipo de dato seleccionado: ${tipo}`);
      avanzarPaso();
    });
  });

  // Botón volver
  document.getElementById("go-back").addEventListener("click", () => {
    if (window.cerper && window.cerper.openPage) {
      window.cerper.openPage("input_data/step_type.html");
    } else {
      window.location.href = "step_type.html";
    }
  });
});

function avanzarPaso() {
  if (window.cerper && window.cerper.openPage) {
    window.cerper.openPage("input_data/step_parametro.html");
  } else {
    window.location.href = "step_parametro.html";
  }
}
