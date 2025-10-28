export const LAB_CONFIG = {
  "crom_gases": {
    tiposDisponibles: [
      { tipoDato: "cuantitativo" }
    ],
    placeholders: {
      metodo: "ASTM D1945",
      producto: "Gas natural seco",
      ensayo: "Composición de gases por cromatografía",
      expediente: "EXGA-00514-2025",
      unidad: "µg/L"
    }
  },

  "crom_liquida": {
    tiposDisponibles: [
      { tipoDato: "cuantitativo" }
    ],
    placeholders: {
      metodo: "EPA 8260D",
      producto: "Disolución acuosa",
      ensayo: "Determinación de compuestos orgánicos volátiles",
      expediente: "EXLI-02245-2025",
      unidad: "µg/L"
    }
  },

  "fisico_alimentos": {
    tiposDisponibles: [
      { tipoDato: "cuantitativo" }
    ],
    placeholders: {
      metodo: "AOAC 999.11",
      producto: "Leche evaporada",
      ensayo: "Determinación de plomo y cadmio",
      expediente: "EXAL-10345-2025",
      unidad: "mg/kg"
    }
  },

  "agricola": {
    tiposDisponibles: [
      { tipoDato: "cuantitativo" }
    ],
    placeholders: {
      metodo: "NTP 209.031",
      producto: "Uva de mesa",
      ensayo: "Determinación de residuos de pesticidas",
      expediente: "EXAG-08762-2025",
      unidad: "mg/kg"
    }
  },

  "microbiologia": {
    tiposDisponibles: [
      { tipoDato: "cuantitativo" },
      { tipoDato: "cualitativo", modo: "binario", valoresPermitidos: [0, 1] }
    ],
    placeholders: {
      metodo: "ISO 4833-1",
      producto: "Queso fresco",
      ensayo: "Recuento de mesófilos aerobios",
      expediente: "EXMI-01893-2025",
      unidad: "UFC/g"
    }
  },

  "ambiental": {
    tiposDisponibles: [
      { tipoDato: "cuantitativo" }
    ],
    placeholders: {
      metodo: "SM 2320 B",
      producto: "Muestra de suelo",
      ensayo: "Determinación de alcalinidad",
      expediente: "EXAM-07321-2025",
      unidad: "mg/L"
    }
  },

  "biomolecular": {
    tiposDisponibles: [
      { tipoDato: "cualitativo", modo: "binario", valoresPermitidos: [0, 1] }
    ],
    placeholders: {
      metodo: "RT-qPCR",
      producto: "Superficie ambiental",
      ensayo: "Detección de SARS-CoV-2",
      expediente: "EXMO-02415-2025",
      unidad: "N/A"
    }
  },

  "metales": {
    tiposDisponibles: [
      { tipoDato: "cuantitativo" }
    ],
    placeholders: {
      metodo: "EPA 200.7",
      producto: "Muestra líquida",
      ensayo: "Determinación de metales por ICP-OES",
      expediente: "EXME-09011-2025",
      unidad: "mg/L"
    }
  },

  "fisico_sensorial": {
    tiposDisponibles: [
      { tipoDato: "cuantitativo" },
      { tipoDato: "cualitativo", modo: "binario", valoresPermitidos: [0, 1] },
      { tipoDato: "cualitativo", modo: "puntaje", valoresPermitidos: [1, 3, 5, 7] }
    ],
    placeholders: {
      metodo: "NTP 209.100",
      producto: "Galletas dulces",
      ensayo: "Evaluación de color y textura",
      expediente: "EXFS-01015-2025",
      unidad: "N/A"
    }
  },

  "hidrobiología": {
    tiposDisponibles: [
      { tipoDato: "cuantitativo" },
      { tipoDato: "cualitativo", modo: "presencia / no presencia", valoresPermitidos: [0, 1] }
    ],
    placeholders: {
      metodo: "SM 10200 F",
      producto: "Agua de mar",
      ensayo: "Determinación de fitoplancton",
      expediente: "EXHI-04264-2025",
      unidad: "Organismos/m³"
    }
  }
};

