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

    # Título con nombre del analito si es multianalito
    _analito = globals().get("current_analito")
    if _analito:
        title = f"IC Bonferroni — {parametro_base} ({_analito})"
    else:
        title = f"IC Bonferroni — {parametro_base}"
    ax.set_title(title)
    ax.set_xlabel("Desviación Estándar")
    ax.set_ylabel(parametro_base)

    ax.legend(fontsize="small", loc="upper right")

    ax.grid(True, linestyle="--", alpha=0.3)
    fig.tight_layout()

    # --- Info diagnóstica cuando conclusion_status == "danger" ---
    _conclusion_status = globals().get("conclusion_status")
    _danger_info = globals().get("danger_info")

    if _conclusion_status == "danger" and _danger_info and isinstance(_danger_info, dict):
        grupo_stats = _danger_info.get("grupo_stats", [])
        grupo_var_max = _danger_info.get("grupo_var_max", "?")
        grupo_var_min = _danger_info.get("grupo_var_min", "?")
        std_max = _danger_info.get("std_max", "?")
        std_min = _danger_info.get("std_min", "?")
        razon_actual = _danger_info.get("razon_var_actual", "?")
        razon_critica = _danger_info.get("razon_critica", "?")
        std_target_max = _danger_info.get("std_target_max", "?")
        std_target_min = _danger_info.get("std_target_min", "?")
        reduccion_std = _danger_info.get("reduccion_std", 0)
        aumento_std = _danger_info.get("aumento_std", 0)
        prueba_usada = _danger_info.get("prueba", "")

        info_lines = [
            f"PARA APROBAR LA PRUEBA ({prueba_usada}):",
            f"",
            f"Raz\u00f3n varianzas: {razon_actual} (debe ser \u2264 {razon_critica})",
            f"",
            f"OPCI\u00d3N 1 - Reducir grupo m\u00e1s disperso:",
            f"  '{grupo_var_max}': s={std_max} \u2192 s\u2264{std_target_max}",
        ]
        if reduccion_std and reduccion_std > 0:
            info_lines.append(f"  (reducci\u00f3n de ~{reduccion_std})")
        
        info_lines.append(f"")
        info_lines.append(f"OPCI\u00d3N 2 - Aumentar grupo m\u00e1s preciso:")
        info_lines.append(f"  '{grupo_var_min}': s={std_min} \u2192 s\u2265{std_target_min}")
        if aumento_std and aumento_std > 0:
            info_lines.append(f"  (aumento de ~{aumento_std})")
        
        info_lines.append(f"")
        info_lines.append(f"DETALLE:")
        for gs in grupo_stats:
            if gs["grupo"] == grupo_var_max:
                marca = " \u2191 M\u00c1S DISPERSO"
            elif gs["grupo"] == grupo_var_min:
                marca = " \u2193 M\u00c1S PRECISO"
            else:
                marca = ""
            info_lines.append(f"  {gs['grupo']}: s={gs['std']}{marca}")

        info_text = "\n".join(info_lines)

        fig.text(
            0.02, 0.02,
            info_text,
            fontsize=7,
            va='bottom',
            ha='left',
            family='monospace',
            bbox=dict(boxstyle="round,pad=0.5", fc="#fff3cd", ec="#ffc107", alpha=0.95),
        )

    buf = io.BytesIO()
    fig.savefig(buf, format="png")
    plt.close(fig)
    buf.seek(0)

    grafico_data = "data:image/png;base64," + base64.b64encode(buf.read()).decode("ascii")

