document.addEventListener("DOMContentLoaded", async () => {
  // Control de retorno y reanudación de sesión
  const btnBack = document.getElementById("btn-go-back") || document.getElementById("go-back");
  const sessionId = sessionStorage.getItem("sessionID");
  const tipoAnalisis = sessionStorage.getItem("tipoAnalisis") || "mono";
  // --- Recuperar laboratorio (clave y nombre visible) ---
  const labKey =
    sessionStorage.getItem("labSeleccionado") ||
    localStorage.getItem("labSeleccionado");
  const labName =
    sessionStorage.getItem("labNombreVisible") || labKey || "Laboratorio";

  const parametroRaw = sessionStorage.getItem("parametroSeleccionado") || "Parámetro";
  // Marcar visualmente si hay sesión activa, pero permitir que el handler global maneje el flujo
  if (sessionId && btnBack) {
    btnBack.classList.add("locked");
  }

  // Bloquear selects base si hay sesión activa
  if (sessionId) {
    [
      "labKey","tipoAnalisis","tipoDato","modoCualitativo",
      "metodo","producto","ensayo","unidad","procedure","expediente"
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = true;
    });
  }

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

  // --- Tipo de dato y modo ---
  const tipoDato = (sessionStorage.getItem("tipoDato") || "cuantitativo").toLowerCase();
  const modoSeleccionado = sessionStorage.getItem("modoCualitativo") || null;

  // --- Texto complementario según tipo ---
  let tipoDescripcion = "";
  if (tipoDato === "cuantitativo") {
    tipoDescripcion = `<span style="opacity:0.7;">Tipo de dato: <strong>Cuantitativo</strong></span>`;
  } else if (tipoDato === "cualitativo") {
    tipoDescripcion = `<span style="opacity:0.7;">Tipo de dato: <strong>Cualitativo</strong>${modoSeleccionado ? ` — ${modoSeleccionado}` : ""}</span>`;
  }

  // --- Actualizar subtítulo ---
  document.getElementById("sheet-subtitle").innerHTML = `
    Pegue o escriba las lecturas para <strong>${parametro}</strong> 
    <span style="opacity:0.8;">${resumenLecturas}</span>.<br>
    ${tipoDescripcion}
  `;



  // Oculta selector redundante
  const configContainer = document.getElementById("config-container");
  if (configContainer) configContainer.style.display = "none";

  // Muestra área principal y genera la tabla según el tipoAnalisis guardado
  document.getElementById("data-entry").style.display = "block";
  document.getElementById("mode-title").innerText =
    tipoAnalisis === "mono" ? "Modo: Un solo analito" : "Modo: Multianalito";

  generarTabla(tipoAnalisis);

  // Cargar lecturas guardadas (si hay sesión activa)
  if (sessionId) {
    try {
      const res = await window.cerper.getInputsBySession(sessionId, tipoAnalisis);
      if (res?.ok && res.data?.length > 0) {
        if (tipoAnalisis === "multianalito" || tipoAnalisis === "multi") {
          rellenarTablaMulti(res.data);
        } else {
          rellenarTablaMono(res.data);
        }
        notify("Se cargaron los datos guardados de esta sesión.", "info");
      }
    } catch (err) {
      console.error("[Step5] Error cargando lecturas:", err);
      notify("Error al cargar lecturas guardadas.", "error");
    }
  }

  // --- Habilitar botón "Continuar" ---
  const continuarBtn = document.getElementById("continue-btn");
  if (continuarBtn) continuarBtn.disabled = false;


  // --- Botón "Continuar" con validación estructural + confirmación + guardado de DataFrame ---
  document.getElementById("continue-btn").addEventListener("click", async () => {
    try {
      const resultado = validarEstructuraYContenido();

      if (resultado === true) {
        const _existing = sessionStorage.getItem("sessionID");

        if (_existing) {
          notify("Actualizando lecturas en la sesión existente...", "info");
        } else {
          // Confirmación con modal visual
          const conf = await mostrarConfirmacion(
            "Confirmar creación de sesión",
            "¿Deseas continuar y crear la sesión?<br>Se guardarán las lecturas ingresadas."
          );

          if (!conf) {
            notify("Creación de sesión cancelada por el usuario.", "warning");
            return;
          }

          notify("Datos validados correctamente. Creando sesión...", "success");

          // --- Crear sesión ---
          const usuario = sessionStorage.getItem("usuario_id");
          const sessionData = {
            lab_key: sessionStorage.getItem("labSeleccionado"),
            procedure: sessionStorage.getItem("procedimientoSeleccionado"),
            metodo: sessionStorage.getItem("metodo"),
            producto: sessionStorage.getItem("producto"),
            ensayo: sessionStorage.getItem("ensayo"),
            expediente: sessionStorage.getItem("expediente"),
            unidad: sessionStorage.getItem("unidad"),
            tipo_analisis: sessionStorage.getItem("tipoAnalisis"),
            tipo_dato: sessionStorage.getItem("tipoDato"),
            modo_cualitativo: sessionStorage.getItem("modoCualitativo"),
            parametro: sessionStorage.getItem("parametroSeleccionado"),
            usuario
          };

          const resSession = await window.cerper.insertSession(sessionData);

          if (!resSession.ok) {
            notify(`No se pudo crear la sesión: ${resSession.error}`, "error");
            return;
          }

          sessionStorage.setItem("sessionID", resSession.session_id);
          console.log(`[CerperStats] Nueva sesión creada con ID ${resSession.session_id}`);
          notify("Sesión creada correctamente. Guardando lecturas...", "success");
        }

        // --- Guardar lecturas en inputs ---
        const res = await window.guardarDataframeTemp();

        if (res.ok) {
          notify("Datos guardados correctamente en la base de datos.", "success");
          setTimeout(() => {
            window.cerper.openPage("evaluation_select.html");
          }, 1000);
        } else {
          notify(`Error guardando datos: ${res.error}`, "error");
        }
      } else if (resultado?.errores?.length > 0) {
        mostrarErroresSecuenciales(resultado.errores);
      } else {
        notify("Error interno o estructura no válida.", "error");
      }
    } catch (err) {
      console.error("Error durante la validación/guardado:", err);
      notify("Error inesperado durante la validación o guardado.", "error");
    }
  });





});

