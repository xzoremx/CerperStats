document.addEventListener("DOMContentLoaded", () => {
  const lab = sessionStorage.getItem("labSeleccionado") || localStorage.getItem("labSeleccionado");
  const parametro = sessionStorage.getItem("parametroSeleccionado") || "Parámetro";
  const tipoDato = sessionStorage.getItem("tipoDato") || "cuantitativo";

  const title = document.getElementById("lab-title");
  const paramName = document.getElementById("param-name");
  const paramLabel = document.getElementById("param-label");

  const inputK = document.getElementById("input-k");
  const inputN = document.getElementById("input-n");
  const lecturasContainer = document.getElementById("lecturas-container");
  const lecturasK2 = document.getElementById("lecturas-k2");

  // Mostrar título dinámico
  title.textContent = `${lab} - Definir ${parametro}`;
  paramName.textContent = parametro.toLowerCase();
  paramLabel.textContent = parametro.toLowerCase();

  // Mostrar/ocultar bloque K=2 dinámicamente
  inputK.addEventListener("input", () => {
    const k = parseInt(inputK.value);
    if (k === 2) {
      lecturasContainer.style.display = "none";
      lecturasK2.style.display = "block";
    } else {
      lecturasContainer.style.display = "block";
      lecturasK2.style.display = "none";
    }
  });

  // Botón Continuar
  document.getElementById("continue").addEventListener("click", () => {
    const k = parseInt(inputK.value);
    if (isNaN(k) || k < 1) return alert("Ingrese un valor válido para K (≥1).");

    let lecturas = [];
    if (k === 2) {
      const n1 = parseInt(document.getElementById("input-n1").value);
      const n2 = parseInt(document.getElementById("input-n2").value);
      if (isNaN(n1) || isNaN(n2) || n1 < 1 || n2 < 1)
        return alert("Ingrese lecturas válidas para ambos parámetros.");
      lecturas = [n1, n2];
    } else {
      const n = parseInt(inputN.value);
      if (isNaN(n) || n < 1) return alert("Ingrese un número válido de lecturas.");
      lecturas = Array(k).fill(n);
    }

    // Guardar en sessionStorage
    sessionStorage.setItem("K", k);
    sessionStorage.setItem("lecturasPorParametro", JSON.stringify(lecturas));

    console.log(`K=${k}, lecturas=${lecturas}, tipoDato=${tipoDato}`);

    // Avanzar al siguiente paso
    if (window.cerper && window.cerper.openPage) {
      window.cerper.openPage("input_data/step_data.html");
    } else {
      window.location.href = "step_data.html";
    }
  });

  // Volver atrás
  document.getElementById("go-back").addEventListener("click", () => {
    if (window.cerper && window.cerper.openPage) {
      window.cerper.openPage("input_data/step_parametro.html");
    } else {
      window.location.href = "step_parametro.html";
    }
  });
});
