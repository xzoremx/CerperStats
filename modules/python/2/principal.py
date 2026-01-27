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

# --- Información diagnóstica para el gráfico cuando hay danger ---
if conclusion_status == "danger":
    cols = list(df_ingreso.columns)
    grupo_stats = []
    varianzas = []
    for i, col in enumerate(cols):
        vals = grupos[i]
        n = n_por_grupo[i]
        std_val = float(np.std(vals, ddof=1))
        var_val = float(np.var(vals, ddof=1))
        varianzas.append(var_val)
        grupo_stats.append({
            "grupo": col,
            "n": n,
            "std": round(std_val, 4),
            "var": round(var_val, 6),
        })

    stds_list = [g["std"] for g in grupo_stats]
    std_promedio = round(float(np.mean(stds_list)), 4)

    for g in grupo_stats:
        g["diff_pct"] = round(abs(g["std"] - std_promedio) / max(std_promedio, 1e-12) * 100, 1)

    # El grupo a revisar es el más alejado del promedio
    idx_revisar = max(range(len(grupo_stats)), key=lambda i: grupo_stats[i]["diff_pct"])
    
    # --- Calcular razón de varianzas crítica basada en la prueba aplicada ---
    var_max = max(varianzas)
    var_min = min(varianzas)
    idx_var_max = varianzas.index(var_max)
    idx_var_min = varianzas.index(var_min)
    
    razon_var_actual = round(var_max / var_min, 4) if var_min > 0 else float('inf')
    
    # Calcular F crítico
    n_max = n_por_grupo[idx_var_max]
    n_min = n_por_grupo[idx_var_min]
    df1 = n_max - 1
    df2 = n_min - 1
    
    # F crítico para alfa=0.05 (dos colas, usamos cola superior)
    f_crit = fdist.ppf(0.975, df1, df2) if df1 > 0 and df2 > 0 else 3.0
    
    razon_critica = round(f_crit, 4)
    
    # Calcular varianza target para el grupo más disperso (OPCIÓN 1: reducir máximo)
    # Si var_max / var_min > F_crit, necesitamos que var_max_nueva / var_min <= F_crit
    # Entonces var_max_nueva <= F_crit * var_min
    var_target_max = f_crit * var_min
    std_target_max = round(np.sqrt(var_target_max), 4)
    
    # Calcular varianza target para el grupo más preciso (OPCIÓN 2: aumentar mínimo)
    # var_max / var_min_nueva <= F_crit
    # var_min_nueva >= var_max / F_crit
    var_target_min = var_max / f_crit if f_crit > 0 else var_max
    std_target_min = round(np.sqrt(var_target_min), 4)
    
    # Reducción/aumento necesarios en desv. estándar
    std_actual_max = grupo_stats[idx_var_max]["std"]
    std_actual_min = grupo_stats[idx_var_min]["std"]
    reduccion_std = round(std_actual_max - std_target_max, 4) if std_actual_max > std_target_max else 0
    aumento_std = round(std_target_min - std_actual_min, 4) if std_target_min > std_actual_min else 0
    
    exceso_razon = round(razon_var_actual - f_crit, 4) if razon_var_actual > f_crit else 0

    danger_info = {
        "prueba": prueba,
        "grupo_stats": grupo_stats,
        "std_promedio": std_promedio,
        "grupo_revisar": grupo_stats[idx_revisar]["grupo"],
        "grupo_var_max": grupo_stats[idx_var_max]["grupo"],
        "grupo_var_min": grupo_stats[idx_var_min]["grupo"],
        "std_max": std_actual_max,
        "std_min": std_actual_min,
        "razon_var_actual": razon_var_actual,
        "razon_critica": razon_critica,
        "exceso_razon": exceso_razon,
        "std_target_max": std_target_max,
        "std_target_min": std_target_min,
        "reduccion_std": reduccion_std,
        "aumento_std": aumento_std,
    }


# ----------------------------------------
# 3. Construir df_resultado
# ----------------------------------------
df_resultado = pd.DataFrame([{
    "prueba_homogeneidad": prueba,
    "estadistico": None if estadistico is None else round(estadistico, 4),
    "p_value": None if p_value is None else round(p_value, 4),
}])
# conclusion variable ya existe y será exportada por separado

