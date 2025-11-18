#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Script principal de evaluación de normalidad (monoanalito).

Entrada (inyectada por el runner):
- pd (pandas)
- df_ingreso: DataFrame en formato ancho (columnas = parámetros / analistas)

Salida:
- df_resultado: DataFrame con resultados por columna:
  parametro, n, media, desviacion, asimetria, curtosis,
  p_value_shapiro, normal_shapiro

Implementación:
- Usa SciPy + statsmodels para el contraste de normalidad:
  * Shapiro-Wilk para 3 <= n <= 5000
  * Anderson-Darling (normal_ad) para n > 5000
"""

import math
import numpy as np
from scipy import stats as sps
from statsmodels.stats.diagnostic import normal_ad


def _to_numeric_series(pd, s):
  """Convierte a numérico y descarta NaN."""
  s2 = pd.to_numeric(s, errors="coerce")
  return s2.dropna()


def _safe_float(x):
  try:
    if x is None or (hasattr(x, "__len__") and len(getattr(x, "shape", ())) > 0):
      return float("nan")
    return float(x)
  except Exception:
    try:
      return float(x)
    except Exception:
      return float("nan")


def _skew(pd, s):
  try:
    return _safe_float(s.skew())
  except Exception:
    try:
      m = s.mean()
      sd = s.std(ddof=1)
      if sd == 0 or math.isnan(sd):
        return float("nan")
      z = ((s - m) / sd) ** 3
      return _safe_float(z.mean())
    except Exception:
      return float("nan")


def _kurtosis(pd, s):
  try:
    # pandas devuelve exceso de curtosis (Fisher); sumamos 3 para curtosis clásica
    k = s.kurtosis()
    if k is None or math.isnan(k):
      return float("nan")
    return _safe_float(k + 3.0)
  except Exception:
    try:
      m = s.mean()
      sd = s.std(ddof=1)
      if sd == 0 or math.isnan(sd):
        return float("nan")
      z2 = ((s - m) / sd) ** 4
      return _safe_float(z2.mean())
    except Exception:
      return float("nan")


# pd llega desde el runner como variable global
if "pd" not in globals() or pd is None:
  raise RuntimeError("pandas requerido no disponible en script principal")


cols = [c for c in df_ingreso.columns if str(c).strip()]
rows = []

for col in cols:
  s = _to_numeric_series(pd, df_ingreso[col])
  n = int(s.shape[0])

  if n == 0:
    rows.append({
      "parametro": str(col),
      "n": 0,
      "media": float("nan"),
      "desviacion": float("nan"),
      "asimetria": float("nan"),
      "curtosis": float("nan"),
      "p_value_shapiro": None,
      "normal_shapiro": None,
    })
    continue

  media = _safe_float(s.mean())
  desv = _safe_float(s.std(ddof=1))
  skew = _skew(pd, s)
  kurt = _kurtosis(pd, s)

  p_value = None
  normal = None

  # Vector numérico para SciPy / statsmodels
  values = np.asarray(s.values, dtype=float)

  try:
    if 3 <= n <= 5000:
      # Shapiro-Wilk
      _, p_value = sps.shapiro(values)
    else:
      # Anderson-Darling (statsmodels) devuelve (stat, pvalue)
      _, p_value = normal_ad(values)
    normal = bool(p_value >= 0.05)
  except Exception:
    p_value = None
    normal = None

  rows.append({
    "parametro": str(col),
    "n": n,
    "media": media,
    "desviacion": desv,
    "asimetria": skew,
    "curtosis": kurt,
    "p_value_shapiro": _safe_float(p_value) if p_value is not None else None,
    "normal_shapiro": normal,
  })


df_resultado = pd.DataFrame(rows)
try:
  df_resultado = df_resultado.sort_values(by=["parametro"]).reset_index(drop=True)
except Exception:
  pass

