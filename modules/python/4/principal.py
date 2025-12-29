# modules/python/4/principal.py

"""
Evaluación de normalidad (multianalito) — Versión estadísticamente correcta.

Este script recibe datos ya filtrados por analito y nivel desde el servidor.
La estructura de df_ingreso es la misma que para monoanalito:
- Columnas = parámetros (ej: Día 1, Día 2, etc.)
- Filas = lecturas

Variable adicional disponible: `total_analitos` (cantidad total de analitos en la sesión)

Reglas:
- n < 3 : No se puede aplicar prueba de normalidad
- 3 ≤ n ≤ 7 : Shapiro-Wilk
- n > 7 : Anderson-Darling (normal_ad)

Campos de salida:
parametro, n, media, desviacion, asimetria,
p_value, normalidad, prueba_normalidad
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

rows = []

for col in df_ingreso.columns:
    serie = pd.to_numeric(df_ingreso[col], errors="coerce").dropna()
    n = len(serie)

    if n == 0:
        rows.append({
            "parametro": col,
            "n": 0,
            "media": np.nan,
            "desviacion": np.nan,
            "asimetria": np.nan,
            "p_value": None,
            "normalidad": None,
            "prueba_normalidad": None,
        })
        continue

    valores = serie.to_numpy(dtype=float)

    media = float(serie.mean())
    desv = float(serie.std(ddof=1))
    asim = float(serie.skew()) if desv > 0 else np.nan

    # --- Evaluación de normalidad ---
    p_value = None
    normal = None
    prueba = None

    if n < 3:
        # No se puede aplicar ninguna prueba
        p_value = None
        normal = None
        prueba = None

    else:
        try:
            if 3 <= n <= 7:
                prueba = "Shapiro-Wilk"
                stat, p = sps.shapiro(valores)
            else:
                prueba = "Anderson-Darling"
                stat, p = normal_ad(valores)

            p_value = round(float(p), 4)
            normal = p_value >= 0.05

        except Exception:
            p_value = None
            normal = None
            prueba = None

    rows.append({
        "parametro": col,
        "n": n,
        "media": media,
        "desviacion": desv,
        "asimetria": asim,
        "p_value": p_value,
        "normalidad": normal,
        "prueba_normalidad": prueba,
    })

df_resultado = pd.DataFrame(rows)
df_resultado = df_resultado.sort_values("parametro").reset_index(drop=True)

# Inferir el tipo de parámetro desde los nombres de columnas (ej: "Analista 1" → "Analistas")
def inferir_tipo_parametro(columnas):
    """Extrae el tipo de parámetro de los nombres de columnas y lo pluraliza."""
    if len(columnas) == 0:
        return "parámetros"
    # Tomar el primer nombre de columna y extraer la parte textual
    primera_col = str(list(columnas)[0])
    # Remover números y espacios finales (ej: "Analista 1" → "Analista")
    import re
    tipo = re.sub(r'\s*\d+\s*$', '', primera_col).strip()
    if not tipo:
        return "parámetros"
    # Pluralizar (reglas básicas del español)
    if tipo.endswith('a'):
        return tipo + 's'  # Analista → Analistas
    elif tipo.endswith('e') or tipo.endswith('o'):
        return tipo + 's'  # Equipo → Equipos
    elif tipo.endswith('í') or tipo.endswith('ía'):
        return tipo + 's'  # Día → Días
    else:
        return tipo + 'es'  # Valor → Valores

tipo_param = inferir_tipo_parametro(df_ingreso.columns)

# --- Generar conclusión conjunta (resumen de todos los parámetros) ---
parametros_evaluados = [r for r in rows if r.get("normalidad") is not None]
parametros_normales = [r for r in parametros_evaluados if r.get("normalidad") is True]
parametros_no_normales = [r for r in parametros_evaluados if r.get("normalidad") is False]

if len(parametros_evaluados) == 0:
    conclusion = f"No se pudo evaluar normalidad en ningún {tipo_param[:-1] if tipo_param.endswith('s') else tipo_param} (datos insuficientes)"
elif len(parametros_no_normales) == 0:
    conclusion = (
        f"Todos los {tipo_param} ({len(parametros_normales)}) siguen una distribución normal "
        "al 95% de confianza."
    )
elif len(parametros_normales) == 0:
    conclusion = (
        f"Ninguno de los {tipo_param} ({len(parametros_no_normales)}) sigue una distribución normal "
        "al 95% de confianza."
    )
else:
    nombres_no_normales = ", ".join([r["parametro"] for r in parametros_no_normales])
    conclusion = (
        f"De {len(parametros_evaluados)} {tipo_param} evaluados, "
        f"{len(parametros_no_normales)} NO siguen distribución normal ({nombres_no_normales}) "
        "al 95% de confianza."
    )


