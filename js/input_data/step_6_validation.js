function validarEstructuraYContenido() {
  const tipoAnalisis = sessionStorage.getItem("tipoAnalisis") || "mono";
  const table = document.getElementById("excel");
  if (!table) return { errores: ["No se encontró la tabla de datos."] };

  const rows = [...table.rows];
  const errores = [];

  if (tipoAnalisis === "multi") {
    validarMulti(rows, errores);
  } else if (tipoAnalisis === "mono") {
    validarMono(rows, errores);
  } else {
    errores.push("Tipo de análisis no reconocido.");
  }

  // --- Resultado final ---
  if (errores.length > 0) {
    console.error("Errores detectados:", errores);
    return { errores };
  } else {
    notify("Datos validados correctamente.", "success");
    return true;
  }
}

// --- MULTIANALITO ---
function validarMulti(rows, errores) {
  const K = parseInt(sessionStorage.getItem("K")) || 1;
  const lecturas = JSON.parse(sessionStorage.getItem("lecturasPorParametro") || "[]");

  // Encabezados
  const encabezados = checkEncabezadosMulti(rows, errores);
  if (errores.length > 0) return;

  // Bloques de datos
  checkBloquesMulti(rows, K, lecturas, encabezados, errores);

  // Filas fuera de rango
  checkFilasFueraDeRangoMulti(rows, K, lecturas, errores);

  // Guardar estructura
  if (errores.length === 0) {
    const estructura = buildMultiAnalitoData(rows, K, lecturas, encabezados);
    sessionStorage.setItem("multiAnalitoDatos", JSON.stringify(estructura));
  }
}

// --- MONOANALITO ---
function validarMono(rows, errores) {
  const K = parseInt(sessionStorage.getItem("K")) || 1;
  const lecturas = JSON.parse(sessionStorage.getItem("lecturasPorParametro") || "[]");
  const tipoDato = sessionStorage.getItem("tipoDato") || "cuantitativo";
  const valoresStr = sessionStorage.getItem("valoresPermitidos");
  const permitidos = valoresStr ? JSON.parse(valoresStr) : null;
  const filasMax = Math.max(...lecturas);

  // --- Validar encabezados ---
  const headers = [...rows[0].cells];
  const nombres = headers.slice(0, K).map(td => td.textContent.trim());
  const duplicados = nombres.filter((v, i, a) => v && a.indexOf(v) !== i);
  if (duplicados.length > 0)
    errores.push(`Encabezados duplicados: ${[...new Set(duplicados)].join(", ")}`);

  headers.forEach((td, i) => {
    const valor = td.textContent.trim();
    const tieneDatos = rows.slice(1).some(r => (r.cells[i]?.textContent.trim() || "") !== "");
    if (i >= K && valor !== "")
      errores.push(`Encabezado fuera de rango (columna ${i + 1}) no debe contener texto.`);
    else if (!valor && tieneDatos)
      errores.push(`Encabezado vacío con datos debajo (columna ${i + 1})`);
  });

  // --- Validar lecturas numéricas o cualitativas según tipo ---
  for (let c = 0; c < K; c++) {
    const nombre = headers[c].textContent.trim() || `Columna ${c + 1}`;
    const filasEsperadas = lecturas[c] || lecturas[0] || 1;
    let lecturasValidas = 0;

    for (let r = 1; r < rows.length; r++) {
      const td = rows[r].cells[c];
      if (!td) continue;
      const valor = td.textContent.trim();
      if (!valor) continue;

      const num = parseFloat(valor.replace(",", "."));
      const dentroRango = r <= filasEsperadas;

      if (!dentroRango) {
        errores.push(`Dato fuera de rango en fila ${r + 1}, columna ${c + 1} (${nombre})`);
        continue;
      }

      // --- Validación diferenciada por tipo de dato ---
      if (tipoDato === "cuantitativo") {
        if (isNaN(num) || num <= 0)
          errores.push(`Valor inválido en fila ${r + 1}, columna ${c + 1} (${nombre}). Debe ser > 0`);
        else
          lecturasValidas++;
      }

      else if (tipoDato === "cualitativo") {
        const esEntero = Number.isInteger(num);
        if (!permitidos) {
          errores.push(`No hay valores permitidos definidos para el modo cualitativo.`);
          return;
        }
        if (!esEntero || !permitidos.includes(num))
          errores.push(`Valor inválido en fila ${r + 1}, columna ${c + 1} (${nombre}). Permitidos: ${permitidos.join(", ")}`);
        else
          lecturasValidas++;
      }
    }

    if (lecturasValidas < filasEsperadas)
      errores.push(`Faltan lecturas en ${nombre}: ${lecturasValidas}/${filasEsperadas}`);
  }

  // --- Validar columnas extra con datos ---
  for (let c = K; c < headers.length; c++) {
    const hayDatos = rows.slice(1).some(r => (r.cells[c]?.textContent.trim() || "") !== "");
    if (hayDatos)
      errores.push(`Columna adicional (columna ${c + 1}) con datos no permitidos.`);
  }

  // --- Construcción JSON ---
  if (errores.length === 0) {
    const estructura = buildMonoAnalitoData(rows, K, lecturas);
    sessionStorage.setItem("monoAnalitoDatos", JSON.stringify(estructura));
  }
}


