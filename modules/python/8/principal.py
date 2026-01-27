# modules/python/8/principal.py

"""
Evaluación de atípicos (multianalito) — Z-Score clásico o robusto.

Este script recibe datos ya filtrados por analito y nivel desde el servidor.
La estructura de df_ingreso es la misma que para monoanalito:
- Columnas = parámetros (ej: Analista 1, Analista 2, etc.)
- Filas = lecturas

Variable adicional disponible: `total_analitos` (cantidad total de analitos en la sesión)

Reglas:
- Evaluar normalidad con Shapiro-Wilk (3 ≤ n ≤ 7) o Anderson-Darling (n > 7)
- Si es normal: Z-Score clásico = (x - media) / desviación_estándar
- Si NO es normal: Z-Score robusto = 0.6745 * (x - mediana) / MAD

Criterios:
- |Z| > 3 : Atípico (outlier)
- 2 < |Z| < 3 : Cuestionable
- No debe tener más de 2 datos cuestionables por analito y nivel

Campos de salida en df_resultado:
- parametro: "Analista X - Lectura Y"
- zscore: valor del Z-score calculado
"""

import numpy as np
from scipy import stats as sps
from statsmodels.stats.diagnostic import normal_ad

# --- Validación del entorno ---
if "pd" not in globals() or pd is None:
    raise RuntimeError("pandas requerido no disponible")

if "df_ingreso" not in globals():
    raise RuntimeError("df_ingreso requerido no disponible")

# Obtener total_analitos si está disponible (para multianalito)
n_analitos = globals().get("total_analitos", 1)


def evaluar_normalidad(valores):
    """Evalúa normalidad según el tamaño de muestra."""
    n = len(valores)
    if n < 3:
        return None, None, None  # No evaluable
    
    if 3 <= n <= 7:
        prueba = "Shapiro-Wilk"
        stat, p = sps.shapiro(valores)
    else:
        prueba = "Anderson-Darling"
        stat, p = normal_ad(valores)
    
    es_normal = p >= 0.05
    return es_normal, p, prueba


def calcular_zscore_clasico(valores):
    """Calcula Z-score clásico: (x - media) / desv_std"""
    media = np.mean(valores)
    desv = np.std(valores, ddof=1)
    if desv == 0:
        return np.zeros_like(valores)
    return (valores - media) / desv


def calcular_zscore_robusto(valores):
    """Calcula Z-score robusto: 0.6745 * (x - mediana) / MAD"""
    mediana = np.median(valores)
    mad = np.median(np.abs(valores - mediana))
    if mad == 0:
        return np.zeros_like(valores)
    return 0.6745 * (valores - mediana) / mad


# --- Recolectar TODOS los datos para calcular media y DS global ---
all_values = []
col_data = []  # Guardar (columna, valores) para iterar después

for col in df_ingreso.columns:
    serie = pd.to_numeric(df_ingreso[col], errors="coerce").dropna()
    if len(serie) == 0:
        continue
    valores = serie.to_numpy(dtype=float)
    col_data.append((col, valores))
    all_values.extend(valores.tolist())

# Convertir a array para cálculos globales
all_values = np.array(all_values, dtype=float)

# Evaluar normalidad con TODOS los datos combinados
es_normal, p_value, prueba = evaluar_normalidad(all_values)

# Calcular media y DS global (como en Excel con todos los datos)
if es_normal is None:
    metodo_usado = "Z-Score Robusto (n < 3)"
    mediana_global = np.median(all_values)
    mad_global = np.median(np.abs(all_values - mediana_global))
elif es_normal:
    metodo_usado = "Z-Score Clásico"
    media_global = np.mean(all_values)
    ds_global = np.std(all_values, ddof=1)  # DESVEST() de Excel
else:
    metodo_usado = "Z-Score Robusto"
    mediana_global = np.median(all_values)
    mad_global = np.median(np.abs(all_values - mediana_global))

# --- Procesar datos usando estadísticos globales ---
rows = []
total_atipicos = 0
total_cuestionables = 0

for col, valores in col_data:
    # Calcular Z-scores usando estadísticos GLOBALES
    if es_normal is None or not es_normal:
        # Z-Score robusto con mediana y MAD globales
        if mad_global == 0:
            zscores = np.zeros_like(valores)
        else:
            zscores = 0.6745 * (valores - mediana_global) / mad_global
    else:
        # Z-Score clásico con media y DS globales
        if ds_global == 0:
            zscores = np.zeros_like(valores)
        else:
            zscores = (valores - media_global) / ds_global

    # Generar filas para cada lectura
    for i, zscore in enumerate(zscores, start=1):
        abs_z = abs(zscore)

        # Determinar estado basado en |Z|
        if abs_z > 3:
            estado = "atipico_outlier"
            total_atipicos += 1
        elif abs_z > 2:
            estado = "cuestionable_outlier"
            total_cuestionables += 1
        else:
            estado = "aceptable_outlier"

        rows.append({
            "parametro": f"{col} - Lectura {i}",
            "zscore": round(float(zscore), 4),
            "estado": estado,
        })

# --- Construir df_resultado ---
df_resultado = pd.DataFrame(rows)

# Agregar columna "analito" si es multianalito (current_analito disponible)
_current_analito = globals().get("current_analito")
if _current_analito is not None:
    df_resultado.insert(0, "analito", _current_analito)

# --- Generar conclusión ---
if total_atipicos == 0 and total_cuestionables <= 2:
    conclusion = (
        f"No se encontraron datos atípicos. "
        f"Datos cuestionables: {total_cuestionables}. "
        f"Método: {metodo_usado}."
    )
    conclusion_status = "success"
elif total_atipicos == 0 and total_cuestionables > 2:
    conclusion = (
        f"No se encontraron datos atípicos, pero se tienen {total_cuestionables} datos cuestionables "
        f"(más de 2 permitidos). Método: {metodo_usado}."
    )
    conclusion_status = "danger"
else:
    conclusion = (
        f"Se encontraron {total_atipicos} dato(s) atípico(s) (|Z| > 3). "
        f"Datos cuestionables: {total_cuestionables}. "
        f"Método: {metodo_usado}."
    )
    conclusion_status = "danger"

# --- Información diagnóstica para el gráfico cuando hay danger ---
if conclusion_status == "danger":
    if es_normal is not None and es_normal:
        centro = float(media_global)
        disp = float(ds_global)
        factor = disp
    else:
        centro = float(mediana_global)
        disp = float(mad_global)
        factor = disp / 0.6745 if disp > 0 else 0

    rango_aceptable = (round(centro - 2 * factor, 4), round(centro + 2 * factor, 4))
    rango_cuestionable_bajo = (round(centro - 3 * factor, 4), round(centro - 2 * factor, 4))
    rango_cuestionable_alto = (round(centro + 2 * factor, 4), round(centro + 3 * factor, 4))

    datos_problematicos = []
    for r in rows:
        if r["estado"] in ("atipico_outlier", "cuestionable_outlier"):
            datos_problematicos.append({
                "parametro": r["parametro"],
                "zscore": r["zscore"],
                "estado": r["estado"],
            })

    danger_info = {
        "metodo": metodo_usado,
        "centro": round(centro, 4),
        "dispersion": round(disp, 4),
        "rango_aceptable": rango_aceptable,
        "rango_cuestionable_bajo": rango_cuestionable_bajo,
        "rango_cuestionable_alto": rango_cuestionable_alto,
        "datos_problematicos": datos_problematicos,
    }
