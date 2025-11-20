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
        "curtosis": curt,
        "p_value": p_value,
        "normalidad": normal,
        "prueba_normalidad": prueba,
    })

df_resultado = pd.DataFrame(rows)
df_resultado = df_resultado.sort_values("parametro").reset_index(drop=True)


