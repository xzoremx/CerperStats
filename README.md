# CerperStats  
**Sistema de Evaluación Estadística de Laboratorios CERPER**

---

## Descripción

**CerperStats** es una aplicación desarrollada en **Electron + HTML + JavaScript** (con integración futura a Python) para la **gestión, validación y análisis estadístico** de datos experimentales generados por los laboratorios de **CERPER**.

El sistema permite:

- Ingresar lecturas analíticas individuales o múltiples.  
- Ejecutar pruebas estadísticas de **normalidad, dispersión y veracidad**.  
- Validar estructuras de datos por laboratorio.  
- Generar informes **PDF y JSON** con resultados, gráficas y conclusiones.  

---

## Flujo general de uso

1. **Selección de laboratorio**  
   El usuario elige su laboratorio (ej. *Microbiología*).  
   La elección se guarda localmente para futuros usos.

2. **Selección del procedimiento**  
   *(Autorizaciones, Implementaciones, Intralaboratorios, Interlab, etc.)*

3. **Ingreso de metadatos**  
   - Método  
   - Producto  
   - Ensayo  
   - Fecha  
   - Participantes  
   - Expediente  

4. **Ingreso de lecturas**  
   Interfaz tipo hoja de cálculo (monoanalito o multianalito).  
   Validación automática de estructura y tipo de dato.

5. **Selección de evaluaciones estadísticas**  
   El usuario elige las pruebas a aplicar  
   *(normalidad, dispersión, tendencia central, veracidad, etc.)*.  
   El sistema ejecuta los módulos correspondientes al laboratorio seleccionado.

6. **Generación de informe PDF**  
   Se genera automáticamente un **informe PDF** (y archivos JSON de respaldo) en  
   `/results/[LABORATORIO]/pdf/`.

---

## Estructura principal del proyecto

```plaintext
CerperStats/
│
├── index.html                 # Página inicial / redirección
├── menu.html                  # Menú principal (laboratorios y navegación)
├── procedure_select.html       # Selección de tipo de procedimiento
├── evaluation_select.html      # Selección de pruebas estadísticas
├── report_info.html            # Resumen final e información del informe
│
├── main.js                    # Proceso principal de Electron
├── preload.js                 # Comunicación segura entre front y back
├── renderer.js                # Lógica del lado del renderizador
│
├── package.json               # Configuración de Electron y dependencias
├── manifest.json              # Metadatos de app
├── README.md                  # Documentación general del proyecto
│
├── assets/                    # Recursos gráficos
│   ├── animations/             # GIFs animados (normalidad, precisión, etc.)
│   ├── icons/                  # Íconos UI
│   └── logos/                  # Logos institucionales CERPER
│
├── css/                       # Hojas de estilo
│   ├── global.css
│   ├── menu.css
│   ├── procedure_select.css
│   ├── evaluation_select.css
│   ├── report_info.css
│   └── input_data.css
│
├── js/                        # Scripts de cada sección
│   ├── menu.js
│   ├── procedure_select.js
│   ├── evaluation_select.js
│   ├── report_info.js
│   └── input_data/
│       ├── flow.js
│       ├── storage.js
│       ├── ui_helpers.js
│       └── validator.js
│
├── input_data/                # Formularios paso a paso de ingreso de datos
│   ├── index.html
│   ├── step_data.html
│   ├── step_parametro.html
│   ├── step_type.html
│   └── step_mode.html
│
├── modules/                   # Módulos por laboratorio (submódulos JS/Python)
│   ├── Agrícola/
│   ├── Ambiental/
│   ├── Biología Molecular/
│   ├── Cromatografía de Gases/
│   ├── Cromatografía Líquida/
│   ├── Físico Químico Alimentos/
│   ├── Físico Sensorial/
│   ├── Hidrobiología/
│   ├── Metales/
│   └── Microbiología/
│
└── results/                   # Salidas generadas por el sistema
    ├── [LABORATORIO]/json/    # Resultados analíticos en formato JSON
    └── [LABORATORIO]/pdf/     # Informes generados en PDF