// --- Validación de Cualitativo: usar valores elegidos en Step 3 ---
document.addEventListener("DOMContentLoaded", () => {
  const tipoDato = sessionStorage.getItem("tipoDato") || "cuantitativo";

  if (tipoDato === "cualitativo") {
    const modoSeleccionado = sessionStorage.getItem("modoCualitativo") || "no definido";
    const valoresStr = sessionStorage.getItem("valoresPermitidos");

    if (!valoresStr) {
      console.error("[CerperStats] No se encontraron valoresPermitidos en sessionStorage (step 3 no guardó nada).");
      notify(`No se encontraron valores permitidos para el modo: ${modoSeleccionado}`, "error");
      return;
    }

    try {
      const valores = JSON.parse(valoresStr);
      console.log(`[CerperStats] Usando valores permitidos desde Step 3 (${modoSeleccionado}):`, valores);
    } catch (err) {
      console.error("Error al parsear valoresPermitidos guardados:", err);
      notify("Error al leer los valores permitidos definidos en Step 3.", "error");
    }
  }
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
  activarCopiadoExcel();

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

  
  // --- MONOANALITO ---
  if (tipoAnalisis === "mono") {
    const columnas = K;
    const filasEsperadas = Math.max(...lecturas);
    const colores = generarColores(K);

    let todoValido = true;

    // --- Fila 0 (encabezado debe estar vacío) ---
    const headerCells = [...rows[0].cells];
    headerCells.forEach((td, index) => {
      // Solo validar celdas fuera del rango de encabezados originales
      if (index >= K) {
        const valor = td.textContent.trim();
        if (valor !== "") {
          td.style.background = "rgba(255,50,50,0.25)"; // error si tiene texto o número
          todoValido = false;
        } else {
          td.style.background = "transparent"; // sin color si vacío
        }
      } else {
        // No marcar las K primeras celdas del encabezado
        td.style.background = "transparent";
      }
    });


    // --- Filas de datos ---
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
          td.style.background = "rgba(0,255,200,0.05)"; // vacía dentro del rango
        } else {

          const num = parseFloat(valor.replace(",", "."));
          const tipoDato = sessionStorage.getItem("tipoDato") || "cuantitativo";
          const valoresStr = sessionStorage.getItem("valoresPermitidos");
          const permitidos = valoresStr ? JSON.parse(valoresStr) : null;

          if (tipoDato === "cuantitativo" && num > 0) {
            td.style.background = "rgba(0,255,200,0.18)"; // válido
          }
          else if (tipoDato === "cualitativo" && permitidos && Number.isInteger(num) && permitidos.includes(num)) {
            td.style.background = "rgba(0,255,200,0.18)"; // válido
          }
          else if (tipoDato === "cualitativo") {
            td.style.background = "rgba(255,50,50,0.25)"; // inválido
            todoValido = false;
          }
          else {
            td.style.background = "rgba(255,50,50,0.25)"; // inválido
            todoValido = false;
          }

        }

      }
    }

    
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
            } else {
              const num = parseFloat(valor.replace(",", "."));
              const tipoDato = sessionStorage.getItem("tipoDato") || "cuantitativo";
              const valoresStr = sessionStorage.getItem("valoresPermitidos");
              const permitidos = valoresStr ? JSON.parse(valoresStr) : null;

              if (tipoDato === "cuantitativo" && num > 0) {
                td.style.background = `${colorBase.replace("0.25", "0.15")}`; // válido
              }
              else if (tipoDato === "cualitativo" && permitidos && Number.isInteger(num) && permitidos.includes(num)) {
                td.style.background = `${colorBase.replace("0.25", "0.15")}`; // válido
              }
              else if (tipoDato === "cualitativo") {
                td.style.background = "rgba(255,60,60,0.25)"; // inválido
                todoValido = false;
              }
              else {
                td.style.background = "rgba(255,60,60,0.25)"; // inválido
                todoValido = false;
              }

            }

        });
      }

      inicioFila = finFila + 1;
    }

    // --- Validar columna fija (parámetro) fuera del rango de analistas válidos ---
    const totalFilas = rows.length;
    for (let r = 1; r < totalFilas; r++) {
      const td = rows[r].cells[0]; // primera columna
      const valor = td.textContent.trim();

      // Determinar qué analista corresponde según las secciones esperadas
      let filasValidas = 0;
      for (let a = 0; a < K; a++) filasValidas += (lecturas[a] || lecturas[0] || 1);

      // --- Solo validar celdas fuera del rango de filas válidas ---
      if (r > filasValidas) {
        if (valor !== "") {
          td.style.background = "rgba(255,50,50,0.25)"; // error si hay texto fuera de rango
          todoValido = false;
        } else {
          td.style.background = "transparent"; // vacío fuera de rango = ok
          td.style.color = "";
          td.style.fontWeight = "";
        }
      } else {
        // Dentro del rango válido → mantener transparente
        td.style.background = "transparent";
        td.style.color = "";
        td.style.fontWeight = "";
      }
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

// --- Copiar desde UI a Excel (modo Excel; toggle con Ctrl+Tab o Ctrl+Shift+X) ---
function activarCopiadoExcel() {
  const table = document.getElementById("excel");
  if (!table) return;

  let startCell = null;
  let endCell = null;
  let modoSeleccionActivo = false;

  // Badge visual (opcional) para indicar modo activo
  let badge = document.getElementById("copy-badge");
  if (!badge) {
    badge = document.createElement("div");
    badge.id = "copy-badge";
    badge.textContent = "Modo Copia: OFF";
    Object.assign(badge.style, {
      position: "fixed", bottom: "16px", right: "16px",
      padding: "8px 12px", borderRadius: "10px",
      background: "rgba(0,255,255,0.12)", color: "rgba(6, 244, 248, 1)",
      fontFamily: "Segoe UI, sans-serif", fontSize: "12px",
      border: "1px solid rgba(0,255,255,0.35)",
      boxShadow: "0 0 12px rgba(0,255,255,0.2)",
      backdropFilter: "blur(6px)", zIndex: 9999
    });
    document.body.appendChild(badge);
  }
  const setBadge = (on) => { badge.textContent = `Modo Copia: ${on ? "ON" : "OFF"}`; };

  function clearSelection() {
    table.querySelectorAll("td.selected").forEach(td => td.classList.remove("selected"));
  }

  function selectRange(start, end) {
    clearSelection();
    const rows = [...table.rows];
    const startRow = Math.min(start.parentElement.rowIndex, end.parentElement.rowIndex);
    const endRow = Math.max(start.parentElement.rowIndex, end.parentElement.rowIndex);
    const startCol = Math.min(start.cellIndex, end.cellIndex);
    const endCol = Math.max(start.cellIndex, end.cellIndex);

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const cell = rows[r]?.cells[c];
        if (cell) cell.classList.add("selected");
      }
    }
  }

  // Toggle modo selección: Ctrl+Tab (primario) o Ctrl+Shift+X (fallback)
  document.addEventListener("keydown", (e) => {
    const isCtrlTab = e.ctrlKey && e.key === "Tab";
    const isFallback = e.ctrlKey && e.shiftKey && (e.key.toLowerCase() === "x");
    if (isCtrlTab || isFallback) {
      e.preventDefault();
      modoSeleccionActivo = !modoSeleccionActivo;
      if (!modoSeleccionActivo) clearSelection();
      setBadge(modoSeleccionActivo);
      notify(modoSeleccionActivo ? "Modo de copiado activado." : "Modo de copiado desactivado.", "success");
    }
  });

  // Selección por arrastre (solo en modo activo)
  table.addEventListener("mousedown", (e) => {
    if (!modoSeleccionActivo) return;
    const td = e.target.closest("td");
    if (!td) return;
    e.preventDefault();
    startCell = td;
    endCell = td;
    selectRange(startCell, endCell);
    table.addEventListener("mouseover", onMouseOver);
    document.addEventListener("mouseup", onMouseUp, { once: true });
  });

  function onMouseOver(e) {
    if (!modoSeleccionActivo) return;
    const td = e.target.closest("td");
    if (!td) return;
    endCell = td;
    selectRange(startCell, endCell);
  }

  function onMouseUp() {
    table.removeEventListener("mouseover", onMouseOver);
  }

  // Copiar con Ctrl+C (sin depender del evento 'copy')
  document.addEventListener("keydown", async (e) => {
    if (!modoSeleccionActivo) return;
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key.toLowerCase() !== "c") return;

    e.preventDefault();

    const rows = [...table.rows];
    const selected = [...table.querySelectorAll("td.selected")];

    // Si no hay rango, copiar celda activa
    if (selected.length === 0) {
      const active = document.activeElement?.closest?.("td");
      const text = active ? active.textContent.trim() : "";
      try {
        await navigator.clipboard.writeText(text);
        notify("Celda copiada al portapapeles.", "success");
      } catch {
        fallbackClipboardWrite(text, e);
      }
      return;
    }

    // Armar el TSV del rango rectangular más pequeño que contiene la selección
    const rowIdx = [...new Set(selected.map(td => td.parentElement.rowIndex))].sort((a, b) => a - b);
    const colIdx = [...new Set(selected.map(td => td.cellIndex))].sort((a, b) => a - b);

    let tsv = "";
    for (let r = rowIdx[0]; r <= rowIdx[rowIdx.length - 1]; r++) {
      const line = colIdx.map(c => (rows[r]?.cells[c]?.textContent ?? "").toString().trim()).join("\t");
      tsv += line + (r < rowIdx[rowIdx.length - 1] ? "\n" : "");
    }

    try {
      await navigator.clipboard.writeText(tsv);
      notify("Datos copiados al portapapeles.", "success");
    } catch {
      fallbackClipboardWrite(tsv, e);
    }
  });

  // Fallback si el permiso de clipboard falla
  function fallbackClipboardWrite(text, evt) {
    try {
      // Intentar usar el portapapeles del evento 'copy' si existe
      if (evt && evt.clipboardData) {
        evt.clipboardData.setData("text/plain", text);
        notify("Datos copiados (fallback).", "success");
      } else {
        // Último recurso: textarea temporal + execCommand
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        notify("Datos copiados (fallback).", "success");
      }
    } catch {
      notify("No se pudo copiar. Revisa permisos del portapapeles.", "error");
    }
  }
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


// === Notificaciones flotantes ===
window.notify = function (message, type = "info") {
  // Elimina notificación previa
  const existing = document.querySelector(".notify");
  if (existing) existing.remove();

  // Crear elemento
  const div = document.createElement("div");
  div.className = `notify ${type}`;
  div.textContent = message;
  document.body.appendChild(div);

  // Mostrar con animación
  requestAnimationFrame(() => div.classList.add("show"));

  // Ocultar y eliminar
  setTimeout(() => div.classList.remove("show"), 2800);
  setTimeout(() => div.remove(), 3300);
};


// --- Mostrar errores uno por uno ---
function mostrarErroresSecuenciales(listaErrores) {
  if (!listaErrores || listaErrores.length === 0) {
    notify("Corrige los errores antes de continuar.", "error");
    return;
  }

  let index = 0;

  function mostrarSiguiente() {
    if (index < listaErrores.length) {
      notify(listaErrores[index], "error");
      index++;
      // muestra el siguiente tras un pequeño delay
      setTimeout(mostrarSiguiente, 1800);
    }
  }

  mostrarSiguiente();
}

function rellenarTablaMono(datos) {
  const table = document.getElementById("excel");
  if (!table || !table.rows?.length) return;

  const headerCells = [...table.rows[0].cells];
  const headerMap = headerCells.reduce((acc, td, idx) => {
    const name = (td.textContent || "").trim();
    if (name) acc[name] = idx;
    return acc;
  }, {});

  datos.forEach(d => {
    const colIndex = headerMap[d.parametro];
    if (colIndex == null) return;
    const r = Number(d.lectura_idx);
    const row = table.rows[r];
    if (!row) return;
    const cell = row.cells[colIndex];
    if (cell) cell.textContent = (d.valor ?? "").toString();
  });
}

