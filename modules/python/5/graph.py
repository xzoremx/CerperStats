# modules/python/5/graph.py

"""
Gráfico para Homogeneidad de Varianzas (Multianalito)

Este script recibe datos ya filtrados por analito y nivel desde el servidor.
La estructura de df_ingreso es la misma que para monoanalito:
- Columnas = parámetros
- Filas = lecturas

Variable adicional disponible: `total_analitos` (cantidad total de analitos en la sesión)

Entrada:
- df_ingreso
- df_resultado
- total_analitos (opcional)

Salida:
- grafico_data: PNG base64
"""

import io
import base64
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy import stats
import os


# -------------------------
# Validaciones
# -------------------------
if "pd" not in globals() or pd is None:
    raise RuntimeError("pandas requerido no disponible")

if "df_ingreso" not in globals():
    raise RuntimeError("df_ingreso requerido no disponible")

# Obtener total_analitos si está disponible
n_analitos = globals().get("total_analitos", 1)

labels = list(df_ingreso.columns)

# -------------------------
# Detectar prefijo común (parámetro dinámico)
# -------------------------
common = os.path.commonprefix(labels).strip()

if common == "":
    parametro_base = "Parámetro"
else:
    parametro_base = common.rstrip("0123456789.-_ ").strip()
    if parametro_base == "":
        parametro_base = common.strip()

# -------------------------
# Calcular IC Bonferroni por grupo
# -------------------------
stds = []
lower_err = []
upper_err = []
valid_labels = []

alpha_global = 0.05
k = len(labels)
alpha_bonf = alpha_global / max(k, 1)  # evitar división entre 0

ns = []

for col in labels:
    datos = pd.to_numeric(df_ingreso[col], errors="coerce").dropna()
    n = len(datos)

    if n < 2:
        continue

    ns.append(n)
    valid_labels.append(col)

    std = np.std(datos, ddof=1)

    chi2_low = stats.chi2.ppf(1 - alpha_bonf / 2, df=n - 1)
    chi2_up  = stats.chi2.ppf(alpha_bonf / 2, df=n - 1)

    std_low = np.sqrt((n - 1) * std**2 / chi2_low)
    std_up  = np.sqrt((n - 1) * std**2 / chi2_up)

    stds.append(std)
    lower_err.append(std - std_low)
    upper_err.append(std_up - std)


# -------------------------
# Si no hay al menos 2 grupos, no graficamos nada
# -------------------------
if len(stds) < 2:
    grafico_data = ""
else:
    # Dimensiones estándar (consistentes entre informes)
    fig, ax = plt.subplots(figsize=(10, 6), dpi=100)

    y_pos = np.arange(1, len(stds) + 1)

    # Colormap infinito
    cmap = plt.cm.get_cmap("hsv") 

    for i, (std, low, up) in enumerate(zip(stds, lower_err, upper_err)):
        ax.errorbar(
           std,
           y_pos[i],
           xerr=[[low], [up]],
           fmt='o',
           capsize=5,
           color=cmap(i / len(stds)),    
           label=valid_labels[i]
        )


    ax.set_yticks(y_pos)
    ax.set_yticklabels(valid_labels)

    # Título diferenciado para multianalito
    title = f"IC Bonferroni — {parametro_base} (Multianalito)"
    ax.set_title(title)
    ax.set_xlabel("Desviación Estándar")
    ax.set_ylabel(parametro_base)

    ax.legend(fontsize="small", loc="upper right")

    ax.grid(True, linestyle="--", alpha=0.3)
    fig.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png")
    plt.close(fig)
    buf.seek(0)

    grafico_data = "data:image/png;base64," + base64.b64encode(buf.read()).decode("ascii")

