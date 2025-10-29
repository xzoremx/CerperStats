// input_data/step_3_dato.js

document.addEventListener("DOMContentLoaded", async () => {
  // --- Recuperar laboratorio (clave y nombre visible) ---
  const labKey =
    sessionStorage.getItem("labSeleccionado") ||
    localStorage.getItem("labSeleccionado");
  const labName =
    sessionStorage.getItem("labNombreVisible") || labKey || "Laboratorio";

  const title = document.getElementById("lab-title");
  const main = document.getElementById("main-container");

// --- Obtener configuración del laboratorio desde la base ---
let tipos = [];
try {
  const res = await window.cerper.getLabModules(labKey);
  if (res?.ok && Array.isArray(res.data)) {
    tipos = res.data.map(row => {
      const tipoDato = (row.tipo_dato || "").toString().trim();
      const modo =
        (row.modo ?? row.modo_cualitativo ?? "")
          .toString()
          .trim() || null; // acepta alias "modo" o el nombre original
      const valoresPermitidos =
        (row.valores_permitidos ?? null);

      return { tipoDato, modo, valoresPermitidos };
    });

    // Debug opcional:
    console.log("[S3] filas BD:", res.data);
    console.log("[S3] tipos mapeados:", tipos);
  }
} catch (err) {
  console.error("[CerperStats] Error leyendo módulos:", err);
}


  // --- Título ---
  title.textContent = `${labName} - Tipo de Dato`;

  // --- Validar configuración ---
  if (!tipos || tipos.length === 0) {
    sessionStorage.setItem("tipoDato", "cuantitativo");
    avanzarPaso();
    return;
  }

  // --- Si solo hay un tipo, guardar y continuar ---
  if (tipos.length === 1) {
    const unico = tipos[0];
    sessionStorage.setItem("tipoDato", unico.tipoDato);

    // Guardar modo si existe, limpiar si no
    if (unico.modo) {
      sessionStorage.setItem("modoCualitativo", unico.modo);
    } else {
      sessionStorage.removeItem("modoCualitativo");
    }

    // Guardar valores permitidos (con parseo seguro)
    if (unico.valoresPermitidos) {
      let vals = unico.valoresPermitidos;
      try {
        vals = typeof vals === "string" ? JSON.parse(vals.replace(/'/g, '"')) : vals;
      } catch {
        vals = vals.split(",").map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
      }
      sessionStorage.setItem("valoresPermitidos", JSON.stringify(vals));
    } else {
      sessionStorage.removeItem("valoresPermitidos");
    }

    avanzarPaso();
    return;
  }


  // --- Si hay varios tipos (cuantitativo + cualitativo) ---
  const container = document.createElement("div");
  container.className = "form-block";

  const msg = document.createElement("h3");
  msg.textContent = "Seleccione el tipo de dato:";
  container.appendChild(msg);

  tipos.forEach(tipo => {
    const btn = document.createElement("button");
    btn.className = "select-btn";
    btn.dataset.tipo = tipo.tipoDato;

    if (tipo.tipoDato === "cuantitativo") {
      btn.textContent = "Cuantitativo";
    } else {
      if (tipo.modo) {
        const modoTexto = tipo.modo.charAt(0).toUpperCase() + tipo.modo.slice(1);
        btn.textContent = `Cualitativo - ${modoTexto}`;
      } else {
        btn.textContent = "Cualitativo";
      }
    }


    btn.addEventListener("click", () => {
      sessionStorage.setItem("tipoDato", tipo.tipoDato);

      if (tipo.tipoDato === "cualitativo") {
        sessionStorage.setItem("modoCualitativo", tipo.modo);

        if (tipo.valoresPermitidos) {
          let vals = tipo.valoresPermitidos;
          try {
            vals = typeof vals === "string" ? JSON.parse(vals.replace(/'/g, '"')) : vals;
          } catch {
            vals = vals.split(",").map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
          }
          sessionStorage.setItem("valoresPermitidos", JSON.stringify(vals));
        }

        avanzarPaso();
      } else {
        avanzarPaso();
      }
    });


    container.appendChild(btn);
  });

  main.appendChild(container);

  // --- Botón Volver ---
  document.getElementById("go-back").addEventListener("click", () => {
    if (window.cerper?.openPage)
      window.cerper.openPage("input_data/step_2_parametro.html");
    else
      window.location.href = "step_2_parametro.html";
  });
});

// --- Selector secundario para modo cualitativo ---
function mostrarSelectorDeModo(modos) {
  const main = document.getElementById("main-container");
  main.innerHTML = "";

  const title = document.createElement("h3");
  title.textContent = "Seleccione el modo cualitativo:";
  main.appendChild(title);

  modos.forEach(m => {
    const btn = document.createElement("button");
    btn.className = "select-btn";
    btn.textContent = `Modo ${m.modo}`;
    btn.addEventListener("click", () => {
      sessionStorage.setItem("tipoDato", "cualitativo");
      sessionStorage.setItem("modoCualitativo", m.modo);
      if (m.valoresPermitidos)
        sessionStorage.setItem("valoresPermitidos", JSON.stringify(m.valoresPermitidos));
      avanzarPaso();
    });
    main.appendChild(btn);
  });
}

// --- Avanzar al siguiente paso ---
function avanzarPaso() {
  if (window.cerper?.openPage)
    window.cerper.openPage("input_data/step_4_k.html");
  else
    window.location.href = "step_4_k.html";
}
