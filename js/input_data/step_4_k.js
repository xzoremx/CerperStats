document.addEventListener("DOMContentLoaded", () => {
  const lab = sessionStorage.getItem("labSeleccionado") || localStorage.getItem("labSeleccionado");
  const parametro = sessionStorage.getItem("parametroSeleccionado") || "Parámetro";
  const tipoDato = sessionStorage.getItem("tipoDato") || "cuantitativo";

  const title = document.getElementById("lab-title");
  const paramName = document.getElementById("param-name");
  const paramLabel = document.getElementById("param-label");
  const paramSingular = document.getElementById("param-singular");

  const inputK = document.getElementById("input-k");
  const inputN = document.getElementById("input-n");
  const lecturasContainer = document.getElementById("lecturas-container");
  const lecturasK2 = document.getElementById("lecturas-k2");

  // --- Determinar singular y plural coherente para UI ---
  let singular = parametro.toLowerCase();
  let plural = parametro.toLowerCase();
  if (parametro.endsWith("s")) {
    singular = parametro.slice(0, -1).toLowerCase();
    plural = parametro.toLowerCase();
  } else {
    plural = parametro.toLowerCase() + "s";
  }

  // --- Actualizar textos en pantalla ---
  title.textContent = `${lab} - Definir cantidad de ${capitalize(plural)}`;
  paramName.textContent = plural;
  paramLabel.textContent = plural;
  paramSingular.textContent = singular;

  const subtitle = document.querySelector(".subtitle");
  subtitle.innerHTML = `Ingrese la cantidad de <strong>${plural}</strong> y el número de lecturas esperadas.`;

  // --- Mostrar/ocultar bloque K=2 dinámicamente ---
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

  // Validación automática al escribir
  [inputK, inputN].forEach(input => {
    input.addEventListener("input", () => {
      const val = input.value.trim();

      // Permitir borrar temporalmente
      if (val === "") return;

      const num = Number(val);
      if (!Number.isInteger(num) || num < 1) {
        notify("Por favor, ingrese solo números enteros positivos (sin decimales).", "error");
        input.value = Math.max(1, Math.floor(num || 1));
      }
    });
  });

  ["input-n1", "input-n2"].forEach(id => {
    const field = document.getElementById(id);
    field.addEventListener("input", () => {
      const val = field.value.trim();

      // Permitir borrar temporalmente
      if (val === "") return;

      const num = Number(val);
      if (!Number.isInteger(num) || num < 1) {
        notify("Por favor, ingrese solo números enteros positivos (sin decimales).", "error");
        field.value = Math.max(1, Math.floor(num || 1));
      }
    });
  });


  // --- Botón Continuar ---
  document.getElementById("continue").addEventListener("click", () => {
    const k = parseInt(inputK.value);
    if (isNaN(k) || k < 1)
      return notify("Ingrese un valor válido para la cantidad (≥1).", "error");

    let lecturas = [];
    if (k === 2) {
      const n1 = parseInt(document.getElementById("input-n1").value);
      const n2 = parseInt(document.getElementById("input-n2").value);
      if (isNaN(n1) || isNaN(n2) || n1 < 1 || n2 < 1)
        return notify("Ingrese lecturas válidas para ambos casos.", "error");
      lecturas = [n1, n2];
    } else {
      const n = parseInt(inputN.value);
      if (isNaN(n) || n < 1)
        return notify("Ingrese un número válido de lecturas.", "error");
      lecturas = Array(k).fill(n);
    }

    sessionStorage.setItem("K", k);
    sessionStorage.setItem("lecturasPorParametro", JSON.stringify(lecturas));

    console.log(`K=${k}, lecturas=${lecturas}, tipoDato=${tipoDato}`);
    notify("Datos guardados correctamente.", "success");

    setTimeout(() => {
      if (window.cerper && window.cerper.openPage) {
        window.cerper.openPage("input_data/step_5_sheet.html");
      } else {
        window.location.href = "step_5_sheet.html";
      }
    }, 1200);
  });

  // --- Botón Volver ---
  document.getElementById("go-back").addEventListener("click", () => {
    if (window.cerper && window.cerper.openPage) {
      window.cerper.openPage("input_data/step_2_parametro.html");
    } else {
      window.location.href = "step_2_parametro.html";
    }
  });

  // --- Sistema de notificaciones ---
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

  // --- Función auxiliar ---
  function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
});

