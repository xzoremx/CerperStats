# modules/python/11/graph.py

import io
import base64
import numpy as np
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

"""
Gráfico para Precisión (RSD%) con Umbral Teórico

Entrada:
- df_resultado: contiene rsd_pct, rsd_teorico, estado

Reglas:
- Mostrar RSD (%) por parámetro (Analista X)
- Dibujar línea del RSD teórico

Salida:
- grafico_data (PNG base64)
"""

if "pd" not in globals() or pd is None:
    raise RuntimeError("pandas requerido no disponible")

if "df_resultado" not in globals():
    raise RuntimeError("df_resultado requerido no disponible")

df_plot = df_resultado.copy(deep=True)
if "parametro" not in df_plot.columns:
    raise RuntimeError("df_resultado inválido: falta columna 'parametro'")
if "rsd_pct" not in df_plot.columns:
    raise RuntimeError("df_resultado inválido: falta columna 'rsd_pct'")


def _first_non_null(series):
    try:
        s = series.dropna()
        return s.iloc[0] if len(s) else None
    except Exception:
        return None


rsd_teorico = _first_non_null(df_plot["rsd_teorico"]) if "rsd_teorico" in df_plot.columns else None
rsd_experimental = _first_non_null(df_plot["rsd_experimental"]) if "rsd_experimental" in df_plot.columns else None
rsd_r = _first_non_null(df_plot["rsd_r"]) if "rsd_r" in df_plot.columns else None
rsd_R = _first_non_null(df_plot["rsd_R"]) if "rsd_R" in df_plot.columns else None

df_plot = df_plot.sort_values("parametro").reset_index(drop=True)
labels = df_plot["parametro"].astype(str).tolist()
y = pd.to_numeric(df_plot["rsd_pct"], errors="coerce").astype(float)
estado_values = df_plot["estado"].astype(str).tolist() if "estado" in df_plot.columns else [""] * len(df_plot)

colors = []
for estado in estado_values:
    if estado == "cumple":
        colors.append("#16a34a")
    elif estado == "no_cumple":
        colors.append("#dc2626")
    elif estado == "sin_datos":
        colors.append("#64748b")
    elif estado == "no_evaluable":
        colors.append("#f59e0b")
    else:
        colors.append("#2563eb")

fig, ax = plt.subplots(figsize=(11, 6), dpi=110)
x = np.arange(len(labels))

ax.bar(x, y, color=colors, edgecolor="white", linewidth=0.8, alpha=0.9, zorder=2)

if rsd_teorico is not None:
    try:
        thr = float(rsd_teorico)
        if np.isfinite(thr) and thr > 0:
            ax.axhline(thr, color="#8b5cf6", linestyle="--", linewidth=1.2, alpha=0.95, zorder=3)
            ax.text(
                0.01,
                0.98,
                f"RSD Teórico: {thr:g}%",
                transform=ax.transAxes,
                fontsize=9,
                va="top",
                ha="left",
                bbox=dict(boxstyle="round,pad=0.3", fc="white", ec=(0, 0, 0, 0.15)),
            )
    except Exception:
        pass

ax.set_xticks(x)
ax.set_xticklabels(labels, rotation=35, ha="right")
ax.set_ylabel("RSD (%)")
ax.set_title("Precisión (RSD%) por parámetro")
ax.grid(True, linestyle="--", alpha=0.25, axis="y", zorder=1)

info_lines = []
if rsd_experimental is not None:
    try:
        info_lines.append(f"RSDexp: {float(rsd_experimental):.2f}%")
    except Exception:
        pass
if rsd_r is not None:
    try:
        info_lines.append(f"RSDr: {float(rsd_r):.2f}%")
    except Exception:
        pass
if rsd_R is not None:
    try:
        info_lines.append(f"RSDR: {float(rsd_R):.2f}%")
    except Exception:
        pass

if info_lines:
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

