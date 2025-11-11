# modules/_common/eval_runner_secure.py
import sys
import os
import json
import traceback
import ast
import importlib
import platform
import pandas as pd
import math
import statistics
try:
    import numpy as np  # opcional
except Exception:  # pragma: no cover
    np = None
try:
    import resource  # Unix only
except Exception:  # pragma: no cover
    resource = None
def _apply_resource_limits():
    """Apply OS-level limits to this Python process when available (Unix)."""
    try:
        if resource is None:
            return
        # CPU seconds
        resource.setrlimit(resource.RLIMIT_CPU, (5, 5))
        # Max address space ~512MB
        resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
        # Max file size 0 (no file writes)
        resource.setrlimit(resource.RLIMIT_FSIZE, (0, 0))
    except Exception:
        pass


def _inject_vendor_paths():
    """Add vendor site-packages (per-platform) to sys.path if present."""
    base = os.path.dirname(__file__)
    vendor = os.path.join(base, 'vendor')
    candidates = []
    plat = sys.platform
    machine = platform.machine().lower()
    if plat.startswith('win'):
        tag = 'win_arm64' if 'arm' in machine else ('win_amd64' if '64' in machine else 'win32')
        candidates += [os.path.join(vendor, tag)]
    elif plat == 'darwin':
        tag = 'mac_arm64' if 'arm' in machine or 'aarch64' in machine else 'mac_x86_64'
        candidates += [os.path.join(vendor, tag)]
    elif 'linux' in plat:
        tag = 'linux_aarch64' if 'aarch64' in machine or 'arm' in machine else 'linux_x86_64'
        candidates += [os.path.join(vendor, tag)]
    candidates += [vendor]  # fallback
    for p in candidates:
        if os.path.isdir(p) and p not in sys.path:
            sys.path.insert(0, p)


def construir_dataframe_desde_json(df_data, tipo_analisis):
    """Construye el DataFrame de ingreso desde los datos JSON enviados por main.js"""
    df = pd.DataFrame(df_data)
    # No insertar columnas sintéticas como 'analito' en mono; dejar solo lo enviado
    if "valor" in df.columns:
        df["valor"] = pd.to_numeric(df["valor"], errors="coerce")
    return df


FORBIDDEN_NAMES = {
    '__import__', 'eval', 'exec', 'compile', 'open', 'input', 'globals', 'locals',
    'vars', 'getattr', 'setattr', 'delattr', '__loader__', '__spec__', '__package__',
    '__builtins__', '__class__', '__subclasses__', '__mro__', '__dict__', '__code__',
}

SAFE_BUILTINS = {
    'len': len, 'range': range, 'min': min, 'max': max, 'sum': sum, 'abs': abs,
    'float': float, 'int': int, 'str': str, 'bool': bool,
    'list': list, 'dict': dict, 'set': set, 'tuple': tuple,
    'enumerate': enumerate, 'zip': zip, 'sorted': sorted,
}

ALLOWED_GLOBALS = {
    'pd': pd,
    'np': np,
    'math': math,
    'statistics': statistics,
}


ALLOWED_IMPORT_PREFIXES = (
    'numpy', 'pandas', 'scipy', 'statsmodels',
    'scipy.stats', 'statsmodels.stats', 'statsmodels.stats.diagnostic',
)


def _validate_code(code: str, nombre: str):
    if not isinstance(code, str):
        return "Código no es string"
    if len(code) > 20000:
        return f"Código demasiado largo para {nombre}"
    try:
        tree = ast.parse(code, mode='exec')
    except SyntaxError as e:
        return f"Sintaxis inválida: {e}"

    for node in ast.walk(tree):
        # Importaciones: permitir solo las prefijadas (numpy, pandas, scipy, statsmodels)
        if isinstance(node, ast.Import):
            for alias in node.names:
                mod = alias.name or ''
                if not any(mod == p or mod.startswith(p + '.') for p in ALLOWED_IMPORT_PREFIXES):
                    return f"Importación no permitida: {mod}"
        if isinstance(node, ast.ImportFrom):
            mod = node.module or ''
            if not any(mod == p or mod.startswith(p + '.') for p in ALLOWED_IMPORT_PREFIXES):
                return f"Importación no permitida: {mod}"
        # Bloquear exec/eval mediante nombres prohibidos
        if isinstance(node, ast.Name) and node.id in FORBIDDEN_NAMES:
            return f"Uso de nombre prohibido: {node.id}"
        # Atributos dunder peligrosos
        if isinstance(node, ast.Attribute) and isinstance(node.attr, str) and node.attr.startswith('__'):
            return f"Acceso a atributo interno no permitido: {node.attr}"
    return None


