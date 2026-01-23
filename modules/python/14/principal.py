# modules/python/14/principal.py

"""
Evaluación de precisión RSD (multianalito) — RSD teórico configurable.

Este script recibe datos ya filtrados por analito y nivel desde el servidor.
La estructura de df_ingreso es la misma que para monoanalito:
- Columnas = parámetros (ej: Analista 1, Analista 2, etc.)
- Filas = lecturas

Variable adicional disponible: `total_analitos` (cantidad total de analitos en la sesión)

Reglas:
- Calcular RSD por parámetro y comparar con RSD teórico
- Calcular métricas globales: RSDexp, RSDr, RSDR (ISO 5725)

Campos de salida en df_resultado:
- analito (si aplica)
- parametro, n, media, desviacion, rsd_pct, rsd_teorico, estado
- media_global, desviacion_global, rsd_experimental, rsd_r, rsd_R
"""

import numpy as np

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


def _extract_rsd_teorico(user_params: dict):
    if not isinstance(user_params, dict):
        return None, "user_params_invalid"

    raw = user_params.get("rsd_teorico")
    if raw is None:
        raw = user_params.get("RSD_teorico")
    if raw is None:
        raw = user_params.get("rsd")
    if raw is None:
        raw = user_params.get("rsd_threshold")

    rsd_teorico = _to_float(raw)
    if rsd_teorico is None:
        return None, "missing_rsd_teorico"
    if rsd_teorico <= 0:
        return None, "invalid_rsd_teorico"

    return rsd_teorico, None


def _safe_rsd_pct(mean_value: float, std_value: float):
    if mean_value is None or std_value is None:
        return None
    if not np.isfinite(mean_value) or not np.isfinite(std_value):
        return None
    if mean_value == 0:
        return None
    if std_value < 0:
        return None
    return (std_value / abs(mean_value)) * 100.0


# --------------------------------------------------------
# 1. Leer parámetro de usuario (RSD teórico)
# --------------------------------------------------------
user_params = globals().get("user_params", {})
rsd_teorico, rsd_err = _extract_rsd_teorico(user_params)

# --------------------------------------------------------
# 2. Calcular RSD por analista (columna)
# --------------------------------------------------------
rows = []
fallan = []
sin_datos = []
no_evaluable = []

col_stats = []  # (n, mean, std)
all_values = []

for col in df_ingreso.columns:
    serie = pd.to_numeric(df_ingreso[col], errors="coerce").dropna()
    n = int(len(serie))
    if n == 0:
        sin_datos.append(col)
        rows.append({
            "parametro": col,
            "n": "0",
            "media": np.nan,
            "desviacion": np.nan,
            "rsd_pct": np.nan,
            "rsd_teorico": rsd_teorico,
            "estado": "sin_datos",
        })
        continue

    mean_val = float(serie.mean())
    std_val = float(serie.std(ddof=1)) if n > 1 else np.nan
    rsd_pct = _safe_rsd_pct(mean_val, std_val) if n > 1 else None

    estado = None
    if rsd_err is not None:
        estado = "config_no_valida"
    elif rsd_pct is None:
        estado = "no_evaluable"
        no_evaluable.append(col)
    elif rsd_pct <= rsd_teorico:
        estado = "cumple"
    else:
        estado = "no_cumple"
        fallan.append(col)

    rows.append({
        "parametro": col,
        "n": str(n),
        "media": round(mean_val, 6),
        "desviacion": None if not np.isfinite(std_val) else round(std_val, 6),
        "rsd_pct": None if rsd_pct is None else round(float(rsd_pct), 4),
        "rsd_teorico": rsd_teorico,
        "estado": estado,
    })

    col_stats.append((n, mean_val, std_val))
    all_values.extend(serie.to_numpy(dtype=float).tolist())

all_values = np.array(all_values, dtype=float)

# --------------------------------------------------------
# 3. Métricas globales (RSDexp, RSDr, RSDR)
# --------------------------------------------------------
rsd_experimental = None
rsd_r = None
rsd_R = None
media_global = None
desv_global = None

