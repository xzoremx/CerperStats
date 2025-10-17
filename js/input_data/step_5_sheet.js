document.addEventListener("DOMContentLoaded", () => {
  // --- Recuperar laboratorio (clave y nombre visible) ---
  const labKey =
    sessionStorage.getItem("labSeleccionado") ||
    localStorage.getItem("labSeleccionado");
  const labName =
    sessionStorage.getItem("labNombreVisible") || labKey || "Laboratorio";

  const parametroRaw = sessionStorage.getItem("parametroSeleccionado") || "Parámetro";
  const tipoAnalisis = sessionStorage.getItem("tipoAnalisis") || "mono"; // default: mono

  // Convertir parámetro a minúsculas y plural coherente
  let parametro = parametroRaw.toLowerCase();
  if (!parametro.endsWith("s")) parametro += "s";

  document.getElementById("lab-title").textContent = `${labName} - Ingreso de Lecturas`;

  // --- Obtener datos de cantidad y lecturas ---
  const K = parseInt(sessionStorage.getItem("K")) || 1;
  const lecturas = JSON.parse(sessionStorage.getItem("lecturasPorParametro") || "[]");
  const lecturasPromedio =
    lecturas.length === 1
      ? lecturas[0]
      : lecturas.every(v => v === lecturas[0])
        ? lecturas[0]
        : `${lecturas.join(", ")}`;

  // --- Texto descriptivo ---
  const resumenLecturas =
    lecturas.every(v => v === lecturas[0])
      ? `(${K}×${lecturasPromedio})`
      : `(${K} parámetros con lecturas: ${lecturas.join(" y ")})`;

  // --- Actualizar subtítulo ---
  document.getElementById("sheet-subtitle").innerHTML =
    `Pegue o escriba las lecturas para <strong>${parametro}</strong> <span style="opacity:0.8;">${resumenLecturas}</span>.`;


  // Oculta selector redundante
  const configContainer = document.getElementById("config-container");
  if (configContainer) configContainer.style.display = "none";

  // Muestra área principal y genera la tabla según el tipoAnalisis guardado
  document.getElementById("data-entry").style.display = "block";
  document.getElementById("mode-title").innerText =
    tipoAnalisis === "mono" ? "Modo: Un solo analito" : "Modo: Multianalito";

  generarTabla(tipoAnalisis);

  // --- Botón "Continuar" con validación estructural ---
  document.getElementById("continue-btn").addEventListener("click", () => {
    // Ejecutar validación estructural y de contenido
    const esValido = validarEstructuraYContenido();

    if (esValido) {
      // Si la validación pasa, continuar tras un breve delay
      setTimeout(() => {
        if (window.cerper && window.cerper.openPage)
          window.cerper.openPage("../evaluation_select.html");
        else
          window.location.href = "../evaluation_select.html";
      }, 1000);
    } else {
      // Si la validación falla, no continuar
      notify("Corrige los errores antes de continuar.", "error");
    }
  });

});


// --- Selección de modo ---
function selectMode(selected) {
  mode = selected;
  document.getElementById("config-container").style.display = "none";
  document.getElementById("data-entry").style.display = "block";
  document.getElementById("mode-title").innerText =
    selected === "mono" ? "Modo: Un solo analito" : "Modo: Multianalito";
  generarTabla(selected);
}

