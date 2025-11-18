#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Script gráfico para evaluación de normalidad (monoanalito).

Entrada (inyectada por el runner):
- pd (pandas)
- df_ingreso (DataFrame en formato ancho)
- df_resultado (salida del script principal)

Salida:
- Variable global `grafico_data` con un data URL SVG (image/svg+xml;base64,...)

Implementación:
- Usa SciPy (stats.probplot) para obtener los cuantiles teóricos del Q-Q plot.
- Genera SVG "a mano" (sin matplotlib) para minimizar dependencias.
"""

import base64
import math

from scipy import stats as sps


if "pd" not in globals() or pd is None:
  raise RuntimeError("pandas requerido no disponible en script gráfico")


def _compute_series(series):
  s = pd.to_numeric(series, errors="coerce").dropna()
  n = int(s.shape[0])
  if n < 3:
    return [], []

  # osm: ordered statistic medians (teóricos), osr: datos ordenados
  (osm, osr), _ = sps.probplot(s.values, dist="norm", plot=None)
  q_theoretical = [float(v) for v in osm]
  x_obs = [float(v) for v in osr]
  return q_theoretical, x_obs


def _minmax(seq):
  if not seq:
    return (0.0, 1.0)
  mn = min(seq)
  mx = max(seq)
  if mx - mn <= 1e-12:
    mx = mn + 1.0
  return (mn, mx)


def _scale(v, vmin, vmax, a, b):
  return a + (b - a) * ((v - vmin) / (vmax - vmin))


def _svg_escape(s):
  return (str(s)
          .replace("&", "&amp;")
          .replace("<", "&lt;")
          .replace(">", "&gt;")
          .replace('"', "&quot;"))


cols = [c for c in df_ingreso.columns if str(c).strip()]

series = []  # lista de (label, q_theo[], x_obs[])
for col in cols:
  q, y = _compute_series(df_ingreso[col])
  if q and y:
    series.append((str(col), q, y))

if not series:
  grafico_data = ""
else:
  # Lienzo
  W, H = 900, 540
  L, R, T, B = 80, 40, 40, 60  # márgenes
  plot_w = W - L - R
  plot_h = H - T - B

  # Rango combinado para ejes
  all_q = [v for _, q, _ in series for v in q]
  all_y = [v for _, _, y in series for v in y]
  xmin, xmax = _minmax(all_q)
  ymin, ymax = _minmax(all_y)

  # Ajustar a un rango común
  lo = min(xmin, ymin)
  hi = max(xmax, ymax)
  xmin = ymin = lo
  xmax = ymax = hi

  colors = [
    "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
    "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
  ]

  parts = []
  parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}">')
  parts.append('<rect x="0" y="0" width="100%" height="100%" fill="white"/>')
  parts.append(
    f'<text x="{W/2}" y="{T/2}" text-anchor="middle" font-size="18" '
    f'fill="#222" font-family="sans-serif">Q-Q Plot Normalidad (Monoanalito)</text>'
  )
  # Marco
  parts.append(
    f'<rect x="{L}" y="{T}" width="{plot_w}" height="{plot_h}" '
    f'fill="none" stroke="#333" stroke-width="1"/>'
  )

  # Ticks sencillos (5 divisiones)
  for i in range(6):
    tx = xmin + (xmax - xmin) * i / 5
    ty = ymin + (ymax - ymin) * i / 5
    sx = _scale(tx, xmin, xmax, L, L + plot_w)
    sy = _scale(ty, ymin, ymax, T + plot_h, T)
    parts.append(f'<line x1="{sx}" y1="{T+plot_h}" x2="{sx}" y2="{T+plot_h+5}" stroke="#333"/>')
    parts.append(
      f'<text x="{sx}" y="{T+plot_h+20}" text-anchor="middle" font-size="11" '
      f'fill="#333" font-family="monospace">{tx:.2f}</text>'
    )
    parts.append(f'<line x1="{L-5}" y1="{sy}" x2="{L}" y2="{sy}" stroke="#333"/>')
    parts.append(
      f'<text x="{L-10}" y="{sy+4}" text-anchor="end" font-size="11" '
      f'fill="#333" font-family="monospace">{ty:.2f}</text>'
    )

  # Línea y = x (ideal)
  x1 = _scale(xmin, xmin, xmax, L, L + plot_w)
  y1 = _scale(ymin, ymin, ymax, T + plot_h, T)
  x2 = _scale(xmax, xmin, xmax, L, L + plot_w)
  y2 = _scale(ymax, ymin, ymax, T + plot_h, T)
  parts.append(
    f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
    f'stroke="#888" stroke-dasharray="4,4"/>'
  )

  # Puntos por serie
  for idx, (label, q, y) in enumerate(series):
    color = colors[idx % len(colors)]
    for qi, yi in zip(q, y):
      sx = _scale(qi, xmin, xmax, L, L + plot_w)
      sy = _scale(yi, ymin, ymax, T + plot_h, T)
      parts.append(
        f'<circle cx="{sx:.2f}" cy="{sy:.2f}" r="2.2" fill="{color}" fill-opacity="0.85"/>'
      )

  # Leyenda
  lx, ly = L + 10, T + 10
  for idx, (label, _q, _y) in enumerate(series):
    color = colors[idx % len(colors)]
    parts.append(f'<rect x="{lx}" y="{ly + idx*18 - 9}" width="12" height="12" fill="{color}" />')
    parts.append(
      f'<text x="{lx+18}" y="{ly + idx*18}" font-size="12" fill="#111" '
      f'font-family="sans-serif">{_svg_escape(label)}</text>'
    )

  parts.append("</svg>")
  svg = "".join(parts)
  try:
    grafico_data = (
      "data:image/svg+xml;base64,"
      + base64.b64encode(svg.encode("utf-8")).decode("ascii")
    )
  except Exception:
    grafico_data = ""

