export const LAB_CONFIG = {
  "Cromatografía de Gases": {
    tiposDisponibles: [
      { tipoDato: "cuantitativo" }
    ]
  },
  "Cromatografía Líquida": {
    tiposDisponibles: [
      { tipoDato: "cuantitativo" }
    ]
  },
  "Físico Químico Alimentos": {
    tiposDisponibles: [
      { tipoDato: "cuantitativo" }
    ]
  },
  "Agrícola": {
    tiposDisponibles: [
      { tipoDato: "cuantitativo" }
    ]
  },
  "Microbiología": {
    tiposDisponibles: [
      { tipoDato: "cuantitativo" },            
      { tipoDato: "cualitativo", modo: "binario", valoresPermitidos: [0, 1] } 
    ]
  },
  "Ambiental": {
    tiposDisponibles: [
      { tipoDato: "cuantitativo" }
    ]
  },
  "Biología Molecular": {
    tiposDisponibles: [
      { tipoDato: "cualitativo", modo: "binario", valoresPermitidos: [0, 1] } 
    ]
  },
  "Metales": {
    tiposDisponibles: [
      { tipoDato: "cuantitativo" }
    ]
  },
  "Físico Sensorial": {
    tiposDisponibles: [
      { tipoDato: "cuantitativo" },   
      { tipoDato: "cualitativo", modo: "binario", valoresPermitidos: [0, 1] }, 
      { tipoDato: "cualitativo", modo: "puntaje", valoresPermitidos: [1, 3, 5, 7] } 
    ]
  },
  "Hidrobiología": {
    tiposDisponibles: [
      { tipoDato: "cuantitativo" },                                   
      { tipoDato: "cualitativo", modo: "binario", valoresPermitidos: [0, 1] } 
    ]
  }
};

