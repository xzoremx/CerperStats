import os
import sys
import json
import pandas as pd
from datetime import datetime

print("[CerperStats Python] Script iniciado", file=sys.stderr)
sys.stderr.flush()

def get_base_dir():
    """
    Raíz de 'modules' tanto en dev como empaquetado (PyInstaller).
    """
    if hasattr(sys, "_MEIPASS"):
        # PyInstaller: dentro del bundle
        return os.path.abspath(os.path.join(sys._MEIPASS, "modules"))
    # Modo desarrollo: subir desde /modules/_common/
    return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def dataframe_from_cerperstats(json_str: str) -> pd.DataFrame:
    """
    Convierte el JSON de CerperStats (mono o multi) a un DataFrame estándar.
    """
    data = json.loads(json_str)
    tipo = data.get("tipo")

    if tipo == "multi":
        registros = []
        for bloque in data["datosPorParametro"]:
            parametro = bloque["parametro"]
            for analito, valores in bloque["lecturas"].items():
                for i, v in enumerate(valores, start=1):
                    registros.append({
                        "Parametro": parametro,
                        "Analito": analito,
                        "N": i,
                        "Valor": v
                    })
        return pd.DataFrame(registros)

    elif tipo == "mono":
        registros = []
        lecturas = data.get("lecturas", {})
        for col, valores in lecturas.items():
            for i, v in enumerate(valores, start=1):
                registros.append({
                    "Columna": col,
                    "N": i,
                    "Valor": v
                })
        return pd.DataFrame(registros)

    else:
        raise ValueError(f"Tipo desconocido: {tipo}")


def save_dataframe_temp(lab_name: str, json_str: str) -> dict:
    """
    Guarda:
      modules/<lab_name>/dataframe/temp/<YYYY-MM-DD_HH-MM-SS>/
        - datos_validos.csv
        - datos_validos.parquet
        - info.json
    Si la carpeta del laboratorio ya existe, se reutiliza.
    """
    base_modules = get_base_dir()
    target_dir = os.path.join(base_modules, lab_name, "dataframe", "temp")
    os.makedirs(target_dir, exist_ok=True)

    # Crear subcarpeta con timestamp
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    output_dir = os.path.join(target_dir, timestamp)
    os.makedirs(output_dir, exist_ok=True)

    # Construir DataFrame
    df = dataframe_from_cerperstats(json_str)

    # Guardar archivos
    csv_path = os.path.join(output_dir, "datos_validos.csv")
    parquet_path = os.path.join(output_dir, "datos_validos.parquet")
    info_path = os.path.join(output_dir, "info.json")

    df.to_csv(csv_path, index=False, encoding="utf-8-sig")

    meta = {
        "lab": lab_name,
        "tipo": json.loads(json_str).get("tipo"),
        "filas": int(len(df)),
        "columnas": list(map(str, df.columns)),
        "fecha_creacion": timestamp
    }

    with open(info_path, "w", encoding="utf-8-sig") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    return {"ok": True, "output_dir": output_dir, **meta}


def _main_cli():
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "Falta lab_name"}))
        sys.exit(1)

    lab_name = sys.argv[1]
    try:
        json_bytes = sys.stdin.buffer.read()
        json_str = json_bytes.decode("utf-8", errors="replace")

        res = save_dataframe_temp(lab_name, json_str)
        print(json.dumps(res, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))



if __name__ == "__main__":
    _main_cli()