// --- Estructura final ---
function buildMonoAnalitoData(rows, K, lecturas) {
  const columnas = [...rows[0].cells].slice(0, K).map(td => td.textContent.trim());
  const lecturasJSON = {};

  columnas.forEach((col, c) => {
    lecturasJSON[col] = [];
    const filasEsperadas = lecturas[c] || lecturas[0] || 1;

    for (let r = 1; r <= filasEsperadas && r < rows.length; r++) {
      const valor = rows[r].cells[c]?.textContent.trim();
      if (!valor) continue;
      const num = parseFloat(valor.replace(",", "."));
      if (!isNaN(num)) lecturasJSON[col].push(num);
    }
  });

  return {
    tipo: "mono",
    columnas,
    lecturasPorColumna: lecturas,
    filasTotales: rows.length - 1,
    lecturas: lecturasJSON
  };
}




// --- Multianalito: Encabezados ---
function checkEncabezadosMulti(rows, errores) {
  const headers = [...rows[0].cells].slice(1);
  const nombres = headers.map(td => td.textContent.trim()).filter(Boolean);
  const duplicados = nombres.filter((v, i, a) => a.indexOf(v) !== i);

  if (duplicados.length > 0)
    errores.push(`Encabezados duplicados: ${[...new Set(duplicados)].join(", ")}`);

  headers.forEach((td, i) => {
    const nombre = td.textContent.trim();
    const colIndex = i + 1;
    const tieneDatos = rows.slice(1).some(r => (r.cells[colIndex]?.textContent.trim() || "") !== "");
    if (!nombre && tieneDatos)
      errores.push(`Encabezado vacío con datos debajo (columna ${colIndex + 1})`);
  });

  return headers.map(td => td.textContent.trim()).filter(Boolean);
}


// --- Multianalito: Bloques de datos (rango dinámico según encabezados y tipo de análisis) ---
function checkBloquesMulti(rows, K, lecturas, encabezados, errores) {
  const columnasValidas = encabezados
    .map((h, i) => ({ nombre: h, idx: i + 1 }))
    .filter(c => c.nombre && !/nuevo/i.test(c.nombre));

  const tipoDato = sessionStorage.getItem("tipoDato") || "cuantitativo"; // cuanti o cuali
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

        // === 1) Celda vacía dentro del rango válido ===
        if (valor === "") {
          errores.push(`Celda vacía no permitida dentro del rango (${parametro}, ${celdaPos})`);
          td.style.outline = "2px solid #ff0033";
          return;
        }

        // === 2) Validaciones específicas según tipo de análisis ===
        const num = parseFloat(valor.replace(",", "."));

        if (isNaN(num)) {
          errores.push(`Valor no numérico en ${parametro}, ${celdaPos}`);
          td.style.outline = "2px solid #ff0033";
          return;
        }

        if (tipoDato === "cuantitativo") {
          // --- Cuantitativo: solo números reales mayores a 0 ---
          if (num <= 0) {
            errores.push(`Valor no permitido (${parametro}, ${celdaPos}). Debe ser > 0`);
            td.style.outline = "2px solid #ff0033";
          } else {
            td.style.outline = "";
          }
        }

        else if (tipoDato === "cualitativo") {
          // --- Cualitativo: solo valores enteros dentro del conjunto permitido ---
          const valoresStr = sessionStorage.getItem("valoresPermitidos");
          const permitidos = valoresStr ? JSON.parse(valoresStr) : null;

          const esEntero = Number.isInteger(num);

          if (!permitidos) {
            errores.push(`No hay valores permitidos definidos para este modo cualitativo.`);
            td.style.outline = "2px solid #ff0033";
          } else if (!esEntero || !permitidos.includes(num)) {
            errores.push(`Valor inválido (${parametro}, ${celdaPos}). Permitidos: ${permitidos.join(", ")}`);
            td.style.outline = "2px solid #ff0033";
          } else {
            td.style.outline = "";
          }
        }
      });
    }

    filaActual += lecturasEsperadas;
  }

  // === 3) Revisión global adicional: filas vacías completas entre la primera y última con datos ===
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




