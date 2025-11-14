#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Script gráfico para evaluación de normalidad (monoanalito).

Requiere en el entorno (inyectado por el runner):
- pd, np (opcional), math, statistics
- df_ingreso (DataFrame en formato ancho)
- df_resultado, resultado_pc (del script principal)

Produce:
- Variable global `grafico_data` como data URL (image/svg+xml;base64,...)

Implementación:
- Genera un gráfico Q-Q combinado (una serie por columna) como SVG puro
  sin dependencias externas (matplotlib), para robustez en entornos mínimos.
"""

import base64
import math

# pd llega desde el runner
if 'pd' not in globals() or pd is None:
    raise RuntimeError("pandas requerido no disponible en script gráfico")

np_local = globals().get('np', None)


# Aproximación del inverso de la normal estándar (Beasley-Springer-Moro / Acklam)
def _inv_norm_cdf(p: float) -> float:
    if p <= 0.0:
        return float('-inf')
    if p >= 1.0:
        return float('inf')
    # Coeficientes de Peter John Acklam
    a = [-3.969683028665376e+01,  2.209460984245205e+02,
         -2.759285104469687e+02,  1.383577518672690e+02,
         -3.066479806614716e+01,  2.506628277459239e+00]
    b = [-5.447609879822406e+01,  1.615858368580409e+02,
         -1.556989798598866e+02,  6.680131188771972e+01,
         -1.328068155288572e+01]
    c = [-7.784894002430293e-03, -3.223964580411365e-01,
         -2.400758277161838e+00, -2.549732539343734e+00,
          4.374664141464968e+00,  2.938163982698783e+00]
    d = [ 7.784695709041462e-03,  3.224671290700398e-01,
          2.445134137142996e+00,  3.754408661907416e+00]
    plow  = 0.02425
    phigh = 1 - plow
    if p < plow:
        q = math.sqrt(-2 * math.log(p))
        return (((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) / \
               ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1)
    if phigh < p:
        q = math.sqrt(-2 * math.log(1 - p))
        return -(((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) / \
                 ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1)
    q = p - 0.5
    r = q*q
    return (((((a[0]*r + a[1])*r + a[2])*r + a[3])*r + a[4])*r + a[5]) * q / \
           (((((b[0]*r + b[1])*r + b[2])*r + b[3])*r + b[4])*r + 1)


def _compute_series(pd, series):
    s = pd.to_numeric(series, errors='coerce').dropna()
    n = int(s.shape[0])
    if n < 3:
        return [], []
    x_sorted = s.sort_values().reset_index(drop=True)
    mu = float(x_sorted.mean())
    sd = float(x_sorted.std(ddof=1))
    if not (sd > 0) or math.isnan(sd):
        sd = 1.0
    # Probabilidades para orden 1..n
    ps = [ (i + 0.5) / n for i in range(n) ]
    zs = [ _inv_norm_cdf(p) for p in ps ]
    # Cuantiles teóricos
    q_theoretical = [ mu + sd * z for z in zs ]
    return q_theoretical, list(map(float, x_sorted.values))


def _minmax(seq):
    if not seq:
        return (0.0, 1.0)
    mn = min(seq)
    mx = max(seq)
    if mx - mn <= 1e-12:
        mx = mn + 1.0
    return (mn, mx)


def _scale(v, vmin, vmax, a, b):
    # lineal a -> b
    return a + (b - a) * ( (v - vmin) / (vmax - vmin) )


def _svg_escape(s):
    return (str(s)
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;'))


cols = [c for c in df_ingreso.columns if str(c).strip()]

series = []  # lista de (label, q_theo[], x_obs[])
for col in cols:
    q, y = _compute_series(pd, df_ingreso[col])
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

    # Ejes + fondo
    parts = []
    parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}">')
    parts.append('<rect x="0" y="0" width="100%" height="100%" fill="white"/>')
    parts.append(f'<text x="{W/2}" y="{T/2}" text-anchor="middle" font-size="18" fill="#222" font-family="sans-serif">Q-Q Plot Normalidad (Monoanalito)</text>')
    # Marco
    parts.append(f'<rect x="{L}" y="{T}" width="{plot_w}" height="{plot_h}" fill="none" stroke="#333" stroke-width="1"/>')

    # Ticks sencillos (5 divisiones)
    for i in range(6):
        tx = xmin + (xmax - xmin) * i / 5
        ty = ymin + (ymax - ymin) * i / 5
        sx = _scale(tx, xmin, xmax, L, L + plot_w)
        sy = _scale(ty, ymin, ymax, T + plot_h, T)
        parts.append(f'<line x1="{sx}" y1="{T+plot_h}" x2="{sx}" y2="{T+plot_h+5}" stroke="#333"/>')
        parts.append(f'<text x="{sx}" y="{T+plot_h+20}" text-anchor="middle" font-size="11" fill="#333" font-family="monospace">{tx:.2f}</text>')
        parts.append(f'<line x1="{L-5}" y1="{sy}" x2="{L}" y2="{sy}" stroke="#333"/>')
        parts.append(f'<text x="{L-10}" y="{sy+4}" text-anchor="end" font-size="11" fill="#333" font-family="monospace">{ty:.2f}</text>')

    # Línea y = x (ideal)
    x1 = _scale(xmin, xmin, xmax, L, L + plot_w)
    y1 = _scale(ymin, ymin, ymax, T + plot_h, T)
    x2 = _scale(xmax, xmin, xmax, L, L + plot_w)
    y2 = _scale(ymax, ymin, ymax, T + plot_h, T)
    parts.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#888" stroke-dasharray="4,4"/>')

    # Puntos por serie
    for idx, (label, q, y) in enumerate(series):
        color = colors[idx % len(colors)]
        dots = []
        for qi, yi in zip(q, y):
            sx = _scale(qi, xmin, xmax, L, L + plot_w)
            sy = _scale(yi, ymin, ymax, T + plot_h, T)
            dots.append(f'<circle cx="{sx:.2f}" cy="{sy:.2f}" r="2.2" fill="{color}" fill-opacity="0.85"/>')
        parts.extend(dots)
    
    # Leyenda
    lx, ly = L + 10, T + 10
    for idx, (label, _q, _y) in enumerate(series):
        color = colors[idx % len(colors)]
        parts.append(f'<rect x="{lx}" y="{ly + idx*18 - 9}" width="12" height="12" fill="{color}" />')
        parts.append(f'<text x="{lx+18}" y="{ly + idx*18}" font-size="12" fill="#111" font-family="sans-serif">{_svg_escape(label)}</text>')

    parts.append('</svg>')
    svg = "".join(parts)
    try:
        grafico_data = "data:image/svg+xml;base64," + base64.b64encode(svg.encode('utf-8')).decode('ascii')
    except Exception:
        grafico_data = ""

