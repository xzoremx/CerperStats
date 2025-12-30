# modules/python/<id>/principal.py

import numpy as np
from scipy import stats
from scipy.stats import f as fdist
from statsmodels.stats.diagnostic import normal_ad

if "pd" not in globals() or pd is None:
    raise RuntimeError("pandas requerido no disponible")

if "df_ingreso" not in globals():
    raise RuntimeError("df_ingreso requerido no disponible")


# ----------------------------------------
# 1. Evaluar normalidad por analista
# ----------------------------------------
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


# ----------------------------------------
# 2. Aplicación de prueba estadística
# ----------------------------------------
if k < 2:
    prueba = None
    estadistico = None
    p_value = None
    conclusion = "No es posible evaluar homogeneidad: se requiere al menos 2 grupos."
    conclusion_status = "neutral"
else:

    if es_normal_todos:
        # ---------------- PARAMÉTRICAS ----------------
        if k >= 3:
            # Bartlett
            test = stats.bartlett(*grupos)
            prueba = "Bartlett"
            estadistico = float(test.statistic)
            p_value = float(test.pvalue)

        else:  # k == 2
            # Prueba F económica
            g1, g2 = grupos
            var1 = g1.var(ddof=1)
            var2 = g2.var(ddof=1)
            n1 = len(g1)
            n2 = len(g2)

            Fstat = var1 / var2
            p = 2 * min(
                fdist.cdf(Fstat, n1 - 1, n2 - 1),
                1 - fdist.cdf(Fstat, n1 - 1, n2 - 1)
            )

            prueba = "Prueba F"
            estadistico = float(Fstat)
            p_value = float(p)

    else:
        # ---------------- NO PARAMÉTRICA ----------------
        test = stats.levene(*grupos, center="median")
        prueba = "Levene"
        estadistico = float(test.statistic)
        p_value = float(test.pvalue)


    # ---------------- CONCLUSIÓN ----------------
    if p_value >= 0.05:
        conclusion = (
            f"El valor de P-Value = {p_value:.4f} es mayor que el alfa = 0.05, "
            "por lo que se concluye al 95% de confianza que las varianzas son homogéneas (iguales)."
        )
        conclusion_status = "success"
    else:
        conclusion = (
            f"El valor de P-Value = {p_value:.4f} es menor que el alfa = 0.05, "
            "por lo que se concluye al 95% de confianza que las varianzas NO son homogéneas (existen diferencias significativas)."
        )
        conclusion_status = "danger"


# ----------------------------------------
# 3. Construir df_resultado
# ----------------------------------------
df_resultado = pd.DataFrame([{
    "prueba_homogeneidad": prueba,
    "estadistico": None if estadistico is None else round(estadistico, 4),
    "p_value": None if p_value is None else round(p_value, 4),
}])
# conclusion variable ya existe y será exportada por separado

