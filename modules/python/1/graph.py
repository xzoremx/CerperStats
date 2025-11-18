#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Script gráfico de normalidad (monoanalito) utilizando matplotlib.

Entrada (inyectada por el runner):
- pd (pandas)
- df_ingreso: DataFrame ancho
- df_resultado: DataFrame de salida del módulo

Salida:
- grafico_data: PNG base64 con título, ejes y leyenda.
"""

import io
import base64

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from scipy import stats as sps


if "pd" not in globals() or pd is None:
    raise RuntimeError("pandas requerido no disponible en script gráfico")


def _compute_series(series):
    s = pd.to_numeric(series, errors="coerce").dropna()
    n = int(s.shape[0])
    if n < 3:
        return [], [], None, None

    (osm, osr), (slope, intercept, _) = sps.probplot(s.values, dist="norm", plot=None)
    q_theoretical = [float(v) for v in osm]
    x_obs = [float(v) for v in osr]
    return q_theoretical, x_obs, slope, intercept


cols = [c for c in df_ingreso.columns if str(c).strip()]

series = []
for col in cols:
    q, y, slope, intercept = _compute_series(df_ingreso[col])
    if q and y:
        series.append((str(col), q, y, slope, intercept))

if not series:
    grafico_data = ""
else:
    fig, ax = plt.subplots(figsize=(9, 5.4), dpi=100)
    colormap = plt.cm.get_cmap("tab10")

    for idx, (label, q, y, slope, intercept) in enumerate(series):
        color = colormap(idx % colormap.N)
        ax.scatter(q, y, s=18, alpha=0.85, label=label, color=color, edgecolors="none")
        line_x = [min(q), max(q)]
        line_y = [slope * v + intercept for v in line_x]
        ax.plot(line_x, line_y, linestyle="--", linewidth=1, color=color)

    ax.set_title("Q-Q Plot de Normalidad", fontsize=14)
    ax.set_xlabel("Cuantiles teóricos N(0,1)", fontsize=12)
    ax.set_ylabel("Cuantiles observados", fontsize=12)
    ax.grid(True, linestyle="--", alpha=0.3)
    ax.legend(loc="best", fontsize=8)

    fig.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png")
    plt.close(fig)
    buf.seek(0)

    try:
        grafico_data = "data:image/png;base64," + base64.b64encode(buf.read()).decode("ascii")
    except Exception:
        grafico_data = ""
