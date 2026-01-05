# modules/python/6/principal.py

"""
Evaluación de tendencia central (multianalito).

Este script recibe datos ya filtrados por analito y nivel desde el servidor.
La estructura de df_ingreso es la misma que para monoanalito:
- Columnas = parámetros (ej: Analista 1, Analista 2, etc.)
- Filas = lecturas

Variable adicional disponible: `total_analitos` (cantidad total de analitos en la sesión)

Reglas:
- k < 2 : No se puede evaluar tendencia central
- Si todos normales: ANOVA (k>=3) o T-Student (k==2)
- Si no todos normales: Kruskal-Wallis (k>=3) o Mann-Whitney (k==2)

Campos de salida:
prueba_tendencia, estadistico, p_value
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


# --------------------------------------------------------
# 1. Evaluar normalidad por analista
# --------------------------------------------------------
es_normal_todos = True
grupos = []
n_por_grupo = []

for col in df_ingreso.columns:
    datos = pd.to_numeric(df_ingreso[col], errors="coerce").dropna()
    valores = datos.to_numpy(float)
    n = len(valores)

    if n > 7:
        stat, p = normal_ad(valores)
    else:
        stat, p = stats.shapiro(valores)

    if p < 0.05:
        es_normal_todos = False

    grupos.append(valores)
    n_por_grupo.append(n)

k = len(grupos)


# --------------------------------------------------------
# 2. Determinar prueba de tendencia central
# --------------------------------------------------------
if k < 2:
    prueba = None
    estadistico = None
    p_value = None
    conclusion = "No es posible evaluar tendencia central: se requieren al menos 2 grupos."
    conclusion_status = "neutral"

else:
    # ----------- PARAMÉTRICAS (todos normales) -----------
    if es_normal_todos:

        if k >= 3:
            # ANOVA
            test = stats.f_oneway(*grupos)
            prueba = "ANOVA"
            estadistico = float(test.statistic)
            p_value = float(test.pvalue)

        else:  # k == 2
            # T-test independiente
            test = stats.ttest_ind(grupos[0], grupos[1])
            prueba = "T-Student"
            estadistico = float(test.statistic)
            p_value = float(test.pvalue)

    # ----------- NO PARAMÉTRICAS -----------
    else:

        if k >= 3:
            # Kruskal-Wallis
            test = stats.kruskal(*grupos)
            prueba = "Kruskal-Wallis"
            estadistico = float(test.statistic)
            p_value = float(test.pvalue)

        else:  # k == 2
            # Mann-Whitney U
            test = stats.mannwhitneyu(grupos[0], grupos[1], alternative="two-sided")
            prueba = "Mann-Whitney"
            estadistico = float(test.statistic)
            p_value = float(test.pvalue)


    # --------------------------------------------------------
    # 3. Conclusión textual
    # --------------------------------------------------------
    if p_value < 0.05:
        conclusion = (
            f"El valor de P-Value = {p_value:.4f} es menor que el alfa = 0.05, "
            "por lo que se concluye al 95% de confianza que existen diferencias significativas en la tendencia central."
        )
        conclusion_status = "danger"
    else:
        conclusion = (
            f"El valor de P-Value = {p_value:.4f} es mayor que el alfa = 0.05, "
            "por lo que se concluye al 95% de confianza que NO existen diferencias significativas en la tendencia central."
        )
        conclusion_status = "success"


# --------------------------------------------------------
# 4. Resultado final
# --------------------------------------------------------
df_resultado = pd.DataFrame([{
    "prueba_tendencia": prueba,
    "estadistico": None if estadistico is None else round(estadistico, 4),
    "p_value": None if p_value is None else round(p_value, 4),
}])
# conclusion variable ya existe y será exportada por separado

