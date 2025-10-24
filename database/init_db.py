import sqlite3
from pathlib import Path

# --- Rutas ---
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "cerperstats.db"
SQL_PATH = BASE_DIR / "database.sql"

def init_database():
    """Crea la base CerperStats desde database.sql si aún no existe."""
    if DB_PATH.exists() and DB_PATH.stat().st_size > 0:
        print("Base de datos ya existe. No se recreará.")
        return

    # Leer el archivo SQL exportado
    script = SQL_PATH.read_text(encoding="utf-8")

    # Crear base e inicializar
    with sqlite3.connect(DB_PATH) as conn:
        conn.executescript(script)
        conn.commit()

    print("Base CerperStats creada correctamente en:")
    print(f"   {DB_PATH}")

if __name__ == "__main__":
    init_database()
