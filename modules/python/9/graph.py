# modules/python/3/graph.py

import io
import base64
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

"""
Gráfico para Tendencia Central (Monoanalito) con Rango de Aceptación

Entrada:
- df_ingreso
- df_resultado: contiene tendencia_central, metodo_tendencia, estado, rango_min, rango_max

Reglas:
- Mostrar la tendencia central (media/mediana) por parámetro
- Dibujar el rango de aceptación (mín/max) si está disponible

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


df_plot = df_resultado.copy(deep=True)
if "parametro" not in df_plot.columns:
    raise RuntimeError("df_resultado inválido: falta columna 'parametro'")

# Determinar rango (si existe)
def _first_non_null(series):
    try:
        s = series.dropna()
        return s.iloc[0] if len(s) else None
    except Exception:
        return None

rango_min = _first_non_null(df_plot["rango_min"]) if "rango_min" in df_plot.columns else None
rango_max = _first_non_null(df_plot["rango_max"]) if "rango_max" in df_plot.columns else None

metodo = _first_non_null(df_plot["metodo_tendencia"]) if "metodo_tendencia" in df_plot.columns else None
metodo = str(metodo) if metodo else "tendencia_central"
y_label = "Media" if metodo.lower() == "media" else "Mediana"

normalidad_global = _first_non_null(df_plot["normalidad_global"]) if "normalidad_global" in df_plot.columns else None
p_value_norm = _first_non_null(df_plot["p_value_normalidad_global"]) if "p_value_normalidad_global" in df_plot.columns else None
prueba_norm = _first_non_null(df_plot["prueba_normalidad_global"]) if "prueba_normalidad_global" in df_plot.columns else None

# Extraer valores (drop rows sin datos de tendencia)
df_plot = df_plot.sort_values("parametro").reset_index(drop=True)
parametros = df_plot["parametro"].astype(str).tolist()
tc_values = df_plot["tendencia_central"] if "tendencia_central" in df_plot.columns else None
if tc_values is None:
    raise RuntimeError("df_resultado inválido: falta columna 'tendencia_central'")

tc_values = tc_values.astype(float)
estado_values = df_plot["estado"].astype(str).tolist() if "estado" in df_plot.columns else [""] * len(df_plot)

colors = []
for estado in estado_values:
    if estado == "dentro_rango":
        colors.append("#16a34a")  # green
    elif estado == "fuera_rango":
        colors.append("#dc2626")  # red
    elif estado == "sin_datos":
        colors.append("#64748b")  # slate
    else:
        colors.append("#2563eb")  # blue

fig, ax = plt.subplots(figsize=(11, 6), dpi=110)
x = np.arange(len(parametros))

ax.scatter(x, tc_values, c=colors, s=55, edgecolors="white", linewidths=0.8, zorder=3)
ax.plot(x, tc_values, color=(59 / 255, 130 / 255, 246 / 255, 0.25), linewidth=1, zorder=2)

if rango_min is not None and rango_max is not None:
    try:
        rmin = float(rango_min)
        rmax = float(rango_max)
        if np.isfinite(rmin) and np.isfinite(rmax) and rmax > rmin:
            ax.axhspan(rmin, rmax, color=(16 / 255, 185 / 255, 129 / 255, 0.12), zorder=0)
            ax.axhline(rmin, color="#10b981", linestyle="--", linewidth=1, alpha=0.9)
            ax.axhline(rmax, color="#10b981", linestyle="--", linewidth=1, alpha=0.9)
            ax.text(
                0.01,
                0.02,
                f"Rango aceptación: [{rmin:g}, {rmax:g}]",
                transform=ax.transAxes,
                fontsize=9,
                va="bottom",
                ha="left",
                bbox=dict(boxstyle="round,pad=0.3", fc="white", ec=(0, 0, 0, 0.15)),
            )
    except Exception:
        pass

ax.set_xticks(x)
ax.set_xticklabels(parametros, rotation=35, ha="right")
ax.set_ylabel(y_label)
ax.set_title(f"Tendencia central ({metodo}) por parámetro")
ax.grid(True, linestyle="--", alpha=0.25, zorder=1)

# Caja con info de normalidad global
normalidad_text = ""
if normalidad_global == "normal_dist":
    normalidad_text = "Normalidad global: Normal"
elif normalidad_global == "no_normal_dist":
    normalidad_text = "Normalidad global: NO normal"
else:
    normalidad_text = "Normalidad global: N/A"

if prueba_norm:
    normalidad_text += f"\nPrueba: {prueba_norm}"
if p_value_norm is not None:
    try:
        normalidad_text += f"\np-value: {float(p_value_norm):.4f}"
    except Exception:
        pass

ax.text(
    0.99,
    0.95,
    normalidad_text,
    transform=ax.transAxes,
    fontsize=9,
    va="top",
    ha="right",
    bbox=dict(boxstyle="round,pad=0.4", fc="white", ec=(0, 0, 0, 0.15)),
)

fig.tight_layout()


# -------------------------
# Convertir a base64
# -------------------------
buf = io.BytesIO()
fig.savefig(buf, format="png")
plt.close(fig)
buf.seek(0)

grafico_data = "data:image/png;base64," + base64.b64encode(buf.read()).decode("ascii")
