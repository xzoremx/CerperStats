# modules/python/12/principal.py

"""
Evaluación de tendencia central por parámetro (multianalito) — Rango porcentual.

Este script recibe datos ya filtrados por analito y nivel desde el servidor.
La estructura de df_ingreso es la misma que para monoanalito:
- Columnas = parámetros (ej: Analista 1, Analista 2, etc.)
- Filas = lecturas

Variable adicional disponible: `total_analitos` (cantidad total de analitos en la sesión)

Reglas:
- Evaluar normalidad global con Shapiro-Wilk (3 ≤ n ≤ 7) o Anderson-Darling (n > 7)
- Si es normal: usar media global y media por parámetro
- Si NO es normal: usar mediana global y mediana por parámetro
- Verificar que cada parámetro esté dentro del rango porcentual de la tendencia central global

Campos de salida en df_resultado:
- analito (si aplica)
- parametro, n, metodo_tendencia, tendencia_central
- tc_global, porcentaje_min, porcentaje_max, rango_min, rango_max
- estado, normalidad_global, p_value_normalidad_global, prueba_normalidad_global
"""

import numpy as np
from scipy import stats
from statsmodels.stats.diagnostic import normal_ad

if "pd" not in globals() or pd is None:
    raise RuntimeError("pandas requerido no disponible")

if "df_ingreso" not in globals():
    raise RuntimeError("df_ingreso requerido no disponible")

# Obtener total_analitos si está disponible (para multianalito)
n_analitos = globals().get("total_analitos", 1)


def _to_float(value):
    try:
        n = float(value)
        return n if np.isfinite(n) else None
    except Exception:
        return None


def _extract_percentage_range(user_params: dict):
    """Extrae el rango porcentual de variación permitido."""
    if not isinstance(user_params, dict):
        return None, None, "user_params_invalid"

    # Soportar:
    # - { "porcentaje_min": 70, "porcentaje_max": 120 }
    # - { "rango_porcentual": { "min": 70, "max": 120 } }
    min_raw = user_params.get("porcentaje_min")
    max_raw = user_params.get("porcentaje_max")

    range_obj = user_params.get("rango_porcentual")
    if isinstance(range_obj, dict):
        min_raw = range_obj.get("min", min_raw)
        max_raw = range_obj.get("max", max_raw)

    pct_min = _to_float(min_raw)
    pct_max = _to_float(max_raw)

    if pct_min is None or pct_max is None:
        return None, None, "missing_range"
    if pct_max <= pct_min:
        return None, None, "invalid_range"
    if pct_min < 0:
        return None, None, "invalid_range"

    return pct_min, pct_max, None


def _evaluar_normalidad_global(valores: np.ndarray):
    n = int(valores.size)
    if n < 3:
        return None, None, None

    try:
        if 3 <= n <= 7:
            prueba = "Shapiro-Wilk"
            _stat, p = stats.shapiro(valores)
        else:
            prueba = "Anderson-Darling"
            _stat, p = normal_ad(valores)

        p_value = float(p)
        es_normal = p_value >= 0.05
        return es_normal, p_value, prueba
    except Exception:
        return None, None, None


# --------------------------------------------------------
# 1. Leer parámetros de usuario (rango porcentual)
# --------------------------------------------------------
user_params = globals().get("user_params", {})
pct_min, pct_max, range_err = _extract_percentage_range(user_params)

# --------------------------------------------------------
# 2. Preparar datos + decidir media/mediana con TODA la data
# --------------------------------------------------------
col_series = []
all_values = []

for col in df_ingreso.columns:
    serie = pd.to_numeric(df_ingreso[col], errors="coerce").dropna()
    col_series.append((col, serie))
    if len(serie) > 0:
        all_values.extend(serie.to_numpy(dtype=float).tolist())

all_values = np.array(all_values, dtype=float)
es_normal, p_value_normalidad, prueba_normalidad = _evaluar_normalidad_global(all_values)

usar_media = es_normal is True
metodo = "media" if usar_media else "mediana"
normalidad_global = (
    "normal_dist"
    if es_normal is True
    else ("no_normal_dist" if es_normal is False else None)
)

# --------------------------------------------------------
# 2.1. Calcular tendencia central global y rango de aceptación
# --------------------------------------------------------
if all_values.size > 0:
    tc_global = float(np.mean(all_values)) if usar_media else float(np.median(all_values))
else:
    tc_global = None

# Calcular rango absoluto basado en porcentaje de la tendencia central global
if tc_global is not None and range_err is None:
    rango_min = tc_global * (pct_min / 100.0)
    rango_max = tc_global * (pct_max / 100.0)