function generarTabla(tipo) {
  const tbody = document.querySelector("#excel tbody");
  tbody.innerHTML = "";

  const K = parseInt(sessionStorage.getItem("K")) || 1;
  const lecturas = JSON.parse(sessionStorage.getItem("lecturasPorParametro") || "[]");
  const parametroRaw = sessionStorage.getItem("parametroSeleccionado") || "Parámetro";

  // Convertir a minúsculas y plural coherente
  let parametro = parametroRaw.toLowerCase();
  if (!parametro.endsWith("s")) parametro += "s";

  // --- Determinar cantidad de filas
  let filasTotales = 0;
  if (lecturas.length === K) {
    filasTotales = Math.max(...lecturas);
  } else {
    filasTotales = lecturas[0] || 10;
  }

  // --- MONOANALITO ---
  if (tipo === "mono") {
    const columnas = K;
    const headerRow = document.createElement("tr");

    // Derivar forma singular si termina en "s"
    let singular = parametroRaw.toLowerCase();
    if (singular.endsWith("s")) singular = singular.slice(0, -1);

    for (let i = 0; i < columnas; i++) {
      const th = document.createElement("td");
      th.textContent = `${capitalize(singular)} ${i + 1}`;
      th.classList.add("placeholder");
      headerRow.appendChild(th);
    }
    tbody.appendChild(headerRow);

    // Filas de lecturas
    for (let r = 0; r < filasTotales; r++) {
      const tr = document.createElement("tr");
      for (let c = 0; c < columnas; c++) {
        const td = document.createElement("td");
        td.contentEditable = true;
        td.classList.add("placeholder");
        td.addEventListener("input", () => togglePlaceholder(td));
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
  }

  // --- MULTIANALITO ---
  else if (tipo === "multi") {
    const columnas = K + 1; // primera columna = parámetro (ej. analista)
    const headerRow = document.createElement("tr");

    // Encabezado: parámetro + analitos (editables)
    const headers = [
      capitalize(parametroRaw),
      ...Array.from({ length: K }, (_, i) => `Analito ${i + 1}`),
    ];

    headers.forEach((h, index) => {
      const th = document.createElement("td");
      th.textContent = h;

      if (index === 0) {
        // primera celda: nombre del parámetro (ej. Analista)
        th.contentEditable = false;
        th.classList.add("fixed-param", "placeholder");
      } else {
        // celdas "Analito 1, 2, 3..."
        th.contentEditable = true;
        th.classList.add("analito-header"); 
        th.addEventListener("input", () => togglePlaceholder(th));
      }

      headerRow.appendChild(th);
    });

    tbody.appendChild(headerRow);


    // Filas: una sección por cada parámetro (ej. analista)
    for (let a = 0; a < K; a++) {
      const lecturasActuales = lecturas[a] || lecturas[0] || 5;
      for (let l = 0; l < lecturasActuales; l++) {
        const tr = document.createElement("tr");
        for (let c = 0; c < columnas; c++) {
          const td = document.createElement("td");
          td.contentEditable = true;
          td.classList.add("placeholder");
          td.addEventListener("input", () => togglePlaceholder(td));
          if (c === 0) {
            td.textContent = `${capitalize(parametroRaw)} ${a + 1}`;
            td.contentEditable = false; 
            td.classList.add("fixed-param");
          } else {
            td.contentEditable = true; 
            td.addEventListener("input", () => togglePlaceholder(td));
          }
          tr.appendChild(td);

        }
        tbody.appendChild(tr);
      }
    }
  }

  activarNavegacion();
  activarPegado();
}

// --- Función auxiliar ---
function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}


// --- Placeholders dinámicos ---
function togglePlaceholder(td) {
  td.classList.toggle("placeholder", td.textContent.trim() === "");
}

// --- Mover el cursor al final del texto ---
function moveCaretToEnd(td) {
  if (!td || !td.isContentEditable) return;
  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(td);
  range.collapse(false); 
  sel.removeAllRanges();
  sel.addRange(range);
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

    let targetRow = rowIndex;
    let targetCol = colIndex;
    let handled = false;

    // --- Flechas de dirección ---
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      handled = true;

      if (e.key === "ArrowUp") targetRow = Math.max(0, rowIndex - 1);
      if (e.key === "ArrowDown") targetRow = rowIndex + 1;
      if (e.key === "ArrowLeft") targetCol = Math.max(0, colIndex - 1);
      if (e.key === "ArrowRight") targetCol = colIndex + 1;
    }

    // --- Tab y Shift+Tab ---
    if (e.key === "Tab") {
      e.preventDefault();
      handled = true;

      if (e.shiftKey) {
        // Retrocede una celda
        if (colIndex > 0) targetCol = colIndex - 1;
        else {
          targetCol = tr.cells.length - 1;
          targetRow = Math.max(0, rowIndex - 1);
        }
      } else {
        // Avanza una celda
        if (colIndex < tr.cells.length - 1) targetCol = colIndex + 1;
        else {
          targetCol = 0;
          targetRow = rowIndex + 1;
        }
      }
    }

    // --- Enter y Shift+Enter ---
    if (e.key === "Enter") {
      e.preventDefault();
      handled = true;

      if (e.shiftKey) {
        // Subir una celda
        targetRow = Math.max(0, rowIndex - 1);
      } else {
        // Bajar una celda
        targetRow = rowIndex + 1;
      }
    }

    if (handled) {
      expandIfNeeded(table, targetRow, targetCol);
      const nextRow = table.rows[targetRow];
      const nextCell = nextRow?.cells[targetCol];
      if (nextCell) {
        nextCell.focus();
        if (nextCell.isContentEditable) moveCaretToEnd(nextCell);
      }
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
      td.addEventListener("focus", () => moveCaretToEnd(td)); 
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

// --- VALIDACIÓN VISUAL AUTOMÁTICA (Mono y Multi) ---
function validarVisual() {
  const tipoAnalisis = sessionStorage.getItem("tipoAnalisis") || "mono";
  const table = document.getElementById("excel");
  const K = parseInt(sessionStorage.getItem("K")) || 1;
  const lecturas = JSON.parse(sessionStorage.getItem("lecturasPorParametro") || "[]");

  if (!table) return;
  const rows = [...table.rows];

  // Reset de botón continuar
  const continuar = document.getElementById("continue-btn");
  continuar.disabled = true;

  // --- MONOANALITO ---
  if (tipoAnalisis === "mono") {
    const columnas = K;
    const filasEsperadas = Math.max(...lecturas);
    const colores = generarColores(K);

    let todoValido = true;

    for (let r = 1; r < rows.length; r++) {
      const celdas = [...rows[r].cells];
      for (let c = 0; c < celdas.length; c++) {
        const td = celdas[c];
        td.style.transition = "background 0.15s ease";

        const limiteCol = c < columnas;
        const limiteFila = r <= (lecturas[c] || lecturas[0] || 1);
        const dentroRango = limiteCol && limiteFila;

        const valor = td.textContent.trim();
        const esNumero = /^[+]?(?:\d+|\d*\.\d+)$/.test(valor);

        if (!dentroRango) {
          // Fuera del rango permitido
          td.style.background = valor ? "rgba(255,50,50,0.25)" : "transparent";
          if (valor) todoValido = false;
          continue;
        }

        // Dentro del rango válido
        if (valor === "") {
          td.style.background = "rgba(0,255,200,0.05)"; // tenue
        } else if (esNumero && parseFloat(valor) > 0) {
          td.style.background = "rgba(0,255,200,0.18)"; // más visible
        } else {
          td.style.background = "rgba(255,50,50,0.25)"; // error
          todoValido = false;
        }
      }
    }

    if (todoValido) continuar.disabled = false;
  }

  // --- MULTIANALITO ---
  else if (tipoAnalisis === "multi") {
    const columnas = K + 1;
    const colores = generarColores(K);
    const headers = [...rows[0].cells].slice(1);
    let todoValido = true;

    // Detectar duplicados en encabezados y vacíos con datos debajo
    const nombres = headers.map(td => td.textContent.trim().toLowerCase());
    const duplicados = nombres.filter((v, i, a) => v && a.indexOf(v) !== i);

    headers.forEach(td => {
      const nombre = td.textContent.trim().toLowerCase();
      const colIndex = [...td.parentElement.cells].indexOf(td);
      const celdasColumna = rows.slice(1).map(r => r.cells[colIndex]);
      const tieneDatos = celdasColumna.some(td => td?.textContent.trim() !== "");

      const esDuplicado = duplicados.includes(nombre);
      const esVacioConDatos = nombre === "" && tieneDatos;

      // --- Caso 1: encabezado duplicado ---
      if (esDuplicado) {
        td.style.background = "rgba(255,60,60,0.25)";
      }

      // --- Caso 2: encabezado vacío pero con datos debajo ---
      else if (esVacioConDatos) {
        td.style.background = "rgba(255,60,60,0.25)";
      }

      // --- Caso 3: encabezado válido ---
      else {
        td.style.background = tieneDatos
          ? "rgba(200,200,200,0.10)"
          : "transparent";
      }
    });


    // Bloques por analista
    let inicioFila = 1;
    let ultimaFila = 1;

    for (let a = 0; a < K; a++) {
      const colorBase = colores[a];
      const lecturasActuales = lecturas[a] || lecturas[0] || 1;
      const finFila = inicioFila + lecturasActuales - 1;
      ultimaFila = finFila; // guardar última fila válida

      for (let r = inicioFila; r <= finFila && r < rows.length; r++) {
        const celdas = [...rows[r].cells];
        celdas.forEach((td, c) => {
          td.style.transition = "background 0.2s ease";

          if (c === 0) {
            td.style.background = "transparent";
            td.style.borderTop = `2px solid ${colorBase.replace("0.25", "0.15")}`;
            return;
          }

          const valor = td.textContent.trim();
          const esNumero = /^[+]?(?:\d+|\d*\.\d+)$/.test(valor);

          if (valor === "") {
            td.style.background = `${colorBase.replace("0.25", "0.07")}`; // tenue base
          } else if (esNumero && parseFloat(valor) > 0) {
            td.style.background = `${colorBase.replace("0.25", "0.15")}`; // más notorio
          } else {
            td.style.background = "rgba(255,60,60,0.25)";
            todoValido = false;
          }
        });
      }

      inicioFila = finFila + 1;
    }

    // Filas fuera del rango (debajo del último analista)
    for (let r = ultimaFila + 1; r < rows.length; r++) {
      const celdas = [...rows[r].cells];
      celdas.forEach((td, c) => {
        if (c === 0) return; // no validar la columna fija (Analista)
        const valor = td.textContent.trim();
        if (valor !== "") {
          td.style.background = "rgba(255,60,60,0.25)"; // fuera de rango => rojo
          todoValido = false;
        } else {
          td.style.background = "transparent"; // sin color si vacío
        }
      });
    }

    if (todoValido) continuar.disabled = false;
  }


}

// --- Generador de colores dinámicos (para K analistas o columnas) ---
function generarColores(K) {
  const colores = [];
  for (let i = 0; i < K; i++) {
    const hue = (i * 360) / K;
    colores.push(`hsla(${hue}, 70%, 50%, 0.25)`); 
  }
  return colores;
}


// --- Disparo dinámico de validación ---
document.addEventListener("input", e => {
  if (e.target.tagName === "TD" && e.target.isContentEditable) validarVisual();
});
document.addEventListener("paste", e => {
  setTimeout(() => validarVisual(), 50);
});

// Ejecutar validación inicial al cargar
window.addEventListener("load", () => setTimeout(() => validarVisual(), 150));



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