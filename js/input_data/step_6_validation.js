/**
 * step_6_validation.js
 * 
 * Responsabilidades:
 * - Validación visual automática (colorea celdas según validez)
 * - Validación estructural de datos (encabezados, rangos, valores)
 * - Construcción de estructuras de datos para guardar
 * 
 * Depende de: validation_utils.js (funciones puras)
 */

// ============================================================
// ACCESO A UTILIDADES
// ============================================================
const Utils = typeof window !== "undefined" && window.ValidationUtils
  ? window.ValidationUtils
  : require("./validation_utils.js");

// ============================================================
// CONFIGURACIÓN DE COLORES
// ============================================================
const COLORS = {
  valid: "rgba(0,255,200,0.18)",
  validEmpty: "rgba(0,255,200,0.05)",
  error: "rgba(255,50,50,0.25)",
  errorMulti: "rgba(255,60,60,0.25)",
  headerWithData: "rgba(200,200,200,0.10)",
  transparent: "transparent"
};

// ============================================================
// VALIDACIÓN VISUAL AUTOMÁTICA
// ============================================================

/**
 * Aplica estilos visuales a las celdas según su validez
 * Se llama automáticamente en cada input/paste
 */
function validarVisual() {
  const tipoAnalisis = sessionStorage.getItem("tipoAnalisis") || sessionStorage.getItem("modoAnalito") || "mono";
  const table = document.getElementById("excel");
  if (!table) return;

  const K = parseInt(sessionStorage.getItem("K")) || 1;
  const lecturas = JSON.parse(sessionStorage.getItem("lecturasPorParametro") || "[]");
  const tipoDato = sessionStorage.getItem("tipoDato") || "cuantitativo";
  const valoresStr = sessionStorage.getItem("valoresPermitidos");
  const permitidos = valoresStr ? JSON.parse(valoresStr) : null;

  const rows = [...table.rows];
  const colores = Utils.generarColores(K);

  const validationConfig = { tipoDato, valoresPermitidos: permitidos };

  if (tipoAnalisis === "mono") {
    validarVisualMono(rows, K, lecturas, validationConfig);
  } else if (tipoAnalisis === "multi" || tipoAnalisis === "multianalito") {
    validarVisualMulti(rows, K, lecturas, colores, validationConfig);
  }
}

/**
 * Validación visual para modo monoanalito
 */
function validarVisualMono(rows, K, lecturas, config) {
  const columnas = K;

  // --- Validar encabezados fuera de rango ---
  const headerCells = [...rows[0].cells];
  headerCells.forEach((td, index) => {
    if (index >= K) {
      const valor = td.textContent.trim();
      td.style.background = valor !== "" ? COLORS.error : COLORS.transparent;
    } else {
      td.style.background = COLORS.transparent;
    }
  });

  // --- Validar filas de datos ---
  for (let r = 1; r < rows.length; r++) {
    const celdas = [...rows[r].cells];
    for (let c = 0; c < celdas.length; c++) {
      const td = celdas[c];
      td.style.transition = "background 0.15s ease";

      const dentroRango = Utils.estaDentroDeRango(r, c, K, lecturas);
      const valor = td.textContent.trim();

      if (!dentroRango) {
        td.style.background = valor ? COLORS.error : COLORS.transparent;
        continue;
      }

      // Dentro del rango válido
      if (valor === "") {
        td.style.background = COLORS.validEmpty;
      } else {
        const resultado = Utils.validateCellValue(valor, config);
        td.style.background = resultado.valid ? COLORS.valid : COLORS.error;
      }
    }
  }
}

/**
 * Validación visual para modo multianalito
 */