// ---Multianalito: Filas fuera de rango ---
function checkFilasFueraDeRangoMulti(rows, K, lecturas, errores) {
  let filasValidas = 0;
  for (let a = 0; a < K; a++) filasValidas += (lecturas[a] || lecturas[0] || 1);

  for (let r = filasValidas + 1; r < rows.length; r++) {
    const fila = rows[r];
    const hayDatos = [...fila.cells].slice(1).some(td => td.textContent.trim() !== "");
    if (hayDatos) errores.push(`Datos fuera de rango en fila ${r + 1}`);
  }
}


// ---Multianalito: Estructura final JSON ---
function buildMultiAnalitoData(rows, K, lecturas, encabezados) {
  let filaActual = 1;
  const parametros = [];
  const datosPorParametro = [];

  for (let a = 0; a < K; a++) {
    const parametro = rows[filaActual]?.cells[0]?.textContent.trim() || `Parámetro ${a + 1}`;
    const lecturasActuales = lecturas[a] || lecturas[0] || 1;
    const bloque = {};

    encabezados.forEach(h => bloque[h] = []);

    for (let r = 0; r < lecturasActuales; r++) {
      const tr = rows[filaActual + r];
      if (!tr) continue;
      const celdas = [...tr.cells].slice(1);
      celdas.forEach((td, idx) => {
        const valor = td.textContent.trim();
        if (!valor) return;
        const num = parseFloat(valor.replace(",", "."));
        if (!isNaN(num)) bloque[encabezados[idx]].push(num);
      });
    }

    parametros.push(parametro);
    datosPorParametro.push({ parametro, lecturas: bloque });
    filaActual += lecturasActuales;
  }

  return { tipo: "multi", encabezados, parametros, datosPorParametro };
}

// === Validaciones redefinidas para soporte multi-nivel (cuando hay paginación de niveles) ===
function validarMono(rows, errores, ctx = {}) {
  const K = parseInt(sessionStorage.getItem("K")) || 1;
  const lecturas = JSON.parse(sessionStorage.getItem("lecturasPorParametro") || "[]");
  const tipoDato = sessionStorage.getItem("tipoDato") || "cuantitativo";
  const valoresStr = sessionStorage.getItem("valoresPermitidos");
  const permitidos = valoresStr ? JSON.parse(valoresStr) : null;
  const nivel = ctx.nivel || 1;

  // --- Validar encabezados ---
  const headers = [...rows[0].cells];
  const nombres = headers.slice(0, K).map(td => td.textContent.trim());
  const duplicados = nombres.filter((v, i, a) => v && a.indexOf(v) !== i);
  if (duplicados.length > 0)
    errores.push(`Encabezados duplicados: ${[...new Set(duplicados)].join(", ")}`);

  headers.forEach((td, i) => {
    const valor = td.textContent.trim();
    const tieneDatos = rows.slice(1).some(r => (r.cells[i]?.textContent.trim() || "") !== "");
    if (i >= K && valor !== "")
      errores.push(`Encabezado fuera de rango (columna ${i + 1}) no debe contener texto.`);
    else if (!valor && tieneDatos)
      errores.push(`Encabezado vacío con datos debajo (columna ${i + 1})`);
  });

  // --- Validar lecturas numéricas o cualitativas según tipo ---
  for (let c = 0; c < K; c++) {
    const nombre = headers[c].textContent.trim() || `Columna ${c + 1}`;
    const filasEsperadas = lecturas[c] || lecturas[0] || 1;
    let lecturasValidas = 0;

    for (let r = 1; r < rows.length; r++) {
      const td = rows[r].cells[c];
      if (!td) continue;
      const valor = td.textContent.trim();
      if (!valor) continue;

      const num = parseFloat(valor.replace(",", "."));
      const dentroRango = r <= filasEsperadas;

      if (!dentroRango) {
        errores.push(`Dato fuera de rango en fila ${r + 1}, columna ${c + 1} (${nombre})`);
        continue;
      }

      if (tipoDato === "cuantitativo") {
        if (isNaN(num) || num <= 0)
          errores.push(`Valor inválido en fila ${r + 1}, columna ${c + 1} (${nombre}). Debe ser > 0`);
        else
          lecturasValidas++;
      } else if (tipoDato === "cualitativo") {
        const esEntero = Number.isInteger(num);
        if (!permitidos) {
          errores.push(`No hay valores permitidos definidos para el modo cualitativo.`);
          return;
        }
        if (!esEntero || !permitidos.includes(num))
          errores.push(`Valor inválido en fila ${r + 1}, columna ${c + 1} (${nombre}). Permitidos: ${permitidos.join(", ")}`);
        else
          lecturasValidas++;
      }
    }

    if (lecturasValidas < filasEsperadas)
      errores.push(`Faltan lecturas en ${nombre}: ${lecturasValidas}/${filasEsperadas}`);
  }

  // --- Validar columnas extra con datos ---
  for (let c = K; c < headers.length; c++) {
    const hayDatos = rows.slice(1).some(r => (r.cells[c]?.textContent.trim() || "") !== "");
    if (hayDatos)
      errores.push(`Columna adicional (columna ${c + 1}) con datos no permitidos.`);
  }

  if (errores.length === 0) {
    return buildMonoAnalitoData(rows, K, lecturas, nivel);
  }
}

