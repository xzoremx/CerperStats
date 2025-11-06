# modules/_common/eval_runner_secure.py
import sys
import json
import traceback
import pandas as pd


def construir_dataframe_desde_json(df_data, tipo_analisis):
    """Construye el DataFrame de ingreso desde los datos JSON enviados por main.js"""
    df = pd.DataFrame(df_data)
    # No insertar columnas sintéticas como 'analito' en mono; dejar solo lo enviado
    if "valor" in df.columns:
        df["valor"] = pd.to_numeric(df["valor"], errors="coerce")
    return df


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
            exec(codigo_principal, {}, local_vars)

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
                    exec(codigo_grafico, {}, local_vars)
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
