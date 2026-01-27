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
    # Usar "medias" para pruebas paramétricas (normales) y "medianas" para no paramétricas
    termino = "medias" if es_normal_todos else "medianas"

    if p_value < 0.05:
        conclusion = (
            f"El valor de P-Value = {p_value:.4f} es menor que el alfa = 0.05, "
            f"por lo que se concluye al 95% de confianza que existen diferencias significativas en las {termino}."
        )
        conclusion_status = "danger"
    else:
        conclusion = (
            f"El valor de P-Value = {p_value:.4f} es mayor que el alfa = 0.05, "
            f"por lo que se concluye al 95% de confianza que NO existen diferencias significativas en las {termino}."
        )
        conclusion_status = "success"

# --- Información diagnóstica para el gráfico cuando hay danger ---
if conclusion_status == "danger":
    cols = list(df_ingreso.columns)
    grupo_stats = []
    for i, col in enumerate(cols):
        vals = grupos[i]
        n = n_por_grupo[i]
        media_val = float(np.mean(vals))
        mediana_val = float(np.median(vals))
        std_val = float(np.std(vals, ddof=1))
        grupo_stats.append({
            "grupo": col,
            "n": n,
            "media": round(media_val, 4),
            "mediana": round(mediana_val, 4),
            "std": round(std_val, 4),
        })

    if es_normal_todos:
        valores_centro = [g["media"] for g in grupo_stats]
    else:
        valores_centro = [g["mediana"] for g in grupo_stats]

    diff_max = round(max(valores_centro) - min(valores_centro), 4)
    idx_max = valores_centro.index(max(valores_centro))
    idx_min = valores_centro.index(min(valores_centro))

    # --- Calcular diferencia crítica basada en la prueba aplicada ---
    diff_critica = None
    exceso = None
    metodo_critico = None
    reduccion_sugerida = None
    
    N_total = sum(n_por_grupo)
    
    if prueba in ["ANOVA", "T-Student"]:
        # Para pruebas paramétricas: calcular LSD (Least Significant Difference)
        # LSD = t_crítico * sqrt(2 * MSE / n_harmonic)
        
        # Calcular MSE (Mean Square Error dentro de grupos)
        ss_within = 0
        for i, vals in enumerate(grupos):
            ss_within += np.sum((vals - np.mean(vals))**2)
        df_error = N_total - k
        mse = ss_within / df_error if df_error > 0 else 0
        
        # Calcular n harmónica para grupos desbalanceados
        n_harmonic = k / sum(1/n for n in n_por_grupo) if all(n > 0 for n in n_por_grupo) else min(n_por_grupo)
        
        # Valor crítico t para alfa=0.05
        t_crit = stats.t.ppf(1 - 0.025, df_error) if df_error > 0 else 2.0
        
        # LSD = t_crítico * sqrt(2 * MSE / n)
        lsd = t_crit * np.sqrt(2 * mse / n_harmonic) if n_harmonic > 0 else 0
        
        diff_critica = round(lsd, 4)
        exceso = round(diff_max - lsd, 4) if diff_max > lsd else 0
        metodo_critico = "LSD (Diferencia Mínima Significativa)"
        
        # Sugerencia de reducción por mitad entre grupos extremos
        reduccion_sugerida = round(exceso / 2, 4) if exceso > 0 else 0
        
    elif prueba in ["Kruskal-Wallis", "Mann-Whitney"]:
        # Para pruebas no paramétricas: usar diferencia basada en rangos
        # Calculamos la diferencia crítica aproximada usando método de Dunn
        
        # Combinar todos los datos y calcular rangos
        all_data = np.concatenate(grupos)
        ranks = stats.rankdata(all_data)
        
        # Separar rangos por grupo
        idx = 0
        mean_ranks = []
        for i, vals in enumerate(grupos):
            n = len(vals)
            group_ranks = ranks[idx:idx+n]
            mean_ranks.append(np.mean(group_ranks))
            idx += n
        
        # Diferencia máxima en rangos medios
        max_rank_diff = max(mean_ranks) - min(mean_ranks)
        
        # Valor crítico z para alfa=0.05
        z_crit = stats.norm.ppf(1 - 0.05 / (k * (k - 1))) if k >= 2 else 1.96
        
        # Error estándar aproximado para diferencia de rangos (Dunn)
        se_diff = np.sqrt((N_total * (N_total + 1) / 12) * (1/n_por_grupo[idx_min] + 1/n_por_grupo[idx_max]))
        
        # Diferencia crítica en términos de rango
        rank_diff_crit = z_crit * se_diff
        
        # Convertir a diferencia en medianas (aproximación)
        # Usamos la relación entre diferencia de rangos y diferencia real
        median_range = max(valores_centro) - min(valores_centro)
        rank_range = max_rank_diff if max_rank_diff > 0 else 1
        
        # Proporción aproximada
        conversion_factor = median_range / rank_range if rank_range > 0 else 1
        diff_critica_approx = rank_diff_crit * conversion_factor
        
        diff_critica = round(diff_critica_approx, 4)
        exceso = round(diff_max - diff_critica_approx, 4) if diff_max > diff_critica_approx else 0
        metodo_critico = "Método de Dunn (basado en rangos)"
        
        # Sugerencia de reducción
        reduccion_sugerida = round(exceso / 2, 4) if exceso > 0 else 0

    danger_info = {
        "prueba": prueba,
        "es_normal": es_normal_todos,
        "termino": termino,
        "grupo_stats": grupo_stats,
        "grupo_mayor": grupo_stats[idx_max]["grupo"],
        "grupo_menor": grupo_stats[idx_min]["grupo"],
        "centro_mayor": valores_centro[idx_max],
        "centro_menor": valores_centro[idx_min],
        "diferencia_maxima": diff_max,
        "diferencia_critica": diff_critica,
        "exceso_diferencia": exceso,
        "metodo_critico": metodo_critico,
        # Opción A: ajustar solo un grupo (toda la carga)
        "ajuste_completo": exceso,
        # Opción B: dividir ajuste entre ambos grupos
        "ajuste_dividido": reduccion_sugerida,
        # Targets calculados
        "target_mayor": round(valores_centro[idx_max] - exceso, 4) if exceso > 0 else valores_centro[idx_max],
        "target_menor": round(valores_centro[idx_min] + exceso, 4) if exceso > 0 else valores_centro[idx_min],
    }


# --------------------------------------------------------
# 4. Resultado final
# --------------------------------------------------------
df_resultado = pd.DataFrame([{
    "prueba_tendencia": prueba,
    "estadistico": None if estadistico is None else round(estadistico, 4),
    "p_value": None if p_value is None else round(p_value, 4),
}])

# Agregar columna "analito" si es multianalito (current_analito disponible)
_current_analito = globals().get("current_analito")
if _current_analito is not None:
    df_resultado.insert(0, "analito", _current_analito)
# conclusion variable ya existe y será exportada por separado

