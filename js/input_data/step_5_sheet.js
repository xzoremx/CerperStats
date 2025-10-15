document.addEventListener("DOMContentLoaded", () => {
  const lab = sessionStorage.getItem("labSeleccionado") || "Laboratorio";
  const parametroRaw = sessionStorage.getItem("parametroSeleccionado") || "Parámetro";
  const tipoAnalisis = sessionStorage.getItem("tipoAnalisis") || "mono"; // default: mono

  // Convertir parámetro a minúsculas y plural coherente
  let parametro = parametroRaw.toLowerCase();
  if (!parametro.endsWith("s")) parametro += "s";

  document.getElementById("lab-title").textContent = `${lab} - Ingreso de Lecturas`;
  document.getElementById("sheet-subtitle").innerHTML =
    `Pegue o escriba las lecturas para <strong>${parametro}</strong>.`;

  // Oculta selector redundante
  const configContainer = document.getElementById("config-container");
  if (configContainer) configContainer.style.display = "none";

  // Muestra área principal y genera la tabla según el tipoAnalisis guardado
  document.getElementById("data-entry").style.display = "block";
  document.getElementById("mode-title").innerText =
    tipoAnalisis === "mono" ? "Modo: Un solo analito" : "Modo: Varios analitos";

  generarTabla(tipoAnalisis);

  document.getElementById("validate-btn").addEventListener("click", () => {
    const rows = leerTabla();
    if (tipoAnalisis === "mono") validarMono(rows);
    else if (tipoAnalisis === "multi") validarMulti(rows);
  });

  document.getElementById("continue-btn").addEventListener("click", () => {
    notify("Datos guardados correctamente.", "success");
    setTimeout(() => {
      if (window.cerper && window.cerper.openPage)
        window.cerper.openPage("../evaluation_select.html");
      else window.location.href = "../evaluation_select.html";
    }, 1000);
  });
});



// --- Selección de modo ---
function selectMode(selected) {
  mode = selected;
  document.getElementById("config-container").style.display = "none";
  document.getElementById("data-entry").style.display = "block";
  document.getElementById("mode-title").innerText =
    selected === "mono" ? "Modo: Un solo analito" : "Modo: Varios analitos";
  generarTabla(selected);
}