function validarVisualMulti(rows, K, lecturas, colores, config) {
  const headers = [...rows[0].cells].slice(1);

  // --- Detectar duplicados en encabezados ---
  const nombres = headers.map(td => td.textContent.trim().toLowerCase());
  const duplicados = Utils.findDuplicates(nombres);

  headers.forEach(td => {
    const nombre = td.textContent.trim().toLowerCase();
    const colIndex = [...td.parentElement.cells].indexOf(td);
    const celdasColumna = rows.slice(1).map(r => r.cells[colIndex]);
    const tieneDatos = celdasColumna.some(cell => cell?.textContent.trim() !== "");

    const esDuplicado = nombre && duplicados.some(d => d.toLowerCase() === nombre);
    const esVacioConDatos = nombre === "" && tieneDatos;

    if (esDuplicado || esVacioConDatos) {
      td.style.background = COLORS.errorMulti;
    } else {
      td.style.background = tieneDatos ? COLORS.headerWithData : COLORS.transparent;
    }
  });

  // --- Validar bloques por parámetro ---
  let inicioFila = 1;
  const filasValidas = Utils.calcularFilasValidas(K, lecturas);

  for (let a = 0; a < K; a++) {
    const colorBase = colores[a];
    const lecturasActuales = lecturas[a] || lecturas[0] || 1;
    const finFila = inicioFila + lecturasActuales - 1;

    for (let r = inicioFila; r <= finFila && r < rows.length; r++) {
      const celdas = [...rows[r].cells];
      celdas.forEach((td, c) => {
        td.style.transition = "background 0.2s ease";

        if (c === 0) {
          td.style.background = COLORS.transparent;
          td.style.borderTop = `2px solid ${colorBase.replace("0.25", "0.15")}`;
          return;
        }

        const valor = td.textContent.trim();
        if (valor === "") {
          td.style.background = colorBase.replace("0.25", "0.07");
        } else {
          const resultado = Utils.validateCellValue(valor, config);
          td.style.background = resultado.valid
            ? colorBase.replace("0.25", "0.15")
            : COLORS.errorMulti;
        }
      });
    }

    inicioFila = finFila + 1;
  }

  // --- Validar columna fija fuera de rango ---
  for (let r = 1; r < rows.length; r++) {
    const td = rows[r].cells[0];
    if (r > filasValidas) {
      const valor = td.textContent.trim();
      td.style.background = valor !== "" ? COLORS.error : COLORS.transparent;
      td.style.color = "";
      td.style.fontWeight = "";
    } else {
      td.style.background = COLORS.transparent;
      td.style.color = "";
      td.style.fontWeight = "";
    }
  }

  // --- Validar filas fuera del rango total ---
  for (let r = filasValidas + 1; r < rows.length; r++) {
    const celdas = [...rows[r].cells];
    celdas.forEach((td, c) => {
      if (c === 0) return;
      const valor = td.textContent.trim();
      td.style.background = valor !== "" ? COLORS.errorMulti : COLORS.transparent;
    });
  }
}

// ============================================================
// VALIDACIÓN ESTRUCTURAL Y DE CONTENIDO
// ============================================================

/**
 * Valida encabezados multianalito
 * @returns {string[]} Lista de encabezados válidos
 */
function checkEncabezadosMulti(rows, errores) {
  const headers = [...rows[0].cells].slice(1);
  const nombres = headers.map(td => td.textContent.trim()).filter(Boolean);
  const duplicados = Utils.findDuplicates(nombres);

  if (duplicados.length > 0) {
    errores.push(`Encabezados duplicados: ${[...new Set(duplicados)].join(", ")}`);
  }

  headers.forEach((td, i) => {
    const nombre = td.textContent.trim();
    const colIndex = i + 1;
    const tieneDatos = rows.slice(1).some(r => (r.cells[colIndex]?.textContent.trim() || "") !== "");
    if (!nombre && tieneDatos) {
      errores.push(`Encabezado vacío con datos debajo (columna ${colIndex + 1})`);
    }
  });

  return headers.map(td => td.textContent.trim()).filter(Boolean);
}

/**
 * Valida bloques de datos multianalito
 */