def _exec_restricted(code: str, nombre: str, local_vars: dict):
    err = _validate_code(code, nombre)
    if err:
        raise RuntimeError(err)
    # Entorno global restringido
    globals_safe = {"__builtins__": dict(SAFE_BUILTINS)}
    # __import__ restringido: solo módulos permitidos preimportados
    def _restricted_import(name, globals=None, locals=None, fromlist=(), level=0):
        if level != 0:
            raise ImportError("Importaciones relativas no permitidas")
        top = name.split('.')[0]
        if not any(top == p.split('.')[0] for p in ALLOWED_IMPORT_PREFIXES):
            raise ImportError(f"Importación bloqueada: {name}")
        # Retornar módulo ya importado o intentar importarlo si está en allowlist
        if name in sys.modules:
            mod = sys.modules[name]
        else:
            if not any(name == p or name.startswith(p + '.') for p in ALLOWED_IMPORT_PREFIXES):
                # Importar solo el top y confiar en submódulos cargados
                name = top
            mod = importlib.import_module(name)
        return mod
    globals_safe['__import__'] = _restricted_import
    globals_safe.update(ALLOWED_GLOBALS)
    exec(compile(code, filename=f"<mod:{nombre}>", mode='exec'), globals_safe, local_vars)


def _harden_pandas_io():
    """Disable pandas IO functions to prevent reading/writing files or networks."""
    def _block(*_args, **_kwargs):
        raise RuntimeError("Operación de E/S bloqueada por política de seguridad.")

    # Readers
    for name in [
        'read_csv','read_table','read_fwf','read_excel','read_json','read_pickle','read_parquet','read_feather',
        'read_hdf','read_stata','read_sas','read_spss','read_sql','read_gbq'
    ]:
        if hasattr(pd, name):
            setattr(pd, name, _block)

    # Writers at module level
    # No direct module writers typically, but keep placeholder

    # DataFrame writers
    df_writers = [
        'to_csv','to_excel','to_json','to_parquet','to_pickle','to_feather','to_hdf','to_stata','to_gbq','to_sql'
    ]
    try:
        from pandas import DataFrame as _DF
        for w in df_writers:
            if hasattr(_DF, w):
                setattr(_DF, w, _block)
    except Exception:
        pass


