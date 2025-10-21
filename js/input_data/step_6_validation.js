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

  // --- Validar lecturas numéricas y cantidad esperada ---
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

      if (isNaN(num) || num <= 0)
        errores.push(`Valor inválido en fila ${r + 1}, columna ${c + 1} (${nombre})`);
      else lecturasValidas++;
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


// ---Multianalito: Bloques de datos ---
function checkBloquesMulti(rows, K, lecturas, encabezados, errores) {
  let filaActual = 1;
  for (let a = 0; a < K; a++) {
    const parametro = rows[filaActual]?.cells[0]?.textContent.trim() || `Parámetro ${a + 1}`;
    const lecturasEsperadas = lecturas[a] || lecturas[0] || 1;

    for (let r = 0; r < lecturasEsperadas; r++) {
      const tr = rows[filaActual + r];
      if (!tr) break;
      const celdas = [...tr.cells].slice(1);
      celdas.forEach((td, idx) => {
        const valor = td.textContent.trim();
        if (!valor) return;
        const num = parseFloat(valor.replace(",", "."));
        if (isNaN(num) || num <= 0)
          errores.push(`Valor inválido en ${parametro}, fila ${filaActual + r + 1}, columna ${idx + 2}`);
      });
    }

    filaActual += lecturasEsperadas;
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

// --- Exponer funciones al contexto global ---
window.validarEstructuraYContenido = validarEstructuraYContenido;

// === Guardado de DataFrame temporal ===
window.guardarDataframeTemp = async function guardarDataframeTemp() {
  try {
    const tipo = sessionStorage.getItem("tipoAnalisis") || "mono";
    const key = (tipo === "multi") ? "multiAnalitoDatos" : "monoAnalitoDatos";
    const jsonStr = sessionStorage.getItem(key);
    const lab = sessionStorage.getItem("labSeleccionado") || "Cromatografía de Gases";

    console.log(`[CerperStats] Intentando guardar DataFrame temporal...`);
    console.log(`[CerperStats] Laboratorio: ${lab}`);
    console.log(`[CerperStats] Tipo de análisis: ${tipo}`);
    console.log(`[CerperStats] Longitud del JSON: ${jsonStr?.length || 0}`);

    // --- Validaciones previas ---
    if (!jsonStr || jsonStr.trim() === "") {
      const msg = "No hay datos validados en sessionStorage.";
      console.error(`[CerperStats] ${msg}`);
      return { ok: false, error: msg };
    }

    if (!window.cerper || !window.cerper.saveDataframeTemp) {
      const msg = "API cerper.saveDataframeTemp no disponible (preload no cargado).";
      console.error(`[CerperStats] ${msg}`);
      return { ok: false, error: msg };
    }

    // --- Llamada al proceso Python vía IPC ---
    console.log(`[CerperStats] Ejecutando IPC → save-dataframe-temp`);
    const res = await window.cerper.saveDataframeTemp(lab, jsonStr);

    // --- Logs y retorno ---
    if (res && res.ok) {
      console.log(`[CerperStats] DataFrame guardado correctamente.`);
      console.log(`[CerperStats] Ruta de salida: ${res.output_dir || "(sin ruta)"}`);
    } else {
      console.error(`[CerperStats] Error guardando DataFrame:`, res);
    }

    return res;
  } catch (e) {
    console.error(`[CerperStats] Excepción en guardarDataframeTemp:`, e);
    return { ok: false, error: e.message || String(e) };
  }
};