function checkBloquesMulti(rows, K, lecturas, encabezados, errores) {
  const columnasValidas = encabezados
    .map((h, i) => ({ nombre: h, idx: i + 1 }))
    .filter(c => c.nombre && !/nuevo/i.test(c.nombre));

  // Leer configuración UNA sola vez (fix del bug 3)
  const tipoDato = sessionStorage.getItem("tipoDato") || "cuantitativo";
  const valoresStr = sessionStorage.getItem("valoresPermitidos");
  const permitidos = valoresStr ? JSON.parse(valoresStr) : null;
  const config = { tipoDato, valoresPermitidos: permitidos };

  let filaActual = 1;

  for (let a = 0; a < K; a++) {
    const parametro = rows[filaActual]?.cells[0]?.textContent.trim() || `Parámetro ${a + 1}`;
    const lecturasEsperadas = lecturas[a] || lecturas[0] || 1;

    for (let r = 0; r < lecturasEsperadas; r++) {
      const tr = rows[filaActual + r];
      if (!tr) break;

      columnasValidas.forEach(col => {
        const td = tr.cells[col.idx];
        if (!td) return;

        const valor = td.textContent.trim();
        const celdaPos = `fila ${filaActual + r + 1}, columna ${col.idx + 1}`;

        if (valor === "") {
          errores.push(`Celda vacía no permitida dentro del rango (${parametro}, ${celdaPos})`);
          td.style.outline = "2px solid #ff0033";
          return;
        }

        const resultado = Utils.validateCellValue(valor, config);
        if (!resultado.valid) {
          errores.push(`Valor inválido (${parametro}, ${celdaPos}). ${resultado.error}`);
          td.style.outline = "2px solid #ff0033";
        } else {
          td.style.outline = "";
        }
      });
    }

    filaActual += lecturasEsperadas;
  }

  // Revisión de filas vacías completas
  const primeraFila = rows.findIndex(
    (r, i) => i > 0 && columnasValidas.some(c => (r.cells[c.idx]?.textContent.trim() || "") !== "")
  );
  const ultimaFila = [...rows].reverse().findIndex(
    r => columnasValidas.some(c => (r.cells[c.idx]?.textContent.trim() || "") !== "")
  );
  const ultimaFilaReal = rows.length - 1 - ultimaFila;

  if (primeraFila !== -1 && ultimaFilaReal > primeraFila) {
    for (let i = primeraFila; i <= ultimaFilaReal; i++) {
      const fila = rows[i];
      const todasVacias = columnasValidas.every(c => (fila.cells[c.idx]?.textContent.trim() || "") === "");
      if (todasVacias) {
        errores.push(`Fila ${i + 1} completamente vacía dentro del rango total.`);
        columnasValidas.forEach(c => {
          const td = fila.cells[c.idx];
          if (td) td.style.outline = "2px solid #ff0033";
        });
      }
    }
  }
}

/**
 * Valida filas fuera de rango multianalito
 */
function checkFilasFueraDeRangoMulti(rows, K, lecturas, errores) {
  const filasValidas = Utils.calcularFilasValidas(K, lecturas);

  for (let r = filasValidas + 1; r < rows.length; r++) {
    const fila = rows[r];
    const hayDatos = [...fila.cells].slice(1).some(td => td.textContent.trim() !== "");
    if (hayDatos) errores.push(`Datos fuera de rango en fila ${r + 1}`);
  }
}

// ============================================================
// CONSTRUCCIÓN DE ESTRUCTURAS DE DATOS
// ============================================================

/**
 * Construye estructura de datos monoanalito con soporte multi-nivel
 */
