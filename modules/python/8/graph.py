# modules/python/8/graph.py

"""
Gráfico de Z-Scores para detección de atípicos (multianalito).

Este script recibe datos ya filtrados por analito y nivel desde el servidor.

Entrada (inyectada por el runner):
- pd (pandas)
- df_ingreso: DataFrame ancho

Salida:
- grafico_data: PNG base64 con gráfico radial/polar mostrando Z-scores.
  Los círculos de referencia marcan |Z| = 2 (cuestionable) y |Z| = 3 (atípico).
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

# Obtener total_analitos si está disponible (para multianalito)
n_analitos = globals().get("total_analitos", 1)


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


# --- Recolectar TODOS los datos para calcular media y DS global ---
all_values = []
col_data = []  # Guardar (columna, valores) para iterar después

for col in df_ingreso.columns:
    serie = pd.to_numeric(df_ingreso[col], errors="coerce").dropna()
    if len(serie) == 0:
        continue
    valores = serie.to_numpy(dtype=float)
    col_data.append((col, valores))
    all_values.extend(valores.tolist())

# Convertir a array para cálculos globales
all_values = np.array(all_values, dtype=float)

# Evaluar normalidad con TODOS los datos combinados
es_normal = evaluar_normalidad(all_values)

# Calcular estadísticos globales
if es_normal is None or not es_normal:
    mediana_global = np.median(all_values)
    mad_global = np.median(np.abs(all_values - mediana_global))
else:
    media_global = np.mean(all_values)
    ds_global = np.std(all_values, ddof=1)  # DESVEST() de Excel

# --- Procesar datos para el gráfico usando estadísticos globales ---
labels = []
zscores = []
colors = []

for col, valores in col_data:
    # Calcular Z-scores usando estadísticos GLOBALES
    if es_normal is None or not es_normal:
        if mad_global == 0:
            z_values = np.zeros_like(valores)
        else:
            z_values = 0.6745 * (valores - mediana_global) / mad_global
    else:
        if ds_global == 0:
            z_values = np.zeros_like(valores)
        else:
            z_values = (valores - media_global) / ds_global

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
            colors.append("#27ae60")  # Verde - Aceptable


if len(zscores) == 0:
    grafico_data = ""
else:
    # Dimensiones estándar consistentes con otros gráficos
    fig, ax = plt.subplots(figsize=(10, 6), dpi=100, subplot_kw=dict(projection='polar'))

    n_bars = len(labels)

    # Ángulos para cada barra (distribuidos uniformemente en el círculo)
    angles = np.linspace(0, 2 * np.pi, n_bars, endpoint=False)

    # Ancho de cada barra
    width = 2 * np.pi / n_bars * 0.8

    # Convertir Z-scores a valores absolutos para el radio (la dirección se indica con color)
    radii = np.abs(zscores)

    # Barras radiales
    bars = ax.bar(angles, radii, width=width, color=colors, edgecolor="white", alpha=0.85, linewidth=1)

    # Círculos de referencia
    max_radius = max(max(radii), 4.0)

    # Círculo Z=2 (cuestionable)
    theta_circle = np.linspace(0, 2 * np.pi, 100)
    ax.plot(theta_circle, [2] * 100, color="#f39c12", linestyle=":", linewidth=2, label="Cuestionable (|Z| = 2)")

    # Círculo Z=3 (atípico)
    ax.plot(theta_circle, [3] * 100, color="#e74c3c", linestyle="--", linewidth=2, label="Atípico (|Z| = 3)")

    # Configurar etiquetas angulares
    ax.set_xticks(angles)
    ax.set_xticklabels(labels, fontsize=7)

    # Configurar límites radiales
    ax.set_ylim(0, max_radius + 0.5)
    ax.set_yticks([1, 2, 3, 4])
    ax.set_yticklabels(['1', '2', '3', '4'], fontsize=8)

    ax.set_title("Evaluación de Atípicos — Z-Score (Multianalito)", fontsize=14, pad=20)

    # Leyenda: reservar espacio fijo a la derecha para evitar recortes y mantener
    # dimensiones constantes (sin bbox_inches='tight').
    legend_elements = [
        plt.Line2D([0], [0], color="#27ae60", marker='s', linestyle='', markersize=10, label='Aceptable (|Z| ≤ 2)'),
        plt.Line2D([0], [0], color="#f39c12", marker='s', linestyle='', markersize=10, label='Cuestionable (2 < |Z| ≤ 3)'),
        plt.Line2D([0], [0], color="#e74c3c", marker='s', linestyle='', markersize=10, label='Atípico (|Z| > 3)'),
        plt.Line2D([0], [0], color="#f39c12", linestyle=":", linewidth=2, label='Límite Z=2'),
        plt.Line2D([0], [0], color="#e74c3c", linestyle="--", linewidth=2, label='Límite Z=3'),
    ]
    fig.tight_layout(rect=[0, 0, 0.78, 1])
    ax.legend(handles=legend_elements, loc='upper left', bbox_to_anchor=(1.02, 1), fontsize=8, borderaxespad=0)

    ax.grid(True, linestyle="--", alpha=0.3)

    buf = io.BytesIO()
    fig.savefig(buf, format="png")
    plt.close(fig)
    buf.seek(0)

    try:
        grafico_data = "data:image/png;base64," + base64.b64encode(buf.read()).decode("ascii")
    except Exception:
        grafico_data = ""
