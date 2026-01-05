# modules/python/7/principal.py

"""
Evaluación de atípicos (monoanalito) — Z-Score clásico o robusto.

Reglas:
- Evaluar normalidad con Shapiro-Wilk (3 ≤ n ≤ 7) o Anderson-Darling (n > 7)
- Si es normal: Z-Score clásico = (x - media) / desviación_estándar
- Si NO es normal: Z-Score robusto = 0.6745 * (x - mediana) / MAD

Criterios:
- |Z| > 3 : Atípico (outlier)
- 2 < |Z| < 3 : Cuestionable
- No debe tener más de 2 datos cuestionables

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


# --- Procesar datos ---
rows = []
total_atipicos = 0
total_cuestionables = 0
metodo_usado = None

for col in df_ingreso.columns:
    serie = pd.to_numeric(df_ingreso[col], errors="coerce").dropna()
    n = len(serie)
    
    if n == 0:
        continue
    
    valores = serie.to_numpy(dtype=float)
    
    # Evaluar normalidad para decidir el método
    es_normal, p_value, prueba = evaluar_normalidad(valores)
    
    if es_normal is None:
        # No se puede evaluar normalidad (n < 3), usar robusto por defecto
        zscores = calcular_zscore_robusto(valores)
        metodo_usado = "Z-Score Robusto (n < 3)"
    elif es_normal:
        zscores = calcular_zscore_clasico(valores)
        metodo_usado = "Z-Score Clásico"
    else:
        zscores = calcular_zscore_robusto(valores)
        metodo_usado = "Z-Score Robusto"
    
    # Generar filas para cada lectura
    for i, zscore in enumerate(zscores, start=1):
        abs_z = abs(zscore)
        
        if abs_z > 3:
            total_atipicos += 1
        elif abs_z > 2:
            total_cuestionables += 1
        
        rows.append({
            "parametro": f"{col} - Lectura {i}",
            "zscore": round(float(zscore), 4),
        })

# --- Construir df_resultado ---
df_resultado = pd.DataFrame(rows)

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
