# modules/python/10/principal.py

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


def _extract_acceptance_range(user_params: dict):
    if not isinstance(user_params, dict):
        return None, None, "user_params_invalid"

    min_raw = user_params.get("rango_min")
    max_raw = user_params.get("rango_max")

    range_obj = user_params.get("rango_aceptacion")
    if isinstance(range_obj, dict):
        min_raw = range_obj.get("min", min_raw)
        max_raw = range_obj.get("max", max_raw)

    rango_min = _to_float(min_raw)
    rango_max = _to_float(max_raw)

    if rango_min is None or rango_max is None:
        return None, None, "missing_range"
    if rango_max <= rango_min:
        return None, None, "invalid_range"

    return rango_min, rango_max, None


def _extract_adicion(user_params: dict):
    if not isinstance(user_params, dict):
        return None, "user_params_invalid"

    raw = user_params.get("adicion")
    if raw is None:
        raw = user_params.get("valor_adicion")
    if raw is None:
        raw = user_params.get("adicion_estandar")

    adicion = _to_float(raw)
    if adicion is None:
        return None, "missing_adicion"
    if adicion <= 0:
        return None, "invalid_adicion"

    return adicion, None


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
# 1. Leer parámetros de usuario (adición + rango de recuperación)
# --------------------------------------------------------
user_params = globals().get("user_params", {})
adicion, adicion_err = _extract_adicion(user_params)
rango_min, rango_max, range_err = _extract_acceptance_range(user_params)

# --------------------------------------------------------
# 2. Preparar data + decidir media/mediana con TODA la data
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
# 3. Veracidad por recuperación (por analista)
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
            "adicion": adicion,
            "recuperacion_pct": np.nan,
            "rango_min": rango_min,
            "rango_max": rango_max,
            "estado": "sin_datos",
            "normalidad_global": normalidad_global,
            "p_value_normalidad_global": None if p_value_normalidad is None else round(float(p_value_normalidad), 4),
            "prueba_normalidad_global": prueba_normalidad,
        })
        sin_datos.append(col)
        continue

    valor_tc = float(serie.mean()) if usar_media else float(serie.median())

    recuperacion_pct = None
    estado = None
    if adicion_err is None and range_err is None:
        recuperacion_pct = (valor_tc / adicion) * 100.0
        if rango_min <= recuperacion_pct <= rango_max:
            estado = "dentro_rango"
        else:
            estado = "fuera_rango"
            fuera_rango.append(col)
    else:
        estado = "config_no_valida"

    rows.append({
        "parametro": col,
        "n": str(n),
        "metodo_tendencia": metodo,
        "tendencia_central": round(valor_tc, 6),
        "adicion": adicion,
        "recuperacion_pct": None if recuperacion_pct is None else round(float(recuperacion_pct), 2),
        "rango_min": rango_min,
        "rango_max": rango_max,
        "estado": estado,
        "normalidad_global": normalidad_global,
        "p_value_normalidad_global": None if p_value_normalidad is None else round(float(p_value_normalidad), 4),
        "prueba_normalidad_global": prueba_normalidad,
    })

df_resultado = pd.DataFrame(rows).sort_values("parametro").reset_index(drop=True)

# --------------------------------------------------------
# 4. Conclusión
# --------------------------------------------------------
if all_values.size == 0:
    conclusion = "No hay datos numéricos suficientes para evaluar veracidad."
    conclusion_status = "neutral"
elif adicion_err == "missing_adicion":
    conclusion = "Falta configurar el valor de adición."
    conclusion_status = "neutral"
elif adicion_err == "invalid_adicion":
    conclusion = "Valor de adición inválido: debe ser mayor que 0."
    conclusion_status = "neutral"
elif range_err == "missing_range":
    conclusion = "Falta configurar el rango de aceptación de recuperación (mínimo y máximo)."
    conclusion_status = "neutral"
elif range_err == "invalid_range":
    conclusion = "Rango de aceptación inválido: el máximo debe ser mayor que el mínimo."
    conclusion_status = "neutral"
elif adicion_err == "user_params_invalid" or range_err == "user_params_invalid":
    conclusion = "Configuración inválida: user_params no es un objeto."
    conclusion_status = "neutral"
else:
    normalidad_msg = "no evaluable" if es_normal is None else ("normal" if es_normal else "NO normal")
    prueba_msg = prueba_normalidad or "N/A"
    p_msg = "N/A" if p_value_normalidad is None else f"{p_value_normalidad:.4f}"

    tc_total = float(np.mean(all_values)) if usar_media else float(np.median(all_values))
    rec_total = (tc_total / adicion) * 100.0

    if len(fuera_rango) == 0:
        conclusion = (
            f"Recuperación dentro del rango [{rango_min:g}, {rango_max:g}]% "
            f"usando {metodo}. Recuperación global: {rec_total:.1f}% "
            f"(adición={adicion:g}). Normalidad global: {normalidad_msg} "
            f"({prueba_msg}, p={p_msg})."
        )
        if sin_datos:
            conclusion += f" Sin datos en: {', '.join(sin_datos)}."
        conclusion_status = "success"
    else:
        conclusion = (
            f"Recuperación FUERA del rango [{rango_min:g}, {rango_max:g}]% "
            f"en: {', '.join(fuera_rango)} usando {metodo}. "
            f"Recuperación global: {rec_total:.1f}% (adición={adicion:g}). "
            f"Normalidad global: {normalidad_msg} ({prueba_msg}, p={p_msg})."
        )
        if sin_datos:
            conclusion += f" Sin datos en: {', '.join(sin_datos)}."
        conclusion_status = "danger"