function buildMonoAnalitoData(rows, K, lecturas, nivel = 1) {
  const columnas = [...rows[0].cells].slice(0, K).map(td => td.textContent.trim());
  const registros = [];

  columnas.forEach((col, c) => {
    const filasEsperadas = lecturas[c] || lecturas[0] || 1;

    for (let r = 1; r <= filasEsperadas && r < rows.length; r++) {
      const valor = rows[r].cells[c]?.textContent.trim();
      if (!valor) continue;
      const num = Utils.parseNumericValue(valor);
      if (!isNaN(num)) {
        registros.push({
          parametro: col,
          analito: "Analito",
          nivel,
          lectura_idx: r,
          valor: num
        });
      }
    }
  });

  return {
    tipo: "mono",
    columnas,
    lecturas,
    lecturasPorColumna: lecturas,
    registros
  };
}

/**
 * Construye estructura de datos multianalito con soporte multi-nivel
 */
function buildMultiAnalitoData(rows, K, lecturas, encabezados, nivel = 1) {
  let filaActual = 1;
  const registros = [];

  for (let a = 0; a < K; a++) {
    const parametro = rows[filaActual]?.cells[0]?.textContent.trim() || `Parámetro ${a + 1}`;
    const lecturasActuales = lecturas[a] || lecturas[0] || 1;

    for (let li = 1; li <= lecturasActuales; li++) {
      const tr = rows[filaActual + li - 1];
      if (!tr) continue;
      encabezados.forEach((h, idx) => {
        const val = tr.cells[idx + 1]?.textContent.trim();
        if (!val) return;
        const num = Utils.parseNumericValue(val);
        if (!isNaN(num)) {
          registros.push({
            parametro,
            analito: h,
            nivel,
            lectura_idx: li,
            valor: num
          });
        }
      });
    }

    filaActual += lecturasActuales;
  }

  return { tipo: "multi", encabezados, lecturas, registros };
}

// ============================================================
// VALIDACIÓN MONOANALITO
// ============================================================

function validarMono(rows, errores, ctx = {}) {
  const K = parseInt(sessionStorage.getItem("K")) || 1;
  const lecturas = JSON.parse(sessionStorage.getItem("lecturasPorParametro") || "[]");
  const tipoDato = sessionStorage.getItem("tipoDato") || "cuantitativo";
  const valoresStr = sessionStorage.getItem("valoresPermitidos");
  const permitidos = valoresStr ? JSON.parse(valoresStr) : null;
  const config = { tipoDato, valoresPermitidos: permitidos };
  const nivel = ctx.nivel || 1;

  // Validar encabezados
  const headers = [...rows[0].cells];
  const nombres = headers.slice(0, K).map(td => td.textContent.trim());
  const duplicados = Utils.findDuplicates(nombres);
  if (duplicados.length > 0) {
    errores.push(`Encabezados duplicados: ${[...new Set(duplicados)].join(", ")}`);
  }

  headers.forEach((td, i) => {
    const valor = td.textContent.trim();
    const tieneDatos = rows.slice(1).some(r => (r.cells[i]?.textContent.trim() || "") !== "");
    if (i >= K && valor !== "") {
      errores.push(`Encabezado fuera de rango (columna ${i + 1}) no debe contener texto.`);
    } else if (!valor && tieneDatos) {
      errores.push(`Encabezado vacío con datos debajo (columna ${i + 1})`);
    }
  });

  // Validar lecturas
  for (let c = 0; c < K; c++) {
    const nombre = headers[c].textContent.trim() || `Columna ${c + 1}`;
    const filasEsperadas = lecturas[c] || lecturas[0] || 1;
    let lecturasValidas = 0;

    for (let r = 1; r < rows.length; r++) {
      const td = rows[r].cells[c];
      if (!td) continue;
      const valor = td.textContent.trim();
      if (!valor) continue;

      const dentroRango = r <= filasEsperadas;

      if (!dentroRango) {
        errores.push(`Dato fuera de rango en fila ${r + 1}, columna ${c + 1} (${nombre})`);
        continue;
      }

      const resultado = Utils.validateCellValue(valor, config);
      if (resultado.valid) {
        lecturasValidas++;
      } else {
        errores.push(`Valor inválido en fila ${r + 1}, columna ${c + 1} (${nombre}). ${resultado.error}`);
      }
    }

    if (lecturasValidas < filasEsperadas) {
      errores.push(`Faltan lecturas en ${nombre}: ${lecturasValidas}/${filasEsperadas}`);
    }
  }

  // Validar columnas extra
  for (let c = K; c < headers.length; c++) {
    const hayDatos = rows.slice(1).some(r => (r.cells[c]?.textContent.trim() || "") !== "");
    if (hayDatos) {
      errores.push(`Columna adicional (columna ${c + 1}) con datos no permitidos.`);
    }
  }

  if (errores.length === 0) {
    return buildMonoAnalitoData(rows, K, lecturas, nivel);
  }
}