// --- Generar tabla editable ---
function generarTabla(tipo) {
  const tbody = document.querySelector("#excel tbody");
  tbody.innerHTML = "";
  const filas = 20, columnas = tipo === "mono" ? 10 : 12;

  const placeholders =
    tipo === "mono"
      ? Array.from({ length: 10 }, (_, i) => `Analista ${i + 1}`)
      : [
          "Analista",
          "Analito 1",
          "Analito 2",
          "Analito 3",
          "Analito 4",
          "Analito 5",
          "Analito 6",
          "Analito 7",
          "Analito 8",
          "Analito 9",
          "Analito 10",
          "Analito 11",
        ];

  const headerRow = document.createElement("tr");
  for (let c = 0; c < columnas; c++) {
    const td = document.createElement("td");
    td.contentEditable = true;
    td.classList.add("placeholder");
    td.textContent = placeholders[c] || `Col ${c + 1}`;
    td.addEventListener("input", () => togglePlaceholder(td));
    headerRow.appendChild(td);
  }
  tbody.appendChild(headerRow);

  const bloqueAnalistas = 5;
  let analistaActual = 1;

  for (let i = 0; i < filas; i++) {
    const tr = document.createElement("tr");
    for (let j = 0; j < columnas; j++) {
      const td = document.createElement("td");
      td.contentEditable = true;
      td.classList.add("placeholder");
      td.addEventListener("input", () => togglePlaceholder(td));
      if (tipo === "multi" && j === 0) {
        td.textContent = `Analista ${analistaActual}`;
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
    if (tipo === "multi" && (i + 1) % bloqueAnalistas === 0) analistaActual++;
  }

  activarNavegacion();
  activarPegado();
}

// --- Placeholders dinámicos ---
function togglePlaceholder(td) {
  td.classList.toggle("placeholder", td.textContent.trim() === "");
}



// --- Navegación con flechas ---
function activarNavegacion() {
  const table = document.getElementById("excel");
  table.addEventListener("keydown", function (e) {
    const cell = document.activeElement;
    if (cell.tagName !== "TD") return;

    const tr = cell.parentElement;
    const rowIndex = [...table.rows].indexOf(tr);
    const colIndex = [...tr.cells].indexOf(cell);

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      let targetRow = rowIndex;
      let targetCol = colIndex;

      if (e.key === "ArrowUp") targetRow = Math.max(0, rowIndex - 1);
      if (e.key === "ArrowDown") targetRow = rowIndex + 1;
      if (e.key === "ArrowLeft") targetCol = Math.max(0, colIndex - 1);
      if (e.key === "ArrowRight") targetCol = colIndex + 1;

      expandIfNeeded(table, targetRow, targetCol);
      const nextRow = table.rows[targetRow];
      const nextCell = nextRow?.cells[targetCol];
      if (nextCell) nextCell.focus();
    }
  });
}

// --- Expansión automática ---
function expandIfNeeded(table, targetRow, targetCol) {
  const totalRows = table.rows.length;
  const totalCols = table.rows[0].cells.length;

  if (targetRow >= totalRows) {
    const newRow = document.createElement("tr");
    for (let j = 0; j < totalCols; j++) {
      const td = document.createElement("td");
      td.contentEditable = true;
      td.classList.add("placeholder");
      td.addEventListener("input", () => togglePlaceholder(td));
      newRow.appendChild(td);
    }
    table.tBodies[0].appendChild(newRow);
  }

  if (targetCol >= totalCols) {
    for (let r of table.rows) {
      const td = document.createElement("td");
      td.contentEditable = true;
      td.classList.add("placeholder");
      td.addEventListener("input", () => togglePlaceholder(td));
      r.appendChild(td);
    }
  }
}

// --- Pegar desde Excel ---
function activarPegado() {
  document.getElementById("excel").addEventListener("paste", function (e) {
    const active = document.activeElement;
    if (active.tagName !== "TD") return;

    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text");
    const rows = text.trim().split(/\r?\n/).map((r) => r.split("\t"));
    const table = document.getElementById("excel");
    const startRow = [...table.rows].indexOf(active.parentElement);
    const startCol = [...active.parentElement.cells].indexOf(active);

    const neededRows = startRow + rows.length;
    const neededCols = startCol + Math.max(...rows.map((r) => r.length));

    while (table.rows.length < neededRows) {
      const newRow = document.createElement("tr");
      for (let j = 0; j < table.rows[0].cells.length; j++) {
        const td = document.createElement("td");
        td.contentEditable = true;
        td.classList.add("placeholder");
        td.addEventListener("input", () => togglePlaceholder(td));
        newRow.appendChild(td);
      }
      table.tBodies[0].appendChild(newRow);
    }

    if (neededCols > table.rows[0].cells.length) {
      for (let r of table.rows) {
        for (let c = r.cells.length; c < neededCols; c++) {
          const td = document.createElement("td");
          td.contentEditable = true;
          td.classList.add("placeholder");
          td.addEventListener("input", () => togglePlaceholder(td));
          r.appendChild(td);
        }
      }
    }

    rows.forEach((r, ri) => {
      const tr = table.rows[startRow + ri];
      if (!tr) return;
      r.forEach((c, ci) => {
        const td = tr.cells[startCol + ci];
        if (!td) return;
        td.textContent = c.trim();
        togglePlaceholder(td);
      });
    });
  });
}

// --- Validación y feedback ---
function leerTabla() {
  const data = [];
  document.querySelectorAll("#excel tr").forEach((tr) => {
    const row = [];
    tr.querySelectorAll("td").forEach((td) => row.push(td.textContent.trim()));
    if (row.some((c) => c !== "")) data.push(row);
  });
  return data;
}

function validarMono(rows) {
  if (!rows.length) return feedback("No se detectaron datos.", "error");
  const headers = rows[0];
  const numericCheck = rows.slice(1).flat().every((v) => !isNaN(parseFloat(v)) || v === "");
  if (!numericCheck) return feedback("Hay valores no numéricos.", "error");
  feedback(`Modo monoanalito válido (${headers.length} analistas).`, "ok");
  document.getElementById("continue-btn").disabled = false;
}

function validarMulti(rows) {
  if (!rows.length) return feedback("No se detectaron datos.", "error");
  const headers = rows[0];
  if (headers[0].toLowerCase() !== "analista")
    return feedback("La primera columna debe llamarse 'Analista'.", "error");
  const numericCheck = rows
    .slice(1)
    .flatMap((r) => r.slice(1))
    .every((v) => !isNaN(parseFloat(v)) || v === "");
  if (!numericCheck) return feedback("Hay celdas no numéricas.", "error");
  feedback(`Modo multianalito válido (${headers.length - 1} analitos).`, "ok");
  document.getElementById("continue-btn").disabled = false;
}

// --- Feedback visual ---
function feedback(msg, type) {
  const fb = document.getElementById("feedback");
  fb.innerText = msg;
  fb.style.color = type === "ok" ? "#00ff88" : "#ff6666";
}

// --- Botón Volver ---
  document.getElementById("go-back").addEventListener("click", () => {
    if (window.cerper && window.cerper.openPage) {
      window.cerper.openPage("input_data/step_4_k.html");
    } else {
      window.location.href = "step_4_k.html";
    }
  });

// --- Notificaciones flotantes ---
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