def ejecutar_modulo(test, df_ingreso, tipo_analisis):
    """Ejecuta el código principal y gráfico de un test_module y devuelve un dict listo para persistir."""
    nombre = test.get("nombre_interno", "sin_nombre")
    catalog_id = test.get("id")
    codigo_principal = test.get("codigo_principal", "")
    codigo_grafico = test.get("codigo_grafico", "")

    # Logs a stderr (no mezclar con stdout)
    print(f"\n[EVAL] Ejecutando módulo: {nombre}", file=sys.stderr, flush=True)

    # Preparar DataFrame para el módulo: si existe 'parametro' y 'valor', pivotar a columnas por parámetro
    df_for_exec = df_ingreso
    try:
        if "valor" in df_ingreso.columns and "parametro" in df_ingreso.columns:
            df_work = df_ingreso.copy()
            # Asegurar tipos numéricos
            if "valor" in df_work.columns:
                df_work["valor"] = pd.to_numeric(df_work["valor"], errors="coerce")
            # Asegurar índice de lectura
            if "lectura_idx" not in df_work.columns:
                df_work["lectura_idx"] = df_work.groupby("parametro").cumcount()
            else:
                df_work["lectura_idx"] = pd.to_numeric(df_work["lectura_idx"], errors="coerce")
            # Pivotar: filas=lectura_idx, columnas=parametro, valores=valor
            df_pivot = df_work.pivot_table(
                index="lectura_idx", columns="parametro", values="valor", aggfunc="first"
            )
            # Ordenar columnas por nombre para estabilidad
            df_pivot = df_pivot.sort_index(axis=1)
            # Conservar solo columnas numéricas (evita errores de tipo)
            df_pivot = df_pivot.select_dtypes(include=["number"]).copy()
            df_for_exec = df_pivot.reset_index(drop=True)

        else:
            # Fallback: solo columnas numéricas
            df_for_exec = df_ingreso.select_dtypes(include=["number"]).copy()
    except Exception:
        # Si algo falla, al menos pasar columnas numéricas
        df_for_exec = df_ingreso.select_dtypes(include=["number"]).copy()

    # Forzar conversión numérica de todo el DF de entrada al módulo; columnas no numéricas quedarán como NaN
    try:
        df_for_exec = df_for_exec.apply(pd.to_numeric, errors="coerce")
    except Exception:
        pass

    # Logs de depuración sobre las columnas expuestas al módulo
    try:
        info_cols = ", ".join([f"{c}:{str(t)}" for c, t in zip(df_for_exec.columns, df_for_exec.dtypes)])
        print(f"[DEBUG] df_ingreso columnas -> {info_cols}", file=sys.stderr, flush=True)
        print(f"[DEBUG] primeras filas ->\n{df_for_exec.head(3)}", file=sys.stderr, flush=True)
    except Exception:
        pass

    local_vars = {"pd": pd, "df_ingreso": df_for_exec, "df_raw": df_ingreso}

    try:
        # Redirigir prints del código dinámico a stderr para no ensuciar stdout
        _orig_stdout = sys.stdout
        sys.stdout = sys.stderr
        try:
            # === Ejecutar función principal ===
            _exec_restricted(codigo_principal, f"{nombre}:principal", local_vars)

            # Buscar objetos retornados o creados
            df_resultado = local_vars.get("df_resultado", None)

            # Si no existe df_resultado pero hay función, intentar llamarla
            if df_resultado is None:
                funcs = [v for v in local_vars.values() if callable(v)]
                if funcs:
                    try:
                        df_resultado = funcs[0](df_ingreso)
                    except Exception as e:
                        raise RuntimeError(f"Error ejecutando función principal: {e}")

            # Verificar que devuelve un DataFrame
            if not isinstance(df_resultado, pd.DataFrame):
                raise TypeError(
                    f"[{nombre}] El código principal debe devolver un pandas.DataFrame, obtuvo {type(df_resultado)}"
                )

            print(
                f"[OK] Código principal ejecutado correctamente - filas: {len(df_resultado)}",
                file=sys.stderr,
                flush=True,
            )

            # === Ejecutar código gráfico ===
            grafico_data = None
            if codigo_grafico:
                local_vars.update({"df_resultado": df_resultado})
                try:
                    _exec_restricted(codigo_grafico, f"{nombre}:grafico", local_vars)
                    print(
                        f"[OK] Código gráfico ejecutado correctamente.",
                        file=sys.stderr,
                        flush=True,
                    )
                except Exception as e:
                    print(
                        f"[WARN] Error en código gráfico ({nombre}): {e}",
                        file=sys.stderr,
                        flush=True,
                    )
                grafico_data = local_vars.get("grafico_data")
        finally:
            # Restaurar stdout
            sys.stdout = _orig_stdout

        # Construir resultado con las claves que espera main.js
        try:
            resultado_pc = df_resultado.to_json(orient="records", force_ascii=False)
        except Exception:
            # Si falla la serialización, devolvemos filas como mínimo
            resultado_pc = json.dumps({"rows": len(df_resultado)})

        return {
            "ok": True,
            "catalog_id": catalog_id,
            "nombre": nombre,
            "resultado_pc": resultado_pc,
            "grafico_data": grafico_data or "",
        }

    except Exception as e:
        traceback.print_exc()
        return {"ok": False, "catalog_id": catalog_id, "nombre": nombre, "error": str(e)}


if __name__ == "__main__":
    try:
        _apply_resource_limits()
        _inject_vendor_paths()
        _harden_pandas_io()
        path_json = sys.argv[1]

        # === Leer archivo temporal generado por main.js ===
        with open(path_json, "r", encoding="utf-8") as f:
            payload = json.load(f)

        session_id = payload.get("session_id")
        tipo_analisis = payload.get("tipo_analisis", "mono")
        df_ingreso = construir_dataframe_desde_json(payload.get("df_ingreso", []), tipo_analisis)
        tests = payload.get("tests", [])

        # Logs de sesión a stderr
        print(f"\n[SESSION] ID {session_id} - Tipo: {tipo_analisis}", file=sys.stderr, flush=True)
        print(
            f"[SESSION] {len(df_ingreso)} registros cargados para análisis.",
            file=sys.stderr,
            flush=True,
        )

        resultados = []
        for test in tests:
            resultado = ejecutar_modulo(test, df_ingreso, tipo_analisis)
            resultados.append(resultado)

        # === Resumen global (a stderr) ===
        ok_count = sum(1 for r in resultados if r.get("ok"))
        fail_count = len(resultados) - ok_count

        print(f"\n=== EVALUACIÓN FINALIZADA ===", file=sys.stderr, flush=True)
        print(f"Módulos exitosos: {ok_count}", file=sys.stderr, flush=True)
        print(f"Módulos con error: {fail_count}", file=sys.stderr, flush=True)

        # Imprimir en stdout el JSON de resultados para que main.js lo parsee
        print(json.dumps(resultados, ensure_ascii=False))

    except Exception:
        traceback.print_exc()
        sys.exit(1)