// ============================================================
// VALIDACIÓN MULTIANALITO
// ============================================================

function validarMulti(rows, errores, ctx = {}) {
  const K = parseInt(sessionStorage.getItem("K")) || 1;
  const lecturas = JSON.parse(sessionStorage.getItem("lecturasPorParametro") || "[]");
  const nivel = ctx.nivel || 1;

  const encabezados = checkEncabezadosMulti(rows, errores);
  if (errores.length > 0) return;

  checkBloquesMulti(rows, K, lecturas, encabezados, errores);
  checkFilasFueraDeRangoMulti(rows, K, lecturas, errores);

  if (errores.length === 0) {
    return buildMultiAnalitoData(rows, K, lecturas, encabezados, nivel);
  }
}

// ============================================================
// VALIDACIÓN PRINCIPAL (MULTI-NIVEL CON SNAPSHOTS)
// ============================================================

function snapshotToRows(snap) {
  return snap.map(row => ({
    cells: row.map(val => ({ textContent: val ?? "", style: {} }))
  }));
}

function validarEstructuraYContenidoSnapshots(opts = {}) {
  const tipoAnalisis = sessionStorage.getItem("tipoAnalisis") || sessionStorage.getItem("modoAnalito") || "mono";
  const nivelesCount =
    opts.niveles ||
    (typeof window.niveles === "number" ? window.niveles : parseInt(sessionStorage.getItem("niveles")) || 1);

  const erroresTotales = [];
  const registros = [];
  const meta = {};
  const snapshotRef =
    (typeof window.snapshotPorNivel === "object" && window.snapshotPorNivel)
      ? window.snapshotPorNivel
      : null;
  let expectedHeaders = null;

  for (let nivel = 1; nivel <= nivelesCount; nivel++) {
    const snap = snapshotRef && snapshotRef[nivel];
    if (!snap || !snap.length) {
      erroresTotales.push(`[Nivel ${nivel}] No hay datos para validar.`);
      continue;
    }
    const rows = snapshotToRows(snap);
    const errores = [];

    if (tipoAnalisis === "multi" || tipoAnalisis === "multianalito") {
      const res = validarMulti(rows, errores, { nivel });
      if (!errores.length && res?.registros) {
        if (!expectedHeaders) {
          expectedHeaders = res.encabezados ? [...res.encabezados] : null;
        } else if (expectedHeaders && res.encabezados) {
          const sameLength = expectedHeaders.length === res.encabezados.length;
          const sameOrder = sameLength && expectedHeaders.every((h, idx) => h === res.encabezados[idx]);
          if (!sameLength || !sameOrder) {
            errores.push("Los analitos/encabezados no coinciden con el nivel 1.");
          }
        }
        if (errores.length) {
          erroresTotales.push(...errores.map(e => `[Nivel ${nivel}] ${e}`));
          continue;
        }
        registros.push(...res.registros);
        meta.encabezados = res.encabezados;
        meta.lecturas = res.lecturas;
      }
    } else {
      const res = validarMono(rows, errores, { nivel });
      if (!errores.length && res?.registros) {
        registros.push(...res.registros);
        meta.columnas = res.columnas;
        meta.lecturas = res.lecturas;
      }
    }

    if (errores.length) erroresTotales.push(...errores.map(e => `[Nivel ${nivel}] ${e}`));
  }

  if (erroresTotales.length > 0) {
    console.error("Errores detectados:", erroresTotales);
    return { errores: erroresTotales };
  }

  const payload = { tipo: tipoAnalisis, niveles: nivelesCount, registros, ...meta };
  const key = (tipoAnalisis === "multi" || tipoAnalisis === "multianalito") ? "multiAnalitoDatos" : "monoAnalitoDatos";
  sessionStorage.setItem(key, JSON.stringify(payload));
  notify("Datos validados correctamente en todos los niveles.", "success");
  return true;
}

