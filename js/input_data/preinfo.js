// input_data/preinfo.js
import { dataService } from "../../modules/_common/dataService.js";
import { LAB_CONFIG } from "../../modules/_common/labs_config.js";

document.addEventListener("DOMContentLoaded", () => {
  // --- Referencias de inputs ---
  const inputs = {
    metodo: document.getElementById("metodo"),
    producto: document.getElementById("producto"),
    ensayo: document.getElementById("ensayo"),
    expediente: document.getElementById("expediente"),
  };

  const btnSiguiente = document.getElementById("btn-siguiente");
  const goMenu = document.getElementById("go-menu");
  const labTitle = document.getElementById("lab-title");

  // --- Título dinámico ---
  const labKey = sessionStorage.getItem("labSeleccionado") || localStorage.getItem("labSeleccionado");
  const labName = sessionStorage.getItem("labNombreVisible") || labKey || "Laboratorio";
  const proc = sessionStorage.getItem("procedimientoSeleccionado") || localStorage.getItem("procedimientoSeleccionado") || "Procedimiento";
  if (labTitle) labTitle.textContent = `${labName} - ${proc}`;

  // --- Aplicar placeholders dinámicos desde LAB_CONFIG ---
  const config = LAB_CONFIG[labKey];
  if (config?.placeholders) {
    Object.entries(config.placeholders).forEach(([id, text]) => {
      const input = document.getElementById(id);
      if (input) input.placeholder = text;
    });
  }


  // --- Validación solo al presionar continuar ---
  btnSiguiente.addEventListener("click", async () => {
    const data = Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value.trim()]));
    const allFilled = Object.values(data).every(v => v !== "");

    // Si falta algo
    if (!allFilled) {
      notify("Por favor, complete todos los campos antes de continuar.", "error");
      return;
    }

    // Validar formato del expediente
    if (!dataService.validateExpedienteFormat(data.expediente)) {
      inputs.expediente.classList.add("input-error");
      notify("Formato de expediente inválido (Ej: EXMA-04264-2025 o OSMA-04264-2025-001)", "error");
      return;
    } else {
      inputs.expediente.classList.remove("input-error");
    }

    // Validar método
    if (!dataService.validateMetodo(data.metodo)) {
      notify("El método ingresado no tiene un formato válido.", "error");
      inputs.metodo.classList.add("input-error");
      return;
    } else {
      inputs.metodo.classList.remove("input-error");
    }

    // Validar producto
    if (!dataService.validateProducto(data.producto)) {
      notify("Ingrese un nombre de producto válido.", "error");
      inputs.producto.classList.add("input-error");
      return;
    } else {
      inputs.producto.classList.remove("input-error");
    }

    // Validar ensayo
    if (!dataService.validateEnsayo(data.ensayo)) {
      notify("Ingrese una descripción de ensayo válida", "error");
      inputs.ensayo.classList.add("input-error");
      return;
    } else {
      inputs.ensayo.classList.remove("input-error");
    }


    // (Futuro) Buscar expediente en base local o BD
    const found = await dataService.getExpediente(data.expediente);
    if (found) {
      notify("Expediente existente cargado desde base local.", "info");
      inputs.metodo.value = found.metodo || "";
      inputs.producto.value = found.producto || "";
      inputs.ensayo.value = found.ensayo || "";
    }

    // Guardar datos y continuar
    dataService.savePreinfo(data);
    notify("Datos válidos y guardados temporalmente.", "success");

    setTimeout(() => {
      if (window.cerper && window.cerper.openPage) {
        window.cerper.openPage("input_data/step_1_type.html");
      } else {
        window.location.href = "step_1_type.html";
      }
    }, 700);
  });

  // --- Navegación: volver a procedure ---
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

/* =====================================================
   SISTEMA DE NOTIFICACIÓN 
   ===================================================== */
function notify(message, type = "info") {
  const existing = document.querySelector(".notify");
  if (existing) existing.remove();

  const note = document.createElement("div");
  note.className = `notify ${type}`;
  note.innerHTML = message;
  document.body.appendChild(note);

  requestAnimationFrame(() => note.classList.add("show"));
  setTimeout(() => note.classList.remove("show"), 2500);
  setTimeout(() => note.remove(), 3000);
}

