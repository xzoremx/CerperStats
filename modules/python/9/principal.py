# modules/python/<id>/principal.py

import numpy as np
from scipy import stats
from statsmodels.stats.diagnostic import normal_ad

if "pd" not in globals() or pd is None:
    raise RuntimeError("pandas requerido no disponible")

if "df_ingreso" not in globals():
    raise RuntimeError("df_ingreso requerido no disponible")


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

# --------------------------------------------------------
# 2.1. Rango de aceptación (directo desde user_params)
# --------------------------------------------------------
if range_err is None:
    rango_min = pct_min
    rango_max = pct_max
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
            "rango_min": rango_min,
            "rango_max": rango_max,
            "estado": "sin_datos",
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
        "rango_min": rango_min,
        "rango_max": rango_max,
        "estado": estado,
    })

df_resultado = pd.DataFrame(rows).sort_values("parametro").reset_index(drop=True)

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
    if len(fuera_rango) == 0:
        conclusion = (
            f"Todos los parámetros tienen {metodo} dentro del rango "
            f"[{rango_min:g}, {rango_max:g}]."
        )
        if sin_datos:
            conclusion += f" Sin datos en: {', '.join(sin_datos)}."
        conclusion_status = "success"
    else:
        conclusion = (
            f"Los siguientes parámetros tienen {metodo} FUERA del rango "
            f"[{rango_min:g}, {rango_max:g}]: {', '.join(fuera_rango)}."
        )
        if sin_datos:
            conclusion += f" Sin datos en: {', '.join(sin_datos)}."
        conclusion_status = "danger"