function rellenarTablaMulti(datos) {
  const table = document.getElementById("excel");
  if (!table || !table.rows?.length) return;

  const rows = [...table.rows];
  const headerCells = [...rows[0].cells];

  // 1) Setear nombres de analitos en encabezados desde los datos
  const K = parseInt(sessionStorage.getItem("K")) || (headerCells.length - 1);
  const analitosUnicos = [];
  for (const d of datos) {
    const name = (d.analito ?? "").toString().trim();
    if (name && !analitosUnicos.includes(name)) analitosUnicos.push(name);
    if (analitosUnicos.length >= K) break;
  }
  for (let i = 0; i < K; i++) {
    const th = headerCells[i + 1]; // desde la columna 1 (índice 1) en adelante
    if (!th) continue;
    if (analitosUnicos[i]) th.textContent = analitosUnicos[i];
  }

  // Recalcular mapa de encabezados tras actualizar textos
  const headerMap = [...rows[0].cells].reduce((acc, td, idx) => {
    const name = (td.textContent || "").trim();
    if (name) acc[name] = idx;
    return acc;
  }, {});

  // 2) Mapear nombre del parámetro a índice inicial de su bloque de filas
  const paramStartIndex = {};
  for (let r = 1; r < rows.length; r++) {
    const name = (rows[r].cells[0]?.textContent || "").trim();
    if (name && !(name in paramStartIndex)) {
      paramStartIndex[name] = r; // primera fila del bloque para ese parámetro
    }
  }

  // 3) Volcar valores en sus celdas correspondientes
  datos.forEach(d => {
    const colIndex = headerMap[(d.analito ?? "").toString().trim()];
    if (colIndex == null) return;

    const paramName = (d.parametro ?? "").toString().trim();
    const start = paramStartIndex[paramName];
    if (start == null) return;

    const li = Number(d.lectura_idx) || 1; // base 1
    const row = table.rows[start + li - 1];
    if (!row) return;
    const cell = row.cells[colIndex];
    if (cell) {
      cell.textContent = (d.valor ?? "").toString();
      togglePlaceholder(cell);
    }
  });
}

