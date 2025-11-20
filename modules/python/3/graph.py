# modules/python/3/graph.py

import io
import base64
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy import stats
import os

"""
Gráfico para Tendencia Central (Monoanalito)

Entrada:
- df_ingreso
- df_resultado: contiene prueba_tendencia, estadistico, p_value

Reglas:
- Si todos normales  → IC del 95% para la media (t-student)
- Si no normales     → Boxplot

Salida:
- grafico_data (PNG base64)
"""

# -------------------------
# Validaciones
# -------------------------
if "pd" not in globals() or pd is None:
    raise RuntimeError("pandas requerido no disponible")

if "df_ingreso" not in globals():
    raise RuntimeError("df_ingreso requerido no disponible")

if "df_resultado" not in globals():
    raise RuntimeError("df_resultado requerido no disponible")


fila = df_resultado.iloc[0]
prueba = fila.get("prueba_tendencia", "")
estad = fila.get("estadistico", None)
p_value = fila.get("p_value", None)

labels = list(df_ingreso.columns)

# -------------------------
# Detectar prefijo común para nombre del parámetro
# -------------------------
common = os.path.commonprefix(labels).strip()

if common == "":
    parametro_base = "Categoría"
else:
    parametro_base = common.rstrip("0123456789.-_ ").strip()
    if parametro_base == "":
        parametro_base = common.strip()


# -------------------------
# Determinar si datos son normales
# -------------------------
# Usamos lógica idéntica a tu script Excel

es_normal_todos = True
grupos = []
ns = []

for col in labels:
    datos = pd.to_numeric(df_ingreso[col], errors="coerce").dropna()
    valores = datos.to_numpy(float)
    n = len(valores)

    if n > 7:
        stat, p = stats.anderson(valores, dist="norm") if False else (None, None)
        # Usamos normal_ad como en tu Excel
        from statsmodels.stats.diagnostic import normal_ad
        stat, p = normal_ad(valores)
    else:
        stat, p = stats.shapiro(valores)

    if p < 0.05:
        es_normal_todos = False

    grupos.append(valores)
    ns.append(n)


# -------------------------
# Construir leyenda según prueba (estilo Minitab)
# -------------------------
texto_estadistico = ""

if prueba == "ANOVA":
    df = len(labels) - 1
    df_error = sum(ns) - len(labels)
    texto_estadistico = (
        f"ANOVA\n"
        f"F = {estad}\n"
        f"gl = ({df}, {df_error})\n"
        f"p = {p_value}"
    )

elif prueba == "T-Student":
    df = ns[0] + ns[1] - 2
    texto_estadistico = (
        f"T-Student\n"
        f"t = {estad}\n"
        f"gl = {df}\n"
        f"p = {p_value}"
    )

elif prueba == "Kruskal-Wallis":
    df = len(labels) - 1
    texto_estadistico = (
        f"Kruskal-Wallis\n"
        f"H = {estad}\n"
        f"gl = {df}\n"
        f"p = {p_value}"
    )

elif prueba == "Mann-Whitney":
    texto_estadistico = (
        f"Mann-Whitney\n"
        f"U = {estad}\n"
        f"p = {p_value}"
    )

else:
    texto_estadistico = f"{prueba}\np = {p_value}"


# -------------------------
# Construir gráfico
# -------------------------
if es_normal_todos:
    # -------------------------
    # INTERVALOS DE CONFIANZA PARA LA MEDIA
    # -------------------------
    fig, ax = plt.subplots(figsize=(10,6), dpi=100)

    medias = []
    yerr_low = []
    yerr_up = []

    for i, vals in enumerate(grupos):
        n = ns[i]
        mean = np.mean(vals)
        stderr = stats.sem(vals)
        ci = stats.t.interval(0.95, df=n-1, loc=mean, scale=stderr)

        medias.append(mean)
        yerr_low.append(mean - ci[0])
        yerr_up.append(ci[1] - mean)

    x = np.arange(1, len(medias)+1)

    # Colores infinitos a partir de un colormap continuo
    cmap = plt.cm.get_cmap("hsv")  

    for i, (mean, low, up) in enumerate(zip(medias, yerr_low, yerr_up)):
        ax.errorbar(
           x[i],
           mean,
           yerr=[[low], [up]],
           fmt="o",
           capsize=5,
           color=cmap(i / len(medias)),  
           label=labels[i]
       )


    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=45)
    ax.set_ylabel("Media")
    ax.set_title("Intervalos de Confianza (95%) para la Media")

else:
    # -------------------------
    # BOXPLOT PARA DATOS NO NORMALES
    # -------------------------
    fig, ax = plt.subplots(figsize=(10,6), dpi=100)

    ax.boxplot(grupos, labels=labels)
    ax.set_ylabel("Valor")
    ax.set_title("Boxplot (Datos No Normales)")


# -------------------------
# Agregar leyenda estadística estilo Minitab
# -------------------------
plt.text(
    1.02, 0.95,
    texto_estadistico,
    transform=ax.transAxes,
    fontsize=10,
    va='top',
    ha='left',
    bbox=dict(boxstyle="round,pad=0.4", fc="white", ec="gray")
)

plt.grid(True, linestyle="--", alpha=0.3)
fig.tight_layout()


# -------------------------
# Convertir a base64
# -------------------------
buf = io.BytesIO()
fig.savefig(buf, format="png")
plt.close(fig)
buf.seek(0)

grafico_data = "data:image/png;base64," + base64.b64encode(buf.read()).decode("ascii")
