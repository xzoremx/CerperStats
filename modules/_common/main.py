#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Runner seguro y minimalista para mรณdulos de evaluaciรณn.

- Lee JSON de trabajo desde sys.argv[1].
- Resuelve mรณdulos desde modules/_common/modules_manifest.json.
- Valida rutas, verifica SHA-256 y ejecuta con runpy.run_path.
- No transforma df_ingreso; sรณlo lo convierte a DataFrame y trabaja con copias profundas.
- Captura stdout del mรณdulo o, en su defecto, df_resultado.
- Imprime en stdout un JSON con los resultados; logs en stderr.
"""

import sys
import json
import io
import re
import math
import statistics
import hashlib
import base64
import binascii
import runpy
import traceback
from copy import deepcopy
from contextlib import redirect_stdout
from pathlib import Path
from typing import TYPE_CHECKING



# --- Dependencias opcionales ---
if TYPE_CHECKING:
    from pandas import DataFrame

try:
    import pandas as pd
except ImportError:  # pragma: no cover
    pd = None

try:
    import numpy as np
except ImportError:  # pragma: no cover
    np = None


# ==========================
# Utilidades de logging
# ==========================
def log_err(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)





# ==========================
# Manifest & paths seguros
# ==========================
SAFE_PATH_RE = re.compile(r"^[A-Za-z0-9_\-./]+$")


def load_manifest(manifest_path: Path) -> dict:
    with manifest_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    entries = data.get("entries", [])
    by_id = {}
    by_name = {}
    by_module_id = {}

    for e in entries:
        eid = e.get("id")
        name = e.get("nombre_interno")
        if eid is not None:
            by_id[eid] = e
        if name:
            by_name[str(name)] = e
        mid = e.get("module_id")
        if mid is not None:
            by_module_id[mid] = e

    return {
        "raw": data,
        "by_id": by_id,
        "by_name": by_name,
        "by_module_id": by_module_id,
    }


def resolve_manifest_entry(test: dict, manifest_idx: dict):
    """Resolver entrada del manifest por id o nombre_interno."""
    # Preferir module_id cuando estรฉ disponible (test_modules.id)
    mid = test.get("module_id")
    if mid is not None:
        entry = manifest_idx["by_module_id"].get(mid)
        if entry is not None:
            return entry
    tid = test.get("catalog_id") or test.get("id")
    nombre = test.get("nombre_interno")

    entry = None
    if tid is not None:
        entry = manifest_idx["by_id"].get(tid)
    if entry is None and nombre:
        entry = manifest_idx["by_name"].get(str(nombre))

    return entry


def is_safe_rel_path(rel: str) -> bool:
    """Validar patrรณn de ruta y evitar traversal / absoluta."""
    if not rel:
        return False
    if not SAFE_PATH_RE.match(rel):
        return False
    if rel.startswith("/") or rel.startswith("\\"):
        return False
    if ".." in rel.split("/"):
        return False
    if ".." in rel.split("\\"):
        return False
    return True


def compute_sha256_text(path: Path) -> str:
    """Calcular SHA-256 del archivo como texto UTF-8."""
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


# ==========================
# Validaciones de salida
# ==========================
def normalize_stdout_records(stdout_content: str):
    """Valida que stdout sea JSON de tipo records (lista de dicts) y lo normaliza.
    Devuelve (ok, normalized_json_str, error_msg).
    """
    try:
        data = json.loads(stdout_content)
    except Exception as e:
        return False, None, f"stdout no es JSON vรกlido: {e}"

    if isinstance(data, list):
        # Debe ser lista de dicts (records)
        if not all(isinstance(x, dict) for x in data):
            return False, None, "stdout JSON debe ser una lista de objetos (records)"
        try:
            if pd is None:
                # Sin pandas: reserializar tal cual pero asegurando JSON vรกlido
                return True, json.dumps(data, ensure_ascii=False), None
            df = pd.DataFrame(data)
            return True, df.to_json(orient="records", force_ascii=False), None
        except Exception as e:
            return False, None, f"No se pudo normalizar a DataFrame: {e}"

    return False, None, "stdout JSON debe ser lista de objetos (records)"


BASE64_RE = re.compile(r"^[A-Za-z0-9+/]+={0,2}$")


def is_valid_base64_payload(value: str) -> bool:
    """Valida que value sea base64 puro o data:*;base64,...."""
    if not isinstance(value, str) or not value:
        return False
    s = value
    if s.startswith("data:") and "," in s:
        # data URI: separar encabezado
        s = s.split(",", 1)[1]
    s = s.strip()
    # Longitud mรบltiplo de 4 y caracteres vรกlidos
    if len(s) % 4 != 0:
        return False
    if not BASE64_RE.fullmatch(s):
        return False
    try:
        base64.b64decode(s, validate=True)
        return True
    except binascii.Error:
        return False


# ==========================
# Preparaciรณn del DataFrame de ingreso
# ==========================
def prepare_input_dataframe(df_raw: "DataFrame", tipo_analisis: str) -> "DataFrame":
    """Construye el DataFrame que consumen los mรณdulos a partir de df_ingreso_raw.

    - Monoanalito: columnas = parรกmetros; filas = lectura_idx; valores = valor
    - Multianalito: columnas = parรกmetros; filas = lectura_idx; valores = valor
      (misma estructura que monoanalito, ya que la iteración por analito se hace antes)
    
    Nota: Los niveles y analitos (en multianalito) se procesan por separado antes de llamar 
    a esta función, por lo que aquí no se espera el campo 'nivel' ni 'analito' en los datos.
    """
    if pd is None:
        raise RuntimeError("pandas no estรก disponible en el entorno de ejecuciรณn")
    df = df_raw.copy(deep=True)

    t = (tipo_analisis or "").lower()
    is_multi = t in ("multi", "multianalito")

    try:
        # Tipado bรกsico de columnas esperadas
        if 'lectura_idx' in df.columns:
            df['lectura_idx'] = pd.to_numeric(df['lectura_idx'], errors='coerce')
        if 'valor' in df.columns:
            df['valor'] = pd.to_numeric(df['valor'], errors='coerce')

        # Ambos tipos (mono y multi) usan la misma estructura:
        # columnas = parámetros, filas = lectura_idx
        # Para multianalito, el df_raw ya viene filtrado por un analito específico
        
        # Requiere: parametro, lectura_idx, valor
        required = {'parametro', 'lectura_idx', 'valor'}
        missing = [c for c in required if c not in df.columns]
        if missing:
            raise ValueError(f"Faltan columnas requeridas: {missing}")
        
        pv = df.pivot_table(index='lectura_idx', columns='parametro', values='valor', aggfunc='first')
        pv = pv.sort_index(axis=1)
        # Filas ordenadas por lectura_idx (y reindexadas de 0..n-1)
        try:
            pv = pv.sort_index()
        except Exception:
            pass
        pv = pv.reset_index(drop=True)
        return pv
    except Exception as e:
        # En caso de error, devolver el df original para no bloquear ejecuciรณn
        log_err(f"[EVAL] Error preparando df_ingreso ({'multi' if is_multi else 'mono'}): {e}")
        return df





# ==========================
# Ejecuciรณn por mรณdulo
# ==========================
def run_single_module(
    test: dict,
    manifest_entry: dict,
    modules_root: Path,
    modules_common: Path,
    df_base: "DataFrame",
    total_analitos: int = None,
    current_analito: str = None,
) -> dict:
    """
    Ejecuta un mรณdulo especรญfico y devuelve el resultado en el formato requerido.
    No levanta excepciones: devuelve dict ok/false.
    """
    # Prefer module_id primary identifier
    module_id = test.get("module_id")
    catalog_id = test.get("catalog_id") or test.get("id")
    nombre = test.get("nombre_interno")

    log_err(f"[EVAL] Ejecutando mรณdulo module_id={module_id} catalog_id={catalog_id} nombre={nombre}")

    if manifest_entry is None:
        return {
            "ok": False,
            "module_id": module_id,
            "catalog_id": catalog_id,
            "nombre": nombre,
            "error": "No se encontrรณ entrada en el manifest para este mรณdulo",
        }

    module_asset = manifest_entry.get("module_asset")
    if not module_asset:
        return {
            "ok": False,
            "module_id": module_id,
            "catalog_id": catalog_id,
            "nombre": nombre,
            "error": "Entrada de manifest sin 'module_asset'",
        }

    # Validar ruta segura
    if not is_safe_rel_path(module_asset):
        log_err(f"[EVAL] Ruta de mรณdulo invรกlida: {module_asset}")
        return {
            "ok": False,
            "catalog_id": catalog_id,
            "nombre": nombre,
            "error": f"Ruta de mรณdulo invรกlida: {module_asset}",
        }

    # Resolver ruta absoluta dentro de modules/
    mod_path = (modules_root / module_asset).resolve()
    if not mod_path.is_file():
        log_err(f"[EVAL] Archivo de mรณdulo no encontrado: {mod_path}")
        return {
            "ok": False,
            "module_id": module_id,
            "catalog_id": catalog_id,
            "nombre": nombre,
            "error": f"Archivo de mรณdulo no encontrado: {mod_path}",
        }

    # Proteger contra salir de modules/ (por symlinks u otros)
    if not str(mod_path).startswith(str(modules_root)):
        log_err(f"[EVAL] Ruta fuera de modules/: {mod_path}")
        return {
            "ok": False,
            "module_id": module_id,
            "catalog_id": catalog_id,
            "nombre": nombre,
            "error": "Ruta de mรณdulo fuera de la carpeta 'modules'",
        }

    # Verificaciรณn de SHA-256 (manifest manda; payload opcional)
    actual_hash = compute_sha256_text(mod_path).lower()
    mf_hash = manifest_entry.get("sha256_module")
    if mf_hash and str(mf_hash).lower() != actual_hash:
        log_err(f"[EVAL] Hash mismatch (manifest) para {mod_path}. Esperado={mf_hash} Actual={actual_hash}")
        return {
            "ok": False,
            "module_id": module_id,
            "catalog_id": catalog_id,
            "nombre": nombre,
            "error": "Verificaciรณn SHA-256 contra manifest fallida",
        }
    # Si viene hash en el payload y no coincide, advertimos pero no bloqueamos
    for key in ("hash_module", "sha256_module"):
        if test.get(key) and str(test[key]).lower() != actual_hash:
            log_err(f"[EVAL] Aviso: hash de payload no coincide (ignorado). Payload={test.get(key)} Actual={actual_hash}")

    

    # Preparar locals para runpy
    if pd is None:
        raise RuntimeError("pandas no estรก disponible en el entorno de ejecuciรณn")

    df_ingreso = df_base.copy(deep=True)
    df_raw = df_base.copy(deep=True)

    local_vars = {
        "pd": pd,
        "np": np,
        "math": math,
        "statistics": statistics,
        "df_ingreso": df_ingreso,
        "df_raw": df_raw,
    }
    
    # Agregar variables multianalito al namespace si están disponibles
    if total_analitos is not None:
        local_vars["total_analitos"] = int(total_analitos)
    if current_analito is not None:
        local_vars["current_analito"] = str(current_analito)

    stdout_buffer = io.StringIO()
    try:
        with redirect_stdout(stdout_buffer):
            module_ns = runpy.run_path(str(mod_path), init_globals=local_vars)

        # grafico_data: sรณlo se rellena si existe script_grafico (ver mรกs abajo)
        grafico_data = ""

        # Resultado principal: SOLO DataFrame (df_resultado). Ignorar stdout.
        df_res = module_ns.get("df_resultado")
        if df_res is not None and isinstance(df_res, pd.DataFrame):
            resultado_pc = df_res.to_json(orient="records", force_ascii=False)
        else:
            return {
                "ok": False,
                "module_id": module_id,
                "catalog_id": catalog_id,
                "nombre": nombre,
                "error": "El módulo no produjo df_resultado (DataFrame)",
            }
        
        # Extraer conclusión si el módulo la define
        conclusion = module_ns.get("conclusion", None)
        if conclusion is not None and not isinstance(conclusion, str):
            conclusion = str(conclusion)
        
        # Extraer conclusion_status si el módulo la define (success/danger/neutral)
        conclusion_status = module_ns.get("conclusion_status", None)
        if conclusion_status is not None:
            # Validar que sea uno de los valores permitidos
            if conclusion_status not in ("success", "danger", "neutral"):
                log_err(f"[EVAL] conclusion_status inválido: {conclusion_status}, usando 'neutral'")
                conclusion_status = "neutral"
        else:
            conclusion_status = None

        # Ejecutar script grรกfico si estรก definido (script_grafico o graph_asset)
        script_grafico = manifest_entry.get("script_grafico") or manifest_entry.get("graph_asset")
        if script_grafico:
            # 1) Validar ruta segura
            if not is_safe_rel_path(script_grafico):
                log_err(f"[EVAL] Ruta de grรกfico invรกlida: {script_grafico}")
                return {
                    "ok": False,
                    "module_id": module_id,
                    "catalog_id": catalog_id,
                    "nombre": nombre,
                    "error": f"Ruta de grรกfico invรกlida: {script_grafico}",
                }

            # 2) Resolver y asegurar que estรฉ dentro de modules/
            graph_path = (modules_root / script_grafico).resolve()
            if not graph_path.is_file():
                log_err(f"[EVAL] Archivo de grรกfico no encontrado: {graph_path}")
                return {
                    "ok": False,
                    "module_id": module_id,
                    "catalog_id": catalog_id,
                    "nombre": nombre,
                    "error": f"Archivo de grรกfico no encontrado: {graph_path}",
                }
            if not str(graph_path).startswith(str(modules_root.resolve())):
                log_err(f"[EVAL] Ruta de grรกfico fuera de la carpeta 'modules': {graph_path}")
                return {
                    "ok": False,
                    "module_id": module_id,
                    "catalog_id": catalog_id,
                    "nombre": nombre,
                    "error": "Ruta de grรกfico fuera de la carpeta 'modules'",
                }

            # 3) Verificar SHA-256 del grรกfico si estรก presente en el manifest
            graph_hash_actual = compute_sha256_text(graph_path).lower()
            mf_graph_hash = (
                manifest_entry.get("sha256_script_grafico")
                or manifest_entry.get("sha256_graph")
            )
            if mf_graph_hash and str(mf_graph_hash).lower() != graph_hash_actual:
                log_err(
                    f"[EVAL] Hash mismatch (manifest) para grรกfico {graph_path}. Esperado={mf_graph_hash} Actual={graph_hash_actual}"
                )
                return {
                    "ok": False,
                    "module_id": module_id,
                    "catalog_id": catalog_id,
                    "nombre": nombre,
                    "error": "Verificaciรณn SHA-256 del grรกfico contra manifest fallida",
                }

            # Warnings si el payload trae hash opcional (nuevos o legacy)
            for key in ("hash_script_grafico", "sha256_script_grafico", "hash_graph", "sha256_graph"):
                if test.get(key) and str(test[key]).lower() != graph_hash_actual:
                    log_err(
                        f"[EVAL] Aviso: hash de grรกfico en payload no coincide (ignorado). Payload={test.get(key)} Actual={graph_hash_actual}"
                    )

            # 4) Ejecutar el grรกfico con contexto controlado
            vars_grafico = {
                "pd": pd,
                "np": np,
                "math": math,
                "statistics": statistics,
                "df_ingreso": df_ingreso,
                "df_raw": df_raw,
                "df_resultado": df_res,
                "resultado_pc": resultado_pc,
            }
            # Agregar variables multianalito si están disponibles
            if total_analitos is not None:
                vars_grafico["total_analitos"] = int(total_analitos)
            if current_analito is not None:
                vars_grafico["current_analito"] = str(current_analito)
            try:
                graph_ns = runpy.run_path(str(graph_path), init_globals=vars_grafico)
                g = graph_ns.get("grafico_data")
                if g is None:
                    grafico_data = ""
                elif isinstance(g, str):
                    grafico_data = g
                else:
                    try:
                        grafico_data = json.dumps(g, ensure_ascii=False)
                    except TypeError:
                        grafico_data = str(g)
            except Exception as ge:
                log_err(f"[EVAL] Error ejecutando grรกfico para {nombre}: {ge}")
                traceback.print_exc(file=sys.stderr)
                return {
                    "ok": False,
                    "module_id": module_id,
                    "catalog_id": catalog_id,
                    "nombre": nombre,
                    "error": f"Error ejecutando grรกfico: {ge}",
                }

        # Validar grafico_data si existe (base64)
        if grafico_data:
            if not is_valid_base64_payload(grafico_data):
                return {
                    "ok": False,
                    "catalog_id": catalog_id,
                    "nombre": nombre,
                    "error": "grafico_data no es base64 vรกlido (aceptado: base64 plano o data:*;base64,...)",
                }

        return {
            "ok": True,
            "module_id": module_id,
            "catalog_id": catalog_id,
            "nombre": nombre,
            "resultado_pc": resultado_pc,
            "conclusion": conclusion,
            "conclusion_status": conclusion_status,
            "grafico_data": grafico_data,
        }

    except Exception as e:
        log_err(f"[EVAL] Error ejecutando mรณdulo {nombre}: {e}")
        traceback.print_exc(file=sys.stderr)
        return {
            "ok": False,
            "module_id": module_id,
            "catalog_id": catalog_id,
            "nombre": nombre,
            "error": str(e),
        }


# ==========================
# Main
# ==========================
def main(argv=None) -> int:
    if argv is None:
        argv = sys.argv

    if len(argv) < 2:
        log_err("Uso: python eval_runner_secure.py <ruta_json_trabajo>")
        return 1

    json_path = Path(argv[1])

    # Localizaciรณn de carpetas base
    this_file = Path(__file__).resolve()
    modules_common = this_file.parent           # modules/_common
    modules_root = modules_common.parent        # modules/

    manifest_path = modules_common / "modules_manifest.json"
    if not manifest_path.is_file():
        log_err(f"No se encontrรณ manifest en: {manifest_path}")
        return 1

    # Cargar manifest
    try:
        manifest_idx = load_manifest(manifest_path)
    except Exception as e:
        log_err(f"Error al cargar manifest: {e}")
        traceback.print_exc(file=sys.stderr)
        return 1

    # Cargar JSON de trabajo
    try:
        with json_path.open("r", encoding="utf-8") as f:
            payload = json.load(f)
    except Exception as e:
        log_err(f"Error al cargar JSON de trabajo: {e}")
        traceback.print_exc(file=sys.stderr)
        return 1

    session_id = payload.get("session_id")
    tipo_analisis = payload.get("tipo_analisis")
    df_ingreso_raw = payload.get("df_ingreso", [])
    tests = payload.get("tests", [])
    total_analitos = payload.get("total_analitos")  # Para multianalito: cantidad total de analitos
    current_analito = payload.get("current_analito")  # Para multianalito: nombre del analito actual

    # Log sesiรณn
    try:
        log_err(
            "[SESSION] " + json.dumps(
                {
                    "session_id": session_id,
                    "tipo_analisis": tipo_analisis,
                    "n_tests": len(tests),
                },
                ensure_ascii=False,
            )
        )
    except Exception:
        # fallback simple
        log_err(f"[SESSION] session_id={session_id} tipo_analisis={tipo_analisis} n_tests={len(tests)}")

    if pd is None:
        log_err("pandas es requerido pero no estรก disponible.")
        return 1

    # Construir DataFrame de ingreso con la estructura requerida por tipo_analisis
    try:
        df_raw = pd.DataFrame(df_ingreso_raw).copy(deep=True)
        df_base = prepare_input_dataframe(df_raw, tipo_analisis)
    except Exception as e:
        log_err(f"Error construyendo DataFrame df_ingreso: {e}")
        traceback.print_exc(file=sys.stderr)
        return 1


    results = []
    for test in tests:
        # Por seguridad, evitar que el test modifique el payload original
        test_copy = deepcopy(test)
        manifest_entry = resolve_manifest_entry(test_copy, manifest_idx)

        res = run_single_module(
            test=test_copy,
            manifest_entry=manifest_entry,
            modules_root=modules_root,
            modules_common=modules_common,
            df_base=df_base,
            total_analitos=total_analitos,  # Pasar total_analitos para multianalito
            current_analito=current_analito,  # Pasar nombre del analito actual para multianalito
        )
        results.append(res)

    # Empaquetar salida global
    final_output = {
        "ok": True,
        "session_id": session_id,
        "tipo_analisis": tipo_analisis,
        "results": results,
    }

    print(json.dumps(final_output, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
