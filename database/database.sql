CREATE TABLE labs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lab_key TEXT UNIQUE NOT NULL,
  nombre TEXT,
  descripcion TEXT,
  metodo_default TEXT,
  producto_default TEXT,
  ensayo_default TEXT,
  expediente_demo TEXT,
  activo BOOLEAN DEFAULT 1,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lab_data_modes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lab_key TEXT,
  tipo_dato TEXT,
  modo_cualitativo TEXT,
  valores_permitidos TEXT,
  activo BOOLEAN DEFAULT 1,
  FOREIGN KEY (lab_key) REFERENCES labs (lab_key)
);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lab_key TEXT,
  metodo TEXT,
  producto TEXT,
  ensayo TEXT,
  expediente TEXT,
  tipo_analisis TEXT,
  tipo_dato TEXT,
  modo_cualitativo TEXT,
  parametro TEXT,
  usuario TEXT,
  estado TEXT DEFAULT 'en_progreso',
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME,
  FOREIGN KEY (lab_key) REFERENCES labs (lab_key)
);

CREATE TABLE inputs_monoanalito (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER,
  analito TEXT DEFAULT 'Analito',
  parametro TEXT,
  lectura_idx INTEGER,
  valor REAL,
  unidad TEXT,
  tipo_dato TEXT,
  modo_cualitativo TEXT,
  valido BOOLEAN DEFAULT 1,
  comentario TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions (id)
);

CREATE TABLE inputs_multianalito (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER,
  parametro TEXT,
  analito TEXT,
  lectura_idx INTEGER,
  valor REAL,
  unidad TEXT,
  tipo_dato TEXT,
  modo_cualitativo TEXT,
  valido BOOLEAN DEFAULT 1,
  comentario TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions (id)
);

CREATE TABLE tests_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lab_key TEXT,
  tipo_dato TEXT,
  nombre_interno TEXT,
  titulo TEXT,
  categoria TEXT,
  descripcion TEXT,
  version_actual TEXT,
  activo BOOLEAN DEFAULT 1,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME,
  FOREIGN KEY (lab_key) REFERENCES labs (lab_key)
);

CREATE TABLE test_modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER,
  version TEXT,
  lenguaje TEXT DEFAULT 'python',
  seguridad TEXT DEFAULT 'sandbox',
  parametros_json TEXT,
  metricas_json TEXT,
  codigo_principal TEXT,
  codigo_dependencias TEXT,
  doc_tecnica TEXT,
  autor TEXT,
  fecha_publicacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  obsoleto_en DATETIME,
  activo BOOLEAN DEFAULT 1,
  FOREIGN KEY (test_id) REFERENCES tests_catalog (id)
);

CREATE TABLE results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER,
  test_id INTEGER,
  module_id INTEGER,
  analito TEXT,
  parametro TEXT,
  metrica TEXT,
  valor REAL,
  unidad TEXT,
  parametros_usados TEXT,
  json_extra TEXT,
  estado TEXT DEFAULT 'completado',
  mensaje_error TEXT,
  ejecutado_por TEXT,
  tiempo_ejecucion_ms INTEGER,
  generado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions (id),
  FOREIGN KEY (test_id) REFERENCES tests_catalog (id),
  FOREIGN KEY (module_id) REFERENCES test_modules (id)
);

CREATE TABLE reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER,
  modo TEXT,
  tipo_informe TEXT,
  analito TEXT,
  prueba_id INTEGER,
  version_informe TEXT,
  plan_json TEXT,
  pdf_data BLOB,
  hash_documento TEXT,
  estado TEXT DEFAULT 'en_borrador',
  generado_por TEXT,
  observaciones TEXT,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME,
  FOREIGN KEY (session_id) REFERENCES sessions (id),
  FOREIGN KEY (prueba_id) REFERENCES tests_catalog (id)
);
