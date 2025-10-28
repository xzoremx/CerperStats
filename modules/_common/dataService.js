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
    const pattern = /^[A-Za-zÁÉÍÓÚáéíóúñÑ0-9\s\(\)\-\,\.]{3,80}$/;
    return pattern.test(metodo);
  },

  // --- Validar formato de producto ---
  validateProducto(producto) {
    const pattern = /^[A-Za-zÁÉÍÓÚáéíóúñÑ\s]{3,60}$/;
    return pattern.test(producto);
  },

  // --- Validar formato de ensayo ---
  validateEnsayo(ensayo) {
    const pattern = /^[A-Za-zÁÉÍÓÚáéíóúñÑ0-9\s\(\)\-\,\.]{4,80}$/;
    return pattern.test(ensayo);
  },

  // --- Validar formato de ensayo ---
  validateUnidad(valor) {
  return /^[a-zA-Zµ%/.\s-]+$/.test(valor) && valor.length >= 1 && valor.length <= 20;
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
