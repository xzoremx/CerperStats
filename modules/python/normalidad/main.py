#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Script principal de evaluación de normalidad (monoanalito).

Entrada (inyectada por el runner):
- pd (pandas), np (numpy opcional), math, statistics
- df_ingreso: DataFrame en formato ancho (columnas = parámetros/analistas)
- df_raw: copia del df_ingreso base

Salida requerida por el runner:
- df_resultado: DataFrame con resultados por columna

Notas:
- Si SciPy está disponible, usa Shapiro-Wilk para p_value y decisión.
- Si no, calcula métricas (media, desvío, asimetría, curtosis) y deja p_value como None.
"""

import math

try:
    import numpy as _np  # local import por si el runner no pasó np
except Exception:
    _np = None

try:
    from scipy import stats as _sps  # opcional
except Exception:  # pragma: no cover
    _sps = None


def _to_numeric_series(pd, s):
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
        # pandas ya devuelve Fisher por defecto (exceso); sumamos 3 para kurtosis clásica
        k = s.kurtosis()  # exceso
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
if 'pd' not in globals() or pd is None:
    raise RuntimeError("pandas requerido no disponible en script principal")

np = _np if _np is not None else globals().get('np', None)

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
    if _sps is not None:
        try:
            # Shapiro-Wilk es válido 3 <= n <= 5000
            if 3 <= n <= 5000:
                _, p_value = _sps.shapiro(s.values)
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

