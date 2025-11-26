// input_data/preinfo.js
import { dataService } from "../../modules/_common/dataService.js";

document.addEventListener("DOMContentLoaded", async () => {
  const inputs = {
    metodo: document.getElementById("metodo"),
    producto: document.getElementById("producto"),
    ensayo: document.getElementById("ensayo"),
    expediente: document.getElementById("expediente"),
    unidad: document.getElementById("unidad"),
  };

  const btnSiguiente = document.getElementById("btn-siguiente");
  const goMenu = document.getElementById("go-menu");
  const labTitle = document.getElementById("lab-title");
  const step1Section = document.getElementById("step1-section");
  const headerLogo = document.getElementById("header-logo");
  const headerTitle = document.getElementById("header-title");
  const labSubtitle = document.getElementById("lab-subtitle");
  const procedureDescription = document.getElementById("procedure-description");

  const normalizeAssetPath = (src) => {
    if (!src) return "";
    if (/^https?:/i.test(src) || src.startsWith("data:")) return src;
    if (src.startsWith("../")) return src;
    return `../${src.replace(/^\//, "")}`;
  };

  const labKey = sessionStorage.getItem("labSeleccionado") || localStorage.getItem("labSeleccionado");
  const labName = sessionStorage.getItem("labNombreVisible") || labKey || "Laboratorio";
  const proc = sessionStorage.getItem("procedimientoSeleccionado") || localStorage.getItem("procedimientoSeleccionado") || "Procedimiento";
  if (labTitle) labTitle.textContent = `${labName} - ${proc}`;
  if (labSubtitle) labSubtitle.textContent = labName || "Laboratorio";

  const storedTitle = sessionStorage.getItem("procedimientoTitulo") || proc;
  const storedDesc = sessionStorage.getItem("procedimientoDescripcion") || procedureDescription?.textContent || "";
  const storedImg = sessionStorage.getItem("procedimientoImagen") || headerLogo?.getAttribute("src");
  if (headerTitle && storedTitle) headerTitle.textContent = storedTitle;
  if (procedureDescription && storedDesc) procedureDescription.textContent = storedDesc;
  if (headerLogo && storedImg) {
    headerLogo.src = normalizeAssetPath(storedImg);
    headerLogo.alt = `Logotipo de ${storedTitle}`;
  }

  // Cargar configuracion del laboratorio para placeholders
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
      console.log(`[CerperStats] Placeholders cargados desde BD para ${labKey}:`, placeholders);
    } else {
      console.warn(`[CerperStats] No se encontro configuracion para labKey: ${labKey}`);
    }
  } catch (err) {
    console.error("[CerperStats] Error cargando configuracion del laboratorio:", err);
  }

  if (btnSiguiente) {
    btnSiguiente.addEventListener("click", async () => {
      const data = Object.fromEntries(
        Object.entries(inputs).map(([k, el]) => [k, (el?.value || "").trim()])
      );
      const allFilled = Object.values(data).every(v => v !== "");

      if (!allFilled) {
        notify("Por favor, complete todos los campos antes de continuar.", "error");
        return;
      }

      if (!dataService.validateExpedienteFormat(data.expediente)) {
        inputs.expediente?.classList.add("input-error");
        notify("Formato de expediente invalido (Ej: EXMA-04264-2025 o OSMA-04264-2025-001)", "error");
        return;
      } else {
        inputs.expediente?.classList.remove("input-error");
      }

      if (!dataService.validateMetodo(data.metodo)) {
        notify("El metodo ingresado no tiene un formato valido.", "error");
        inputs.metodo?.classList.add("input-error");
        return;
      } else {
        inputs.metodo?.classList.remove("input-error");
      }

      if (!dataService.validateProducto(data.producto)) {
        notify("Ingrese un nombre de producto valido.", "error");
        inputs.producto?.classList.add("input-error");
        return;
      } else {
        inputs.producto?.classList.remove("input-error");
      }

      if (!dataService.validateEnsayo(data.ensayo)) {
        notify("Ingrese una descripcion de ensayo valida", "error");
        inputs.ensayo?.classList.add("input-error");
        return;
      } else {
        inputs.ensayo?.classList.remove("input-error");
      }

      if (!dataService.validateUnidad(data.unidad)) {
        notify("Ingrese una unidad de medida valida (ej: mg/L, %, ug/kg, etc.).", "error");
        inputs.unidad?.classList.add("input-error");
        return;
      } else {
        inputs.unidad?.classList.remove("input-error");
      }

      const found = await dataService.getExpediente(data.expediente);
      if (found) {
        notify("Expediente existente cargado desde base local.", "info");
        inputs.metodo.value = found.metodo || "";
        inputs.producto.value = found.producto || "";
        inputs.ensayo.value = found.ensayo || "";
        inputs.unidad.value = found.unidad || "";
      }

      dataService.savePreinfo(data);
      notify("Datos validos y guardados temporalmente.", "success");

      document.dispatchEvent(new CustomEvent("preinfo:ready", { detail: data }));
      if (step1Section) {
        step1Section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
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
