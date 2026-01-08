# modules/python/4/graph.py

"""
Histograma de normalidad (multianalito).

Este script recibe datos ya filtrados por analito y nivel desde el servidor.
La estructura de df_ingreso es la misma que para monoanalito:
- Columnas = parámetros
- Filas = lecturas

Variable adicional disponible: `total_analitos` (cantidad total de analitos en la sesión)

Entrada (inyectada por el runner):
- pd (pandas)
- df_ingreso: DataFrame ancho
- total_analitos: int (opcional)

Salida:
- grafico_data: PNG base64 con título, ejes y leyenda.
"""

import io
import base64

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np


if "pd" not in globals() or pd is None:
    raise RuntimeError("pandas requerido no disponible en script gráfico")

# Obtener total_analitos si está disponible
n_analitos = globals().get("total_analitos", 1)

cols = [c for c in df_ingreso.columns if str(c).strip()]

values = []
for col in cols:
    data = pd.to_numeric(df_ingreso[col], errors="coerce").dropna()
    values.extend(data.tolist())

if not values:
    grafico_data = ""
else:
    arr = np.array(values, dtype=float)
    mean = float(arr.mean())
    std = float(arr.std(ddof=1)) if arr.size > 1 else 0.0

    # Dimensiones estándar (consistentes entre informes)
    fig, ax = plt.subplots(figsize=(10, 6), dpi=100)
    ax.hist(arr, bins=10, density=True, alpha=0.75, label="Histograma", color="#2ecc71", edgecolor="white")

    if std > 0:
        x = np.linspace(arr.min(), arr.max(), 200)
        y = (1 / (std * np.sqrt(2 * np.pi))) * np.exp(-0.5 * ((x - mean) / std) ** 2)
        ax.plot(x, y, color="#e74c3c", linewidth=2, label="N(μ,σ) teórica")

    # Título diferenciado para multianalito
    title = "Histograma de resultados (Multianalito)"
    ax.set_title(title, fontsize=14)
    ax.set_xlabel("Valor observado", fontsize=12)
    ax.set_ylabel("Densidad", fontsize=12)
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