function validarMulti(rows, errores, ctx = {}) {
  const K = parseInt(sessionStorage.getItem("K")) || 1;
  const lecturas = JSON.parse(sessionStorage.getItem("lecturasPorParametro") || "[]");
  const nivel = ctx.nivel || 1;

  // Encabezados
  const encabezados = checkEncabezadosMulti(rows, errores);
  if (errores.length > 0) return;

  // Bloques de datos
  checkBloquesMulti(rows, K, lecturas, encabezados, errores);

  // Filas fuera de rango
  checkFilasFueraDeRangoMulti(rows, K, lecturas, errores);

  if (errores.length === 0) {
    return buildMultiAnalitoData(rows, K, lecturas, encabezados, nivel);
  }
}

// --- Estructuras con nivel incluido ---
function buildMonoAnalitoData(rows, K, lecturas, nivel = 1) {
  const columnas = [...rows[0].cells].slice(0, K).map(td => td.textContent.trim());
  const registros = [];

  columnas.forEach((col, c) => {
    const filasEsperadas = lecturas[c] || lecturas[0] || 1;

    for (let r = 1; r <= filasEsperadas && r < rows.length; r++) {
      const valor = rows[r].cells[c]?.textContent.trim();
      if (!valor) continue;
      const num = parseFloat(valor.replace(",", "."));
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
    lecturasPorColumna: lecturas,
    registros
  };
}

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
        const num = parseFloat(val.replace(",", "."));
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

// === Versión multi-nivel de validación (redefine para usar snapshots/páginas) ===
function validarEstructuraYContenido(opts = {}) {
  const tipoAnalisis = sessionStorage.getItem("tipoAnalisis") || "mono";
  const nivelesCount =
    opts.niveles ||
    (typeof window.niveles === "number" ? window.niveles : parseInt(sessionStorage.getItem("niveles")) || 1);

  const erroresTotales = [];
  const registros = [];
  const meta = {};

  // Backup de snapshots para no corromper otras páginas durante la validación
  const snapshotRef = (typeof window.snapshotPorNivel === "object" && window.snapshotPorNivel) ? window.snapshotPorNivel : null;
  const snapshotBackup = snapshotRef ? JSON.parse(JSON.stringify(snapshotRef)) : null;

  const paginaOriginal = typeof window.paginaActual === "number" ? window.paginaActual : 1;
  if (typeof window.guardarSnapshot === "function") window.guardarSnapshot(paginaOriginal);

  for (let nivel = 1; nivel <= nivelesCount; nivel++) {
    if (typeof window.restaurarPagina === "function") window.restaurarPagina(nivel);

    const table = document.getElementById("excel");
    if (!table) return { errores: ["No se encontró la tabla de datos."] };

    const rows = [...table.rows];
    const errores = [];

    if (tipoAnalisis === "multi") {
      const res = validarMulti(rows, errores, { nivel });
      if (!errores.length && res?.registros) {
        registros.push(...res.registros);
        meta.encabezados = res.encabezados;
        meta.lecturas = res.lecturas;
      }
    } else if (tipoAnalisis === "mono") {
      const res = validarMono(rows, errores, { nivel });
      if (!errores.length && res?.registros) {
        registros.push(...res.registros);
        meta.columnas = res.columnas;
        meta.lecturas = res.lecturas;
      }
    } else {
      errores.push("Tipo de análisis no reconocido.");
    }

    if (errores.length) erroresTotales.push(...errores.map(e => `[Nivel ${nivel}] ${e}`));
  }

  if (typeof window.restaurarPagina === "function") window.restaurarPagina(paginaOriginal);

  if (snapshotRef && snapshotBackup) {
    Object.keys(snapshotRef).forEach(k => delete snapshotRef[k]);
    Object.entries(snapshotBackup).forEach(([k, v]) => {
      snapshotRef[k] = v;
    });
  }

  if (erroresTotales.length > 0) {
    console.error("Errores detectados:", erroresTotales);
    return { errores: erroresTotales };
  }

  const payload = { tipo: tipoAnalisis, niveles: nivelesCount, registros, ...meta };
  const key = tipoAnalisis === "multi" ? "multiAnalitoDatos" : "monoAnalitoDatos";
  sessionStorage.setItem(key, JSON.stringify(payload));
  notify("Datos validados correctamente en todos los niveles.", "success");
  return true;
}

// --- Exponer funciones al contexto global ---
window.validarEstructuraYContenido = validarEstructuraYContenido;
window.guardarDataframeTemp = guardarDataframeTemp;

// --- Validación alternativa usando snapshots por nivel (evita tocar el DOM y mezclar páginas) ---
function validarEstructuraYContenidoSnapshots(opts = {}) {
  const tipoAnalisis = sessionStorage.getItem("tipoAnalisis") || "mono";
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

  for (let nivel = 1; nivel <= nivelesCount; nivel++) {
    const snap = snapshotRef && snapshotRef[nivel];
    if (!snap || !snap.length) {
      erroresTotales.push(`[Nivel ${nivel}] No hay datos para validar.`);
      continue;
    }
    const rows = snapshotToRows(snap);
    const errores = [];

    if (tipoAnalisis === "multi") {
      const res = validarMulti(rows, errores, { nivel });
      if (!errores.length && res?.registros) {
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
  const key = tipoAnalisis === "multi" ? "multiAnalitoDatos" : "monoAnalitoDatos";
  sessionStorage.setItem(key, JSON.stringify(payload));
  notify("Datos validados correctamente en todos los niveles.", "success");
  return true;
}

function snapshotToRows(snap) {
  return snap.map(row => ({
    cells: row.map(val => ({ textContent: val ?? "", style: {} }))
  }));
}

// Reasignar export a la versión que usa snapshots para evitar mezcla entre páginas
window.validarEstructuraYContenido = validarEstructuraYContenidoSnapshots;


// === Guardado de DataFrame temporal ===
async function guardarDataframeTemp() {
  try {
    const session_id = sessionStorage.getItem("sessionID") || null;
    const tipo = sessionStorage.getItem("tipoAnalisis") || "mono";
    const key = (tipo === "multi") ? "multiAnalitoDatos" : "monoAnalitoDatos";
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
    } else if (tipo === "mono") {
      // Fallback para estructura antigua (sin niveles)
      dataObj.columnas.forEach((parametro) => {
        const lects = dataObj.lecturas[parametro] || [];
        lects.forEach((v, idx) => {
          datosParaInsertar.push({
            session_id,
            analito: "Analito",
            parametro,
            nivel: 1,
            lectura_idx: idx + 1,
            valor: v,
            unidad,
            tipo_dato,
            modo_cualitativo,
            valido: 1,
            comentario,
          });
        });
      });
    } else if (tipo === "multi") {
      dataObj.datosPorParametro.forEach(bloque => {
        const parametro = bloque.parametro;

        for (const [analito, lects] of Object.entries(bloque.lecturas)) {
          lects.forEach((v, idx) => {
            datosParaInsertar.push({
              session_id,
              analito,
              parametro,
              nivel: 1,
              lectura_idx: idx + 1,
              valor: v,
              unidad,
              tipo_dato,
              modo_cualitativo,
              valido: 1,
              comentario,
            });
          });
        }
      });
    }

    // Limpiar datos anteriores de esta sesión antes de insertar (comportamiento de actualización)
    const clear = await window.cerper.clearInputs(session_id, tipo);
    if (!clear?.ok) {
      notify(`No se pudo limpiar datos previos: ${clear?.error || 'desconocido'}`, "error");
      return clear;
    }

    const res = await window.cerper.insertInputs(session_id, tipo, datosParaInsertar);

    if (res.ok)
      notify("Datos guardados en base de datos correctamente.", "success");
    else
      notify(`Error guardando datos: ${res.error}`, "error");

    return res; 

  } catch (e) {
    console.error(`[CerperStats] Excepción en guardarDataframeTemp:`, e);
    return { ok: false, error: e.message || String(e) };
  }
};
