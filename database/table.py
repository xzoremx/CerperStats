import sqlite3
import pandas as pd
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "cerperstats.db"
conn = sqlite3.connect(DB_PATH)

# Crear un DataFrame con nuevos laboratorios
df_labs = pd.DataFrame([
    {
        "lab_key": "ensayo_demo",
        "nombre": "Laboratorio de Ensayo Demo",
        "descripcion": "Pruebas de inserción pandas",
        "metodo_default": "ASTM D0000",
        "producto_default": "Agua destilada",
        "ensayo_default": "Determinación de pureza",
        "expediente_demo": "EXDE-00001-2025",
        "activo": 1
    }
])

# Guardar directamente en la tabla
df_labs.to_sql("labs", conn, if_exists="append", index=False)
print("Laboratorio agregado desde DataFrame.")


# Leer la tabla completa
df_labs = pd.read_sql("SELECT * FROM labs", conn)
print(df_labs)

# Filtrar con SQL y mostrar
df_sessions = pd.read_sql("SELECT id, lab_key, estado FROM sessions", conn)
print(df_sessions)


tablas = pd.read_sql("SELECT name FROM sqlite_master WHERE type='table';", conn)
print(tablas)

for t in tablas['name']:
    print(f"\n--- {t.upper()} ---")
    df = pd.read_sql(f"SELECT * FROM {t} LIMIT 5;", conn)
    print(df)
