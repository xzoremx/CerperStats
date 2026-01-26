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
- df_ingreso: DataFrame con columnas = parámetros y filas = réplicas
- df_resultado: 1 fila con rsd_teorico, estado, rsd_experimental, rsd_r, rsd_R, n (resumen global)

Reglas:
- Calcular RSD% por parámetro (columna) y graficarlo con etiquetas numéricas
- Dibujar línea del RSD teórico si existe
- Mostrar resumen global (RSDexp, RSDr, RSDR) + conteos de estado

Salida:
- grafico_data (PNG base64)
"""

if "pd" not in globals() or pd is None:
    raise RuntimeError("pandas requerido no disponible")

if "df_ingreso" not in globals():
    raise RuntimeError("df_ingreso requerido no disponible")

if "df_resultado" not in globals():
    raise RuntimeError("df_resultado requerido no disponible")

df_plot = df_resultado.copy(deep=True)


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

thr = None
try:
    thr = float(rsd_teorico) if rsd_teorico is not None else None
except Exception:
    thr = None
thr_ok = thr is not None and np.isfinite(thr) and thr > 0

rows = []
for col in df_ingreso.columns:
    serie = pd.to_numeric(df_ingreso[col], errors="coerce").dropna()
    n = int(len(serie))
    if n == 0:
        rows.append({"parametro": col, "n": n, "rsd_pct": np.nan, "estado": "sin_datos"})
        continue

    mean_val = float(serie.mean())
    std_val = float(serie.std(ddof=1)) if n > 1 else np.nan

    rsd_pct = None
    if n > 1 and np.isfinite(mean_val) and mean_val != 0 and np.isfinite(std_val) and std_val >= 0:
        rsd_pct = (std_val / abs(mean_val)) * 100.0

    if not thr_ok:
        estado = "config_no_valida"
    elif rsd_pct is None:
        estado = "no_evaluable"
    elif rsd_pct <= thr:
        estado = "cumple"
    else:
        estado = "no_cumple"

    rows.append({
        "parametro": col,
        "n": n,
        "rsd_pct": np.nan if rsd_pct is None else float(rsd_pct),
        "estado": estado,
    })

df_bars = pd.DataFrame(rows).sort_values("parametro").reset_index(drop=True)
labels = df_bars["parametro"].astype(str).tolist()
y_raw = pd.to_numeric(df_bars["rsd_pct"], errors="coerce").astype(float).to_numpy()
estado_values = df_bars["estado"].astype(str).tolist()
ns_values = df_bars["n"].astype(int).tolist()

colors = []
for estado in estado_values:
    if estado == "cumple":
        colors.append("#16a34a")
    elif estado == "no_cumple":
        colors.append("#dc2626")
    elif estado == "sin_datos":
        colors.append("#64748b")
    elif estado in ("no_evaluable", "config_no_valida"):
        colors.append("#f59e0b")
    else:
        colors.append("#2563eb")

fig, ax = plt.subplots(figsize=(10, 6), dpi=100)
x = np.arange(len(labels))

y_plot = np.nan_to_num(y_raw, nan=0.0, posinf=0.0, neginf=0.0)
ax.bar(x, y_plot, color=colors, edgecolor="white", linewidth=0.8, alpha=0.9, zorder=2)

max_y = 0.0
try:
    max_y = float(np.nanmax(y_raw)) if y_raw.size else 0.0
except Exception:
    max_y = 0.0
if thr_ok:
    max_y = max(max_y, float(thr))
if not np.isfinite(max_y) or max_y <= 0:
    max_y = 1.0
offset = max_y * 0.02

for xi, yi, n_i, estado in zip(x, y_raw, ns_values, estado_values):
    if np.isfinite(yi):
        label_txt = f"{yi:.4f}%\n(n={n_i})"
        y_text = float(yi) + offset
    else:
        label_txt = f"—\n(n={n_i})"
        y_text = offset
    ax.text(xi, y_text, label_txt, ha="center", va="bottom", fontsize=8, color="#0f172a")

if thr_ok:
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

ax.set_xticks(x)
ax.set_xticklabels(labels, rotation=35, ha="right")
ax.set_ylabel("RSD (%)")
ax.set_title("Precisión (RSD%) por parámetro")
ax.grid(True, linestyle="--", alpha=0.25, axis="y", zorder=1)

info_lines = []
if "n" in df_plot.columns:
    n_total = _first_non_null(df_plot["n"])
    if n_total is not None:
        info_lines.append(f"N: {n_total}")
try:
    info_lines.append(f"Parámetros: {len(labels)}")
    info_lines.append(f"Cumple: {estado_values.count('cumple')}  No cumple: {estado_values.count('no_cumple')}")
    info_lines.append(
        f"No eval: {estado_values.count('no_evaluable')}  Sin datos: {estado_values.count('sin_datos')}"
    )
    if estado_values.count("config_no_valida") > 0:
        info_lines.append(f"Config. inválida: {estado_values.count('config_no_valida')}")
except Exception:
    pass
if rsd_experimental is not None:
    try:
        info_lines.append(f"RSDexp: {float(rsd_experimental):.4f}%")
    except Exception:
        pass
if rsd_r is not None:
    try:
        info_lines.append(f"RSDr: {float(rsd_r):.4f}%")
    except Exception:
        pass
if rsd_R is not None:
    try:
        info_lines.append(f"RSDR: {float(rsd_R):.4f}%")
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