// --- Botón Volver ---
const btnBack = document.getElementById("go-back") || document.getElementById("btn-go-back");

if (btnBack) {
  let backClickCount = 0;

  btnBack.addEventListener("click", async (e) => {
    e.preventDefault();
    const sessionId = sessionStorage.getItem("sessionID");

    // --- Caso 1: no hay sesión activa ---
    if (!sessionId) {
      window.cerper.openPage("input_data/step_4_k.html");
      return;
    }

    // --- Caso 2: primera vez que hace clic ---
    backClickCount++;
    if (backClickCount === 1) {
      notify("Si regresa, se perderán las lecturas. Presione de nuevo para volver.", "warning");

      // Reinicia contador si no hace segundo clic dentro de 3s
      setTimeout(() => { backClickCount = 0; }, 3000);
      return;
    }

    // --- Caso 3: segundo clic: confirmar reinicio total ---
    const confirmar = await mostrarConfirmacion(
      "¿Reiniciar proceso?",
      "Esto eliminará todas las lecturas ingresadas. ¿Desea continuar?"
    );

    if (confirmar) {
      try {
        const sessionId = sessionStorage.getItem("sessionID");

        // Eliminar sesión y sus inputs (rollback total)
        if (sessionId && window.cerper?.deleteSessionDeep) {
          const delRes = await window.cerper.deleteSessionDeep(sessionId);
          if (!delRes?.ok) {
            console.warn("[Step5] No se pudo eliminar completamente la sesión:", delRes?.error);
          }
        } else if (sessionId && window.cerper?.closeSession) {
          // Fallback mínimo: solo cerrar sesión si no existe deleteSessionDeep
          await window.cerper.closeSession(sessionId);
        }

        // Eliminar solo claves del wizard/sesión actual (no tocar login)
        const removeKeys = [
          "sessionID",
          "monoAnalitoDatos",
          "multiAnalitoDatos",
        ];
        removeKeys.forEach(k => sessionStorage.removeItem(k));

        notify("Volviendo al paso anterior...", "info");
        setTimeout(() => window.cerper.openPage("procedure_select.html"), 900);
      } catch (err) {
        console.error("[CerperStats] Error al reiniciar:", err);
        notify("Ocurrió un error al reiniciar.", "error");
      }
    } else {
      notify("Se mantiene la sesión actual.", "success");
    }

    backClickCount = 0;
  });
}