// ============================================================
// GUARDADO DE DATAFRAME
// ============================================================

async function guardarDataframeTemp() {
  try {
    const session_id = sessionStorage.getItem("sessionID") || null;
    const tipo = sessionStorage.getItem("tipoAnalisis") || sessionStorage.getItem("modoAnalito") || "mono";
    const key = (tipo === "multi" || tipo === "multianalito") ? "multiAnalitoDatos" : "monoAnalitoDatos";
    const jsonStr = sessionStorage.getItem(key);
    const dataObj = JSON.parse(jsonStr);
    const registros = dataObj.registros || [];

    const datosParaInsertar = [];
    const unidad = sessionStorage.getItem("unidad") || null;
    const modo_cualitativo = sessionStorage.getItem("modoCualitativo") || null;
    const tipo_dato = sessionStorage.getItem("tipoDato") || "cuantitativo";
    const comentario = sessionStorage.getItem("comentario") || "Conforme";

    if (registros.length > 0) {
      registros.forEach(r => {
        datosParaInsertar.push({
          session_id,
          parametro: r.parametro,
          analito: r.analito ?? "Analito",
          nivel: r.nivel || 1,
          lectura_idx: r.lectura_idx,
          valor: r.valor,
          unidad,
          tipo_dato,
          modo_cualitativo,
          valido: 1,
          comentario,
        });
      });
    }

    // Limpiar datos anteriores
    const clear = await window.cerper.clearInputs(session_id, tipo);
    if (!clear?.ok) {
      notify(`No se pudo limpiar datos previos: ${clear?.error || 'desconocido'}`, "error");
      return clear;
    }

    // Invalidar resultados anteriores (ya no son válidos con datos nuevos)
    const clearRes = await window.cerper.clearResults(session_id);
    if (!clearRes?.ok) {
      console.warn(`[CerperStats] No se pudieron eliminar resultados previos: ${clearRes?.error || 'desconocido'}`);
    } else if (clearRes.deleted > 0) {
      console.log(`[CerperStats] ${clearRes.deleted} resultados anteriores invalidados.`);
      notify(`Se eliminaron ${clearRes.deleted} resultados anteriores. Ejecuta las pruebas nuevamente.`, "info");
    }

    const res = await window.cerper.insertInputs(session_id, tipo, datosParaInsertar);

    if (res.ok) {
      notify("Datos guardados en base de datos correctamente.", "success");
    } else {
      notify(`Error guardando datos: ${res.error}`, "error");
    }

    return res;

  } catch (e) {
    console.error(`[CerperStats] Excepción en guardarDataframeTemp:`, e);
    return { ok: false, error: e.message || String(e) };
  }
}

// ============================================================
// EXPORTS AL CONTEXTO GLOBAL
// ============================================================

if (typeof window !== "undefined") {
  window.validarVisual = validarVisual;
  window.validarEstructuraYContenido = validarEstructuraYContenidoSnapshots;
  window.guardarDataframeTemp = guardarDataframeTemp;
}

// Para uso en tests
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    validarVisual,
    validarMono,
    validarMulti,
    checkEncabezadosMulti,
    checkBloquesMulti,
    checkFilasFueraDeRangoMulti,
    buildMonoAnalitoData,
    buildMultiAnalitoData,
    validarEstructuraYContenidoSnapshots,
    guardarDataframeTemp
  };
}