if all_values.size >= 2:
    media_global = float(np.mean(all_values))
    desv_global = float(np.std(all_values, ddof=1))
    rsd_experimental = _safe_rsd_pct(media_global, desv_global)

    # Sr² = promedio de varianzas intra-grupo (repeatability)
    varianzas_intra = []
    group_means = []
    for n, m, s in col_stats:
        if n > 1 and np.isfinite(s):
            varianzas_intra.append(s ** 2)
        if n > 0 and np.isfinite(m):
            group_means.append(float(m))

    Sr_squared = None
    Sr = None
    if len(varianzas_intra) > 0:
        Sr_squared = float(np.mean(varianzas_intra))
        Sr = float(np.sqrt(Sr_squared))
        rsd_r = _safe_rsd_pct(media_global, Sr)

    # SL² y RSDR (fórmula ISO 5725)
    if Sr_squared is not None and len(group_means) >= 2:
        n_replicas = df_ingreso.shape[0]  # número de réplicas (filas)
        a_analistas = df_ingreso.shape[1]  # número de analistas (columnas)

        medias_analistas = np.array(group_means)
        suma_promedios = float(np.sum(medias_analistas))
        suma_cuadrados_promedios = float(np.sum(medias_analistas ** 2))

        C102 = n_replicas * suma_promedios
        C103 = n_replicas * suma_cuadrados_promedios
        C104 = n_replicas * a_analistas
        C105 = (n_replicas ** 2) * a_analistas

        numerador = (C103 * C104 - C102 ** 2) / (C104 * (a_analistas - 1)) - Sr_squared
        denominador = (C104 * (a_analistas - 1)) / (C104 ** 2 - C105)

        SL_squared = abs(numerador * denominador)
        SR = float(np.sqrt(Sr_squared + SL_squared))
        rsd_R = _safe_rsd_pct(media_global, SR)

for row in rows:
    row["media_global"] = None if media_global is None else round(media_global, 6)
    row["desviacion_global"] = None if desv_global is None else round(desv_global, 6)
    row["rsd_experimental"] = None if rsd_experimental is None else round(float(rsd_experimental), 4)
    row["rsd_r"] = None if rsd_r is None else round(float(rsd_r), 4)
    row["rsd_R"] = None if rsd_R is None else round(float(rsd_R), 4)

df_resultado = pd.DataFrame(rows).sort_values("parametro").reset_index(drop=True)

# Agregar columna "analito" si es multianalito (current_analito disponible)
_current_analito = globals().get("current_analito")
if _current_analito is not None:
    df_resultado.insert(0, "analito", _current_analito)

# --------------------------------------------------------
# 4. Conclusión
# --------------------------------------------------------
if all_values.size == 0:
    conclusion = "No hay datos numéricos suficientes para evaluar precisión."
    conclusion_status = "neutral"
elif rsd_err == "missing_rsd_teorico":
    conclusion = "Falta configurar el RSD teórico."
    conclusion_status = "neutral"
elif rsd_err == "invalid_rsd_teorico":
    conclusion = "RSD teórico inválido: debe ser mayor que 0."
    conclusion_status = "neutral"
elif rsd_err == "user_params_invalid":
    conclusion = "Configuración inválida: user_params no es un objeto."
    conclusion_status = "neutral"
else:
    parts = []
    if rsd_experimental is not None:
        parts.append(f"RSDexperimental={rsd_experimental:.4f}%")
    if rsd_r is not None:
        parts.append(f"RSDr={rsd_r:.4f}%")
    if rsd_R is not None:
        parts.append(f"RSDR={rsd_R:.4f}%")
    summary = ", ".join(parts) if parts else "Métricas globales no disponibles"

    if len(fallan) == 0 and len(no_evaluable) == 0:
        conclusion = (
            f"Precisión aceptable: todos los RSD individuales son ≤ {rsd_teorico:g}%. "
            f"{summary}."
        )
        if sin_datos:
            conclusion += f" Sin datos en: {', '.join(sin_datos)}."
        conclusion_status = "success"
    else:
        msg = []
        if fallan:
            msg.append(f"No cumplen: {', '.join(fallan)}")
        if no_evaluable:
            msg.append(f"No evaluable: {', '.join(no_evaluable)}")
        conclusion = (
            f"Precisión NO aceptable (RSD teórico={rsd_teorico:g}%). "
            f"{summary}. " + " · ".join(msg) + "."
        )
        if sin_datos:
            conclusion += f" Sin datos en: {', '.join(sin_datos)}."
        conclusion_status = "danger"