// --- Modal de confirmación simple ---
async function mostrarConfirmacion(titulo, mensaje) {
  return new Promise((resolve) => {
    // === Fondo difuminado y bloqueo ===
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    Object.assign(overlay.style, {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      background: "rgba(0,0,0,0.3)",
      backdropFilter: "blur(8px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9998,
      animation: "fadeSlideIn 0.4s ease forwards",
      pointerEvents: "all",
      userSelect: "none",
    });

    // === Caja del modal ===
    const modal = document.createElement("div");
    Object.assign(modal.style, {
      backdropFilter: "blur(12px)",
      background: "rgba(0,255,255,0.08)",
      border: "1.5px solid rgba(0,255,255,0.35)",
      boxShadow: "0 0 25px rgba(0,255,255,0.15)",
      borderRadius: "16px",
      padding: "28px 32px",
      width: "360px",
      textAlign: "center",
      color: "#00ffff",
      fontFamily: "Segoe UI, sans-serif",
      fontWeight: "500",
      animation: "fadeSlideIn 0.45s ease forwards",
    });

    modal.innerHTML = `
      <h3 style="margin:0; font-size:1.15rem; color:#00ffff;">${titulo}</h3>
      <p style="margin:14px 0 22px; font-size:0.95rem; color:#80e4ff; line-height:1.4;">
        ${mensaje}
      </p>
      <div style="display:flex; justify-content:center; gap:16px;">
        <button id="confirm-yes" class="modal-btn yes"
          style="padding:8px 18px; border-radius:10px; background:rgba(0,255,255,0.15); border:1px solid rgba(0,255,255,0.4); color:#00ffff; cursor:pointer;">
          Sí
        </button>
        <button id="confirm-no" class="modal-btn no"
          style="padding:8px 18px; border-radius:10px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.2); color:#80e4ff; cursor:pointer;">
          No
        </button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // === Control de botones ===
    const yes = modal.querySelector("#confirm-yes");
    const no = modal.querySelector("#confirm-no");

    const closeModal = (value) => {
      overlay.classList.add("closing");
      setTimeout(() => overlay.remove(), 250);
      resolve(value);
    };

    yes.addEventListener("click", () => closeModal(true));
    no.addEventListener("click", () => closeModal(false));

    // Cerrar con tecla Escape
    const escListener = (ev) => {
      if (ev.key === "Escape") {
        document.removeEventListener("keydown", escListener);
        closeModal(false);
      }
    };
    document.addEventListener("keydown", escListener);
  });
}





