document.addEventListener("DOMContentLoaded", () => {
  const lab = sessionStorage.getItem("labSeleccionado");
  const tipoAnalisis = sessionStorage.getItem("tipoAnalisis"); // mono/multi
  const tipoDato = sessionStorage.getItem("tipoDato"); // cuantitativo/cualitativo
  const parametro = sessionStorage.getItem("parametroSeleccionado");
  const K = parseInt(sessionStorage.getItem("K"));
  const lecturas = JSON.parse(sessionStorage.getItem("lecturasPorParametro") || "[]");

  const title = document.getElementById("lab-title");
  const subtitle = document.getElementById("sheet-subtitle");
  const tbody = document.querySelector("#excel tbody");

  title.textContent = `${lab} - Ingreso de Lecturas`;
  subtitle.textContent = `${tipoAnalisis === "multi" ? "Multianalito" : "Monoanalito"} | ${tipoDato} | ${parametro} | K=${K}`;

  generarTabla(tipoAnalisis, K, lecturas);
  activarNavegacion();
  activarPegado();

  // --- Validar y guardar ---
  document.getElementById("validate-btn").addEventListener("click", () => {
    const datos = leerTabla();
    const valido = validarDatos(datos, tipoAnalisis, tipoDato, K, lecturas);
    if (valido) {
      feedback("Datos válidos. Puede continuar.", "ok");
      document.getElementById("continue-btn").disabled = false;
      sessionStorage.setItem("lecturasAnaliticas", JSON.stringify(datos));
    }
  });

  // --- Continuar ---
  document.getElementById("continue-btn").addEventListener("click", () => {
    if (window.cerper && window.cerper.openPage) {
      window.cerper.openPage("evaluation_select.html");
    } else {
      window.location.href = "../evaluation_select.html";
    }
  });

  // --- Volver ---
  document.getElementById("go-back").addEventListener("click", () => {
    if (window.cerper && window.cerper.openPage) {
      window.cerper.openPage("input_data/step_4_k.html");
    } else {
      window.location.href = "step_4_k.html";
    }
  });
});

function generarTabla(tipoAnalisis, K, lecturas) {
  const tbody = document.querySelector("#excel tbody");
  tbody.innerHTML = "";
  const filas = Math.max(...lecturas, 10);
  const columnas = tipoAnalisis === "mono" ? K : K + 1;

  const placeholders =
    tipoAnalisis === "mono"
      ? Array.from({ length: K }, (_, i) => `Analista ${i + 1}`)
      : ["Analista", ...Array.from({ length: K }, (_, i) => `Analito ${i + 1}`)];

  // Cabecera
  const header = document.createElement("tr");
  placeholders.forEach(text => {
    const th = document.createElement("td");
    th.textContent = text;
    th.classList.add("placeholder");
    header.appendChild(th);
  });
  tbody.appendChild(header);

  // Celdas
  const bloque = tipoAnalisis === "multi" ? lecturas[0] || 5 : lecturas[0] || 5;
  let analistaActual = 1;
  for (let i = 0; i < filas; i++) {
    const tr = document.createElement("tr");
    for (let j = 0; j < columnas; j++) {
      const td = document.createElement("td");
      td.contentEditable = true;
      td.classList.add("placeholder");
      td.addEventListener("input", () => togglePlaceholder(td));
      if (tipoAnalisis === "multi" && j === 0) {
        td.textContent = `Analista ${analistaActual}`;
        td.classList.add("placeholder");
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
    if (tipoAnalisis === "multi" && (i + 1) % bloque === 0) analistaActual++;
  }
}

function togglePlaceholder(td) {
  td.classList.toggle("placeholder", td.textContent.trim() === "");
}

function activarNavegacion() {
  const table = document.getElementById("excel");
  table.addEventListener("keydown", e => {
    const cell = document.activeElement;
    if (cell.tagName !== "TD") return;
    const tr = cell.parentElement;
    const rowIndex = [...table.rows].indexOf(tr);
    const colIndex = [...tr.cells].indexOf(cell);
    let targetRow = rowIndex, targetCol = colIndex;

    if (e.key === "ArrowUp") targetRow = Math.max(0, rowIndex - 1);
    if (e.key === "ArrowDown") targetRow = rowIndex + 1;
    if (e.key === "ArrowLeft") targetCol = Math.max(0, colIndex - 1);
    if (e.key === "ArrowRight") targetCol = colIndex + 1;

    const nextRow = table.rows[targetRow];
    const nextCell = nextRow?.cells[targetCol];
    if (nextCell) nextCell.focus();
  });
}

function activarPegado() {
  const table = document.getElementById("excel");
  table.addEventListener("paste", e => {
    const active = document.activeElement;
    if (active.tagName !== "TD") return;
    e.preventDefault();

    const text = (e.clipboardData || window.clipboardData).getData("text");
    const rows = text.trim().split(/\r?\n/).map(r => r.split("\t"));
    const startRow = [...table.rows].indexOf(active.parentElement);
    const startCol = [...active.parentElement.cells].indexOf(active);

    rows.forEach((r, ri) => {
      const tr = table.rows[startRow + ri] || table.insertRow();
      r.forEach((c, ci) => {
        const td = tr.cells[startCol + ci] || tr.insertCell();
        td.contentEditable = true;
        td.textContent = c.trim();
        togglePlaceholder(td);
      });
    });
  });
}

function leerTabla() {
  const data = [];
  document.querySelectorAll("#excel tr").forEach(tr => {
    const row = [];
    tr.querySelectorAll("td").forEach(td => row.push(td.textContent.trim()));
    if (row.some(c => c !== "")) data.push(row);
  });
  return data;
}

function validarDatos(rows, tipoAnalisis, tipoDato, K, lecturas) {
  if (!rows.length) return feedback("No se detectaron datos.", "error"), false;

  const headers = rows[0];
  const valores = rows.slice(1).flat();

  // Reglas básicas
  if (tipoDato === "cuantitativo") {
    const valid = valores.every(v => v === "" || !isNaN(parseFloat(v)));
    if (!valid) return feedback("Hay valores no numéricos.", "error"), false;
  } else if (tipoDato === "cualitativo") {
    const valid = valores.every(v => v === "" || (/^\d+$/.test(v) && parseInt(v) >= 0));
    if (!valid) return feedback("Solo se permiten enteros ≥0 para datos cualitativos.", "error"), false;
  }

  // Validar estructura
  if (K !== 2) {
    const conteo = rows.slice(1).map(r => r.filter(v => v !== "").length);
    const iguales = conteo.every(c => c === conteo[0]);
    if (!iguales) return feedback("No se puede continuar: lecturas desiguales.", "error"), false;
  }

  return true;
}

function feedback(msg, type) {
  const fb = document.getElementById("feedback");
  fb.textContent = msg;
  fb.style.color = type === "ok" ? "#00ff88" : "#ff6666";
}
