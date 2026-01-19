export const dataService = {
  // --- Obtener expedientes desde fuente local (por ahora)
  async getExpediente(code) {
    // Simulación local — luego será fetch() a tu API corporativa
    const mockDB = JSON.parse(localStorage.getItem("mockExpedientes") || "{}");
    return mockDB[code] || null;
  },

  // --- Guardar temporalmente los datos
  savePreinfo(data) {
    Object.entries(data).forEach(([key, value]) => {
      sessionStorage.setItem(key, value);
    });
    console.log("Preinfo guardada:", data);
  },

  // --- Validar formato de expediente 
  validateExpedienteFormat(code) {
    const regex = /^[A-Z]{4}-\d{5}-\d{4}(?:-\d{3})?$/;
    return regex.test(code.trim());
  },
  // --- Validar formato de expediente ---
  validateExpedienteFormat(expediente) {
    const pattern = /^(EX|OS|EM|HI|FS|AM|MO|MI|AG|LI|GA|ME)[A-Z]{0,2}-\d{4,6}-20\d{2}(-\d{3})?$/;
    return pattern.test(expediente);
  },

  // --- Validar formato de método ---
  validateMetodo(metodo) {
    // Acepta cualquier texto con al menos 3 caracteres
    return typeof metodo === "string" && metodo.trim().length >= 3;
  },

  // --- Validar formato de producto ---
  validateProducto(producto) {
    const pattern = /^[A-Za-zÁÉÍÓÚáéíóúñÑ\s]{3,60}$/;
    return pattern.test(producto);
  },

  // --- Validar formato de ensayo ---
  validateEnsayo(ensayo) {
    // Acepta cualquier texto con al menos 3 caracteres
    return typeof ensayo === "string" && ensayo.trim().length >= 3;
  },

  // --- Validar formato de unidad ---
  validateUnidad(valor) {
    // Permite letras, números, símbolos comunes de unidades (µ, %, /, ., -, espacios)
    // Ejemplos válidos: "g/100g", "%", "mg/L", "µg/mL", "g·kg⁻¹", etc.
    return /^[a-zA-Z0-9µ%/.\s-]+$/.test(valor) && valor.length >= 1 && valor.length <= 20;
  },



  

  // --- (futuro) Llamadas reales a la API
  async fetchFromAPI(endpoint, params = {}) {
    try {
      const url = new URL(`https://api.cerper.com/${endpoint}`);
      Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Error API ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error("Error al conectar con API:", err);
      return null;
    }
  },
};
