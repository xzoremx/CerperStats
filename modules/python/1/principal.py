# modules/python/1/principal.py

"""
Evaluación de normalidad (monoanalito) — Versión estadísticamente correcta.

Reglas:
- n < 3 : No se puede aplicar prueba de normalidad
- 3 ≤ n ≤ 7 : Shapiro-Wilk
- n > 7 : Anderson-Darling (normal_ad)

Campos:
parametro, n, media, desviacion, asimetria, curtosis,
p_value_normalidad, normalidad, prueba_normalidad
"""

import numpy as np
from scipy import stats as sps
from statsmodels.stats.diagnostic import normal_ad

# --- Validación del entorno ---
if "pd" not in globals() or pd is None:
    raise RuntimeError("pandas requerido no disponible")

if "df_ingreso" not in globals():
    raise RuntimeError("df_ingreso requerido no disponible")


rows = []
conclusions_parts = []

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
            "curtosis": np.nan,
            "p_value": None,
            "normalidad": None,
            "prueba_normalidad": None,
        })
        conclusions_parts.append(f"{col}: Sin datos disponibles")
        continue

    valores = serie.to_numpy(dtype=float)

    media = float(serie.mean())
    desv = float(serie.std(ddof=1))
    asim = float(serie.skew()) if desv > 0 else np.nan

    kurt_exceso = serie.kurtosis()        # exceso → Fisher
    curt = float(kurt_exceso + 3) if not np.isnan(kurt_exceso) else np.nan  # Pearson

    # --- Evaluación de normalidad ---
    p_value = None
    normal = None
    prueba = None

    if n < 3:
        # No se puede aplicar ninguna prueba
        p_value = None
        normal = None
        prueba = None
        conclusions_parts.append(f"{col}: No evaluable (n < 3)")

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

            # Agregar parte de la conclusión
            if normal:
                conclusions_parts.append(f"{col}: Normal (p={p_value:.4f})")
            else:
                conclusions_parts.append(f"{col}: NO Normal (p={p_value:.4f})")

        except Exception:
            p_value = None
            normal = None
            prueba = None
            conclusions_parts.append(f"{col}: Error al evaluar")

    rows.append({
        "parametro": col,
        "n": n,
        "media": media,
        "desviacion": desv,
        "asimetria": asim,
        "curtosis": curt,
        "p_value": p_value,
        "normalidad": normal,
        "prueba_normalidad": prueba,
    })

df_resultado = pd.DataFrame(rows)
df_resultado = df_resultado.sort_values("parametro").reset_index(drop=True)

# Inferir el tipo de parámetro desde los nombres de columnas (ej: "Analista 1" → "Analistas")
def inferir_tipo_parametro(columnas):
    """Extrae el tipo de parámetro de los nombres de columnas y lo pluraliza."""
    if not columnas:
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

# Generar conclusión general
normales = [r for r in rows if r.get("normalidad") is True]
no_normales = [r for r in rows if r.get("normalidad") is False]
no_evaluables = [r for r in rows if r.get("normalidad") is None]

if len(no_normales) == 0 and len(normales) > 0:
    conclusion = f"Los {len(normales)} {tipo_param} evaluados siguen una distribución normal al 95% de confianza."
elif len(normales) == 0 and len(no_normales) > 0:
    conclusion = f"Ninguno de los {len(no_normales)} {tipo_param} evaluados sigue una distribución normal al 95% de confianza."
elif len(normales) > 0 and len(no_normales) > 0:
    no_normal_names = ", ".join([r["parametro"] for r in no_normales])
    conclusion = f"De {len(normales) + len(no_normales)} {tipo_param}, {len(no_normales)} NO siguen distribución normal ({no_normal_names}) al 95% de confianza."
else:
    conclusion = f"No se pudo evaluar normalidad en ningún {tipo_param[:-1] if tipo_param.endswith('s') else tipo_param}."

