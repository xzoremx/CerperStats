# modules/python/7/graph.py

"""
Gráfico de Z-Scores para detección de atípicos (monoanalito).

Entrada (inyectada por el runner):
- pd (pandas)
- df_ingreso: DataFrame ancho

Salida:
- grafico_data: PNG base64 con gráfico de barras horizontales mostrando Z-scores.
  Las líneas de referencia marcan |Z| = 2 (cuestionable) y |Z| = 3 (atípico).
"""

import io
import base64
import numpy as np

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

from scipy import stats as sps
from statsmodels.stats.diagnostic import normal_ad


if "pd" not in globals() or pd is None:
    raise RuntimeError("pandas requerido no disponible en script gráfico")


def evaluar_normalidad(valores):
    """Evalúa normalidad según el tamaño de muestra."""
    n = len(valores)
    if n < 3:
        return None
    
    if 3 <= n <= 7:
        stat, p = sps.shapiro(valores)
    else:
        stat, p = normal_ad(valores)
    
    return p >= 0.05


def calcular_zscore_clasico(valores):
    """Calcula Z-score clásico: (x - media) / desv_std"""
    media = np.mean(valores)
    desv = np.std(valores, ddof=1)
    if desv == 0:
        return np.zeros_like(valores)
    return (valores - media) / desv


def calcular_zscore_robusto(valores):
    """Calcula Z-score robusto: 0.6745 * (x - mediana) / MAD"""
    mediana = np.median(valores)
    mad = np.median(np.abs(valores - mediana))
    if mad == 0:
        return np.zeros_like(valores)
    return 0.6745 * (valores - mediana) / mad


# --- Procesar datos para el gráfico ---
labels = []
zscores = []
colors = []

for col in df_ingreso.columns:
    serie = pd.to_numeric(df_ingreso[col], errors="coerce").dropna()
    n = len(serie)
    
    if n == 0:
        continue
    
    valores = serie.to_numpy(dtype=float)
    
    # Evaluar normalidad para decidir el método
    es_normal = evaluar_normalidad(valores)
    
    if es_normal is None or not es_normal:
        z_values = calcular_zscore_robusto(valores)
    else:
        z_values = calcular_zscore_clasico(valores)
    
    for i, z in enumerate(z_values, start=1):
        labels.append(f"{col} - L{i}")
        zscores.append(float(z))
        
        # Colorear según categoría
        abs_z = abs(z)
        if abs_z > 3:
            colors.append("#e74c3c")  # Rojo - Atípico
        elif abs_z > 2:
            colors.append("#f39c12")  # Naranja - Cuestionable
        else:
            colors.append("#27ae60")  # Verde - Normal


if len(zscores) == 0:
    grafico_data = ""
else:
    fig, ax = plt.subplots(figsize=(10, max(6, len(zscores) * 0.35)), dpi=100)
    
    y_pos = np.arange(len(labels))
    
    # Barras horizontales
    bars = ax.barh(y_pos, zscores, color=colors, edgecolor="white", alpha=0.85)
    
    # Líneas de referencia
    ax.axvline(x=3, color="#e74c3c", linestyle="--", linewidth=1.5, label="Atípico (|Z| > 3)")
    ax.axvline(x=-3, color="#e74c3c", linestyle="--", linewidth=1.5)
    ax.axvline(x=2, color="#f39c12", linestyle=":", linewidth=1.5, label="Cuestionable (|Z| > 2)")
    ax.axvline(x=-2, color="#f39c12", linestyle=":", linewidth=1.5)
    ax.axvline(x=0, color="#2c3e50", linestyle="-", linewidth=0.8, alpha=0.5)
    
    ax.set_yticks(y_pos)
    ax.set_yticklabels(labels, fontsize=8)
    ax.set_xlabel("Z-Score", fontsize=12)
    ax.set_title("Evaluación de Atípicos — Z-Score", fontsize=14)
    
    ax.legend(loc="upper right", fontsize=8)
    ax.grid(True, axis="x", linestyle="--", alpha=0.3)
    
    # Ajustar límites para mostrar líneas de referencia
    max_abs_z = max(abs(min(zscores)), abs(max(zscores)), 3.5)
    ax.set_xlim(-max_abs_z - 0.5, max_abs_z + 0.5)
    
    fig.tight_layout()
    
    buf = io.BytesIO()
    fig.savefig(buf, format="png")
    plt.close(fig)
    buf.seek(0)
    
    try:
        grafico_data = "data:image/png;base64," + base64.b64encode(buf.read()).decode("ascii")
    except Exception:
        grafico_data = ""