else:
    rango_min = None
    rango_max = None

# --------------------------------------------------------
# 3. Evaluar tendencia central por parámetro vs rango
# --------------------------------------------------------
rows = []
fuera_rango = []
sin_datos = []

for col, serie in col_series:
    n = int(len(serie))
    if n == 0:
        rows.append({
            "parametro": col,
            "n": "0",
            "metodo_tendencia": metodo,
            "tendencia_central": np.nan,
            "tc_global": None if tc_global is None else round(tc_global, 4),
            "porcentaje_min": pct_min,
            "porcentaje_max": pct_max,
            "rango_min": None if rango_min is None else round(rango_min, 4),
            "rango_max": None if rango_max is None else round(rango_max, 4),
            "estado": "sin_datos",
            "normalidad_global": normalidad_global,
            "p_value_normalidad_global": None if p_value_normalidad is None else round(float(p_value_normalidad), 4),
            "prueba_normalidad_global": prueba_normalidad,
        })
        sin_datos.append(col)
        continue

    valor_tc = float(serie.mean()) if usar_media else float(serie.median())
    estado = None
    if range_err is None and rango_min is not None and rango_max is not None:
        if rango_min <= valor_tc <= rango_max:
            estado = "dentro_rango"
        else:
            estado = "fuera_rango"
            fuera_rango.append(col)
    else:
        estado = "rango_no_configurado"

    rows.append({
        "parametro": col,
        "n": str(n),
        "metodo_tendencia": metodo,
        "tendencia_central": round(valor_tc, 4),
        "tc_global": None if tc_global is None else round(tc_global, 4),
        "porcentaje_min": pct_min,
        "porcentaje_max": pct_max,
        "rango_min": None if rango_min is None else round(rango_min, 4),
        "rango_max": None if rango_max is None else round(rango_max, 4),
        "estado": estado,
        "normalidad_global": normalidad_global,
        "p_value_normalidad_global": None if p_value_normalidad is None else round(float(p_value_normalidad), 4),
        "prueba_normalidad_global": prueba_normalidad,
    })

df_resultado = pd.DataFrame(rows).sort_values("parametro").reset_index(drop=True)

# Agregar columna "analito" si es multianalito (current_analito disponible)
_current_analito = globals().get("current_analito")
if _current_analito is not None:
    df_resultado.insert(0, "analito", _current_analito)

# --------------------------------------------------------
# 4. Conclusión
# --------------------------------------------------------
if all_values.size == 0:
    conclusion = "No hay datos numéricos suficientes para evaluar tendencia central."
    conclusion_status = "neutral"
elif range_err == "missing_range":
    conclusion = "Falta configurar el rango porcentual de variación (porcentaje_min y porcentaje_max)."
    conclusion_status = "neutral"
elif range_err == "invalid_range":
    conclusion = "Rango porcentual inválido: el máximo debe ser mayor que el mínimo y ambos deben ser positivos."
    conclusion_status = "neutral"
elif range_err == "user_params_invalid":
    conclusion = "Configuración inválida: user_params no es un objeto."
    conclusion_status = "neutral"
else:
    normalidad_msg = "no evaluable" if es_normal is None else ("normal" if es_normal else "NO normal")
    prueba_msg = prueba_normalidad or "N/A"
    p_msg = "N/A" if p_value_normalidad is None else f"{p_value_normalidad:.4f}"
    tc_global_msg = f"{tc_global:.4f}" if tc_global is not None else "N/A"

    if len(fuera_rango) == 0:
        conclusion = (
            f"Todos los parámetros tienen {metodo} dentro del rango de variación "
            f"[{pct_min:g}%-{pct_max:g}%] de la {metodo} global ({tc_global_msg}), "
            f"equivalente a [{rango_min:.4f}, {rango_max:.4f}]. "
            f"Normalidad global: {normalidad_msg} ({prueba_msg}, p={p_msg})."
        )
        if sin_datos:
            conclusion += f" Sin datos en: {', '.join(sin_datos)}."
        conclusion_status = "success"
    else:
        conclusion = (
            f"Los siguientes parámetros tienen {metodo} FUERA del rango de variación "
            f"[{pct_min:g}%-{pct_max:g}%] de la {metodo} global ({tc_global_msg}), "
            f"equivalente a [{rango_min:.4f}, {rango_max:.4f}]: {', '.join(fuera_rango)}. "
            f"Normalidad global: {normalidad_msg} ({prueba_msg}, p={p_msg})."
        )
        if sin_datos:
            conclusion += f" Sin datos en: {', '.join(sin_datos)}."
        conclusion_status = "danger"
