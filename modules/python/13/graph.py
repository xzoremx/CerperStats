# modules/python/13/graph.py

import io
import base64
import numpy as np
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

"""
Gráfico para Veracidad (Multianalito) con Rango de Aceptación Porcentual

Este script recibe datos ya filtrados por analito y nivel desde el servidor.
La estructura de df_ingreso es la misma que para monoanalito:
- Columnas = parámetros (ej: Analista 1, Analista 2, etc.)
- Filas = lecturas

Variable adicional disponible: `total_analitos` (cantidad total de analitos en la sesión)

Entrada:
- df_resultado: contiene veracidad, rango_min, rango_max, estado

Salida:
- grafico_data (PNG base64)
"""

if "pd" not in globals() or pd is None:
    raise RuntimeError("pandas requerido no disponible")

if "df_resultado" not in globals():
    raise RuntimeError("df_resultado requerido no disponible")

# Obtener total_analitos si está disponible
n_analitos = globals().get("total_analitos", 1)

df_plot = df_resultado.copy(deep=True)
if "parametro" not in df_plot.columns:
    raise RuntimeError("df_resultado inválido: falta columna 'parametro'")
if "veracidad" not in df_plot.columns:
    raise RuntimeError("df_resultado inválido: falta columna 'veracidad'")


def _first_non_null(series):
    try:
        s = series.dropna()
        return s.iloc[0] if len(s) else None
    except Exception:
        return None


rango_min = _first_non_null(df_plot["rango_min"]) if "rango_min" in df_plot.columns else None
rango_max = _first_non_null(df_plot["rango_max"]) if "rango_max" in df_plot.columns else None
metodo = _first_non_null(df_plot["metodo_veracidad"]) if "metodo_veracidad" in df_plot.columns else None
metodo = str(metodo) if metodo else "tendencia_central"
y_label = "Media" if metodo.lower() == "media" else "Mediana"

df_plot = df_plot.sort_values("parametro").reset_index(drop=True)
labels = df_plot["parametro"].astype(str).tolist()
y = pd.to_numeric(df_plot["veracidad"], errors="coerce").astype(float)
estado_values = df_plot["estado"].astype(str).tolist() if "estado" in df_plot.columns else [""] * len(df_plot)

colors = []
for estado in estado_values:
    if estado == "dentro_rango":
        colors.append("#16a34a")
    elif estado == "fuera_rango":
        colors.append("#dc2626")
    elif estado == "sin_datos":
        colors.append("#64748b")
    else:
        colors.append("#2563eb")

fig, ax = plt.subplots(figsize=(10, 6), dpi=100)
x = np.arange(len(labels))

ax.bar(x, y, color=colors, edgecolor="white", linewidth=0.8, alpha=0.9, zorder=2)

if rango_min is not None and rango_max is not None:
    try:
        rmin = float(rango_min)
        rmax = float(rango_max)
        if np.isfinite(rmin) and np.isfinite(rmax) and rmax > rmin:
            ax.axhspan(rmin, rmax, color=(16 / 255, 185 / 255, 129 / 255, 0.12), zorder=0)
            ax.axhline(rmin, color="#10b981", linestyle="--", linewidth=1, alpha=0.9)
            ax.axhline(rmax, color="#10b981", linestyle="--", linewidth=1, alpha=0.9)
    except Exception:
        pass

ax.set_xticks(x)
ax.set_xticklabels(labels, rotation=35, ha="right")
ax.set_ylabel(f"Veracidad ({y_label})")

# Título con nombre del analito si es multianalito
_analito = globals().get("current_analito")
if _analito:
    ax.set_title(f"Veracidad ({metodo}) por parámetro - {_analito}")
else:
    ax.set_title(f"Veracidad ({metodo}) por parámetro")

ax.grid(True, linestyle="--", alpha=0.25, axis="y", zorder=1)

info_lines = [f"Método: {metodo}"]
if rango_min is not None and rango_max is not None:
    try:
        info_lines.append(f"Rango: [{float(rango_min):g}, {float(rango_max):g}]")
    except Exception:
        pass

ax.text(
    0.99,
    0.95,
    "\n".join(info_lines),
    transform=ax.transAxes,
    fontsize=9,
    va="top",
    ha="right",
    bbox=dict(boxstyle="round,pad=0.4", fc="white", ec=(0, 0, 0, 0.15)),
)

fig.tight_layout()

buf = io.BytesIO()
fig.savefig(buf, format="png")
plt.close(fig)
buf.seek(0)

grafico_data = "data:image/png;base64," + base64.b64encode(buf.read()).decode("ascii")
