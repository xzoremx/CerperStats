--
-- PostgreSQL database dump
--

\restrict XNkaQTWR8LwtXLs91NL6ij3Pxo9rhqRIXGIEhEgWNTyt06Me0UZmRu0eMRUAwHQ

-- Dumped from database version 18.0
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: actualizar_fecha_publicacion(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.actualizar_fecha_publicacion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.fecha_publicacion := NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.actualizar_fecha_publicacion() OWNER TO postgres;

--
-- Name: actualizar_timestamp_reports(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.actualizar_timestamp_reports() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.actualizado_en := NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.actualizar_timestamp_reports() OWNER TO postgres;

--
-- Name: actualizar_timestamp_results_general(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.actualizar_timestamp_results_general() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.actualizado_en := NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.actualizar_timestamp_results_general() OWNER TO postgres;

--
-- Name: actualizar_timestamp_sessions(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.actualizar_timestamp_sessions() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.actualizado_en := NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.actualizar_timestamp_sessions() OWNER TO postgres;

--
-- Name: actualizar_timestamp_tests_catalog(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.actualizar_timestamp_tests_catalog() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.actualizado_en := NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.actualizar_timestamp_tests_catalog() OWNER TO postgres;

--
-- Name: actualizar_timestamp_usuarios(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.actualizar_timestamp_usuarios() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.actualizado_en := NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.actualizar_timestamp_usuarios() OWNER TO postgres;

--
-- Name: calcular_hash_test_modules(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calcular_hash_test_modules() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.code_hash :=
    encode(
      digest(
        coalesce(NEW.codigo_principal, '') ||
        coalesce(NEW.codigo_grafico, ''),
        'sha256'
      ),
      'hex'
    );
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.calcular_hash_test_modules() OWNER TO postgres;

--
-- Name: calcular_hash_tests_catalog(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calcular_hash_tests_catalog() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.icon_hash :=
    encode(
      digest(
        coalesce(NEW.icon_svg, '') ||
        coalesce(NEW.icon_css, '') ||
        coalesce(NEW.icon_js, ''),
        'sha256'
      ),
      'hex'
    );
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.calcular_hash_tests_catalog() OWNER TO postgres;

--
-- Name: forbid_update_signed_columns_tc(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.forbid_update_signed_columns_tc() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (OLD.icon_hash IS DISTINCT FROM NEW.icon_hash)
     OR (OLD.icon_sig  IS DISTINCT FROM NEW.icon_sig) THEN
    RAISE EXCEPTION 'Campos firmados son inmutables (tests_catalog)';
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION public.forbid_update_signed_columns_tc() OWNER TO postgres;

--
-- Name: forbid_update_signed_columns_tm(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.forbid_update_signed_columns_tm() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (OLD.code_hash IS DISTINCT FROM NEW.code_hash)
     OR (OLD.code_sig  IS DISTINCT FROM NEW.code_sig) THEN
    RAISE EXCEPTION 'Campos firmados son inmutables (test_modules)';
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION public.forbid_update_signed_columns_tm() OWNER TO postgres;

--
-- Name: limpiar_hash_si_revocado_tc(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.limpiar_hash_si_revocado_tc() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.icon_revoked = TRUE THEN
    NEW.icon_hash := NULL;
    NEW.icon_sig  := NULL;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.limpiar_hash_si_revocado_tc() OWNER TO postgres;

--
-- Name: limpiar_hash_si_revocado_tm(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.limpiar_hash_si_revocado_tm() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.revoked = TRUE THEN
    NEW.code_hash := NULL;
    NEW.code_sig  := NULL;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.limpiar_hash_si_revocado_tm() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: allowed_icon_hashes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.allowed_icon_hashes (
    hash character(64) NOT NULL,
    active boolean DEFAULT true,
    revoked boolean DEFAULT false,
    note text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.allowed_icon_hashes OWNER TO postgres;

--
-- Name: allowed_module_hashes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.allowed_module_hashes (
    hash character(64) NOT NULL,
    active boolean DEFAULT true,
    revoked boolean DEFAULT false,
    note text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.allowed_module_hashes OWNER TO postgres;

--
-- Name: inputs_monoanalito; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inputs_monoanalito (
    id integer NOT NULL,
    session_id integer NOT NULL,
    analito text DEFAULT 'Analito'::text,
    parametro text,
    lectura_idx integer,
    valor double precision,
    unidad text,
    tipo_dato text,
    modo_cualitativo text,
    valido boolean DEFAULT true,
    comentario text
);


ALTER TABLE public.inputs_monoanalito OWNER TO postgres;

--
-- Name: inputs_monoanalito_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inputs_monoanalito_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inputs_monoanalito_id_seq OWNER TO postgres;

--
-- Name: inputs_monoanalito_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inputs_monoanalito_id_seq OWNED BY public.inputs_monoanalito.id;


--
-- Name: inputs_multianalito; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inputs_multianalito (
    id integer NOT NULL,
    session_id integer NOT NULL,
    parametro text,
    analito text,
    lectura_idx integer,
    valor double precision,
    unidad text,
    tipo_dato text,
    modo_cualitativo text,
    valido boolean DEFAULT true,
    comentario text
);


ALTER TABLE public.inputs_multianalito OWNER TO postgres;

--
-- Name: inputs_multianalito_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inputs_multianalito_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inputs_multianalito_id_seq OWNER TO postgres;

--
-- Name: inputs_multianalito_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inputs_multianalito_id_seq OWNED BY public.inputs_multianalito.id;


--
-- Name: lab_data_modes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lab_data_modes (
    id integer NOT NULL,
    lab_key text NOT NULL,
    tipo_dato text,
    modo_cualitativo text,
    valores_permitidos text,
    activo boolean DEFAULT true
);


ALTER TABLE public.lab_data_modes OWNER TO postgres;

--
-- Name: lab_data_modes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.lab_data_modes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lab_data_modes_id_seq OWNER TO postgres;

--
-- Name: lab_data_modes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.lab_data_modes_id_seq OWNED BY public.lab_data_modes.id;


--
-- Name: labs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.labs (
    id integer NOT NULL,
    lab_key text,
    nombre text,
    descripcion text,
    metodo_default text,
    producto_default text,
    ensayo_default text,
    unidad_default text,
    expediente_demo text,
    activo boolean DEFAULT true,
    creado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    color text
);


ALTER TABLE public.labs OWNER TO postgres;

--
-- Name: labs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.labs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.labs_id_seq OWNER TO postgres;

--
-- Name: labs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.labs_id_seq OWNED BY public.labs.id;


--
-- Name: logs_sistema; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.logs_sistema (
    id integer NOT NULL,
    usuario_id integer,
    accion text NOT NULL,
    detalle text,
    fecha timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.logs_sistema OWNER TO postgres;

--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    username text NOT NULL,
    nombre_completo text,
    rol text DEFAULT 'analista'::text,
    email text,
    hash_password text,
    default_lab text,
    activo boolean DEFAULT true,
    creado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    actualizado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.usuarios OWNER TO postgres;

--
-- Name: logs_detallado; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.logs_detallado AS
 SELECT l.id,
    u.username AS usuario,
    l.accion,
    l.detalle,
    l.fecha
   FROM (public.logs_sistema l
     LEFT JOIN public.usuarios u ON ((l.usuario_id = u.id)))
  ORDER BY l.fecha DESC;


ALTER VIEW public.logs_detallado OWNER TO postgres;

--
-- Name: logs_sistema_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.logs_sistema_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.logs_sistema_id_seq OWNER TO postgres;

--
-- Name: logs_sistema_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.logs_sistema_id_seq OWNED BY public.logs_sistema.id;


--
-- Name: reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reports (
    id integer NOT NULL,
    session_id integer NOT NULL,
    catalog_id integer,
    tipo_informe text DEFAULT 'resultado'::text,
    version_informe text DEFAULT 'v1.0'::text,
    estado text DEFAULT 'generado'::text,
    plan_json jsonb,
    pdf_data bytea,
    hash_documento text,
    observaciones text,
    creado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    actualizado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    usuario_id integer,
    parent_report_id integer
);


ALTER TABLE public.reports OWNER TO postgres;

--
-- Name: reports_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reports_id_seq OWNER TO postgres;

--
-- Name: reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reports_id_seq OWNED BY public.reports.id;


--
-- Name: reports_tests_link; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reports_tests_link (
    report_id integer NOT NULL,
    catalog_id integer NOT NULL,
    session_id integer NOT NULL
);


ALTER TABLE public.reports_tests_link OWNER TO postgres;

--
-- Name: reports_with_tests; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.reports_with_tests AS
SELECT
    NULL::integer AS report_id,
    NULL::integer AS session_id,
    NULL::text AS tipo_informe,
    NULL::text AS version_informe,
    NULL::text AS estado,
    NULL::timestamp without time zone AS creado_en,
    NULL::text[] AS tests_incluidos;


ALTER VIEW public.reports_with_tests OWNER TO postgres;

--
-- Name: results_general; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.results_general (
    id integer NOT NULL,
    session_id integer NOT NULL,
    catalog_id integer,
    usuario_id integer,
    resultado_pc jsonb NOT NULL,
    creado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    grafico_data text,
    actualizado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.results_general OWNER TO postgres;

--
-- Name: results_general_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.results_general_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.results_general_id_seq OWNER TO postgres;

--
-- Name: results_general_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.results_general_id_seq OWNED BY public.results_general.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    id integer NOT NULL,
    lab_key text NOT NULL,
    procedure text,
    metodo text,
    producto text,
    ensayo text,
    expediente text,
    unidad text,
    tipo_analisis text,
    tipo_dato text,
    modo_cualitativo text,
    parametro text,
    estado text DEFAULT 'activo'::text,
    creado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    actualizado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    usuario_id integer,
    parent_session_id integer
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sessions_id_seq OWNER TO postgres;

--
-- Name: sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sessions_id_seq OWNED BY public.sessions.id;


--
-- Name: test_modules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.test_modules (
    id integer NOT NULL,
    catalog_id integer NOT NULL,
    version text DEFAULT 'v1.0'::text,
    lenguaje text DEFAULT 'python'::text,
    seguridad text DEFAULT 'sandbox'::text,
    parametros_json jsonb,
    metricas_json jsonb,
    codigo_principal text,
    codigo_dependencias text,
    doc_tecnica text,
    autor text DEFAULT 'zorem'::text,
    fecha_publicacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    obsoleto_en timestamp without time zone,
    activo boolean DEFAULT true,
    codigo_grafico text,
    requisitos_json jsonb DEFAULT '{}'::jsonb,
    code_hash character(64),
    code_sig text,
    active boolean DEFAULT false,
    revoked boolean DEFAULT false,
    published_at timestamp with time zone DEFAULT now(),
    published_by integer,
    CONSTRAINT tm_active_requires_sig_hash CHECK (((active = false) OR ((code_hash IS NOT NULL) AND (code_sig IS NOT NULL))))
);


ALTER TABLE public.test_modules OWNER TO postgres;

--
-- Name: test_modules_approved; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.test_modules_approved AS
 SELECT id,
    catalog_id,
    version,
    lenguaje,
    seguridad,
    parametros_json,
    metricas_json,
    codigo_principal,
    codigo_dependencias,
    doc_tecnica,
    autor,
    fecha_publicacion,
    obsoleto_en,
    activo,
    codigo_grafico,
    requisitos_json,
    code_hash,
    code_sig,
    active,
    revoked,
    published_at,
    published_by
   FROM public.test_modules
  WHERE ((active = true) AND (revoked = false));


ALTER VIEW public.test_modules_approved OWNER TO postgres;

--
-- Name: test_modules_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.test_modules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.test_modules_id_seq OWNER TO postgres;

--
-- Name: test_modules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.test_modules_id_seq OWNED BY public.test_modules.id;


--
-- Name: tests_catalog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tests_catalog (
    id integer NOT NULL,
    lab_key text NOT NULL,
    tipo_analisis text NOT NULL,
    tipo_dato text NOT NULL,
    modo_cualitativo text,
    nombre_interno text NOT NULL,
    titulo text,
    categoria text,
    descripcion text,
    version_actual text DEFAULT '1.0'::text,
    activo boolean DEFAULT true,
    creado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    actualizado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    icon_lib text DEFAULT 'bar-chart-2'::text,
    icon_svg text,
    icon_css text,
    icon_js text,
    icon_sig text,
    icon_hash character(64),
    icon_active boolean DEFAULT false,
    icon_revoked boolean DEFAULT false,
    CONSTRAINT icon_active_requires_sig_hash CHECK (((icon_active = false) OR ((icon_hash IS NOT NULL) AND (icon_sig IS NOT NULL))))
);


ALTER TABLE public.tests_catalog OWNER TO postgres;

--
-- Name: tests_catalog_icons_approved; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.tests_catalog_icons_approved AS
 SELECT id,
    icon_svg,
    icon_css,
    icon_js,
    icon_sig,
    icon_hash
   FROM public.tests_catalog
  WHERE ((icon_active = true) AND (icon_revoked = false));


ALTER VIEW public.tests_catalog_icons_approved OWNER TO postgres;

--
-- Name: tests_catalog_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tests_catalog_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tests_catalog_id_seq OWNER TO postgres;

--
-- Name: tests_catalog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tests_catalog_id_seq OWNED BY public.tests_catalog.id;


--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuarios_id_seq OWNER TO postgres;

--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: inputs_monoanalito id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inputs_monoanalito ALTER COLUMN id SET DEFAULT nextval('public.inputs_monoanalito_id_seq'::regclass);


--
-- Name: inputs_multianalito id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inputs_multianalito ALTER COLUMN id SET DEFAULT nextval('public.inputs_multianalito_id_seq'::regclass);


--
-- Name: lab_data_modes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_data_modes ALTER COLUMN id SET DEFAULT nextval('public.lab_data_modes_id_seq'::regclass);


--
-- Name: labs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.labs ALTER COLUMN id SET DEFAULT nextval('public.labs_id_seq'::regclass);


--
-- Name: logs_sistema id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.logs_sistema ALTER COLUMN id SET DEFAULT nextval('public.logs_sistema_id_seq'::regclass);


--
-- Name: reports id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports ALTER COLUMN id SET DEFAULT nextval('public.reports_id_seq'::regclass);


--
-- Name: results_general id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.results_general ALTER COLUMN id SET DEFAULT nextval('public.results_general_id_seq'::regclass);


--
-- Name: sessions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions ALTER COLUMN id SET DEFAULT nextval('public.sessions_id_seq'::regclass);


--
-- Name: test_modules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_modules ALTER COLUMN id SET DEFAULT nextval('public.test_modules_id_seq'::regclass);


--
-- Name: tests_catalog id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tests_catalog ALTER COLUMN id SET DEFAULT nextval('public.tests_catalog_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Name: allowed_icon_hashes allowed_icon_hashes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allowed_icon_hashes
    ADD CONSTRAINT allowed_icon_hashes_pkey PRIMARY KEY (hash);


--
-- Name: allowed_module_hashes allowed_module_hashes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allowed_module_hashes
    ADD CONSTRAINT allowed_module_hashes_pkey PRIMARY KEY (hash);


--
-- Name: inputs_monoanalito inputs_monoanalito_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inputs_monoanalito
    ADD CONSTRAINT inputs_monoanalito_pkey PRIMARY KEY (id);


--
-- Name: inputs_multianalito inputs_multianalito_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inputs_multianalito
    ADD CONSTRAINT inputs_multianalito_pkey PRIMARY KEY (id);


--
-- Name: lab_data_modes lab_data_modes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_data_modes
    ADD CONSTRAINT lab_data_modes_pkey PRIMARY KEY (id);


--
-- Name: labs labs_lab_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.labs
    ADD CONSTRAINT labs_lab_key_key UNIQUE (lab_key);


--
-- Name: labs labs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.labs
    ADD CONSTRAINT labs_pkey PRIMARY KEY (id);


--
-- Name: logs_sistema logs_sistema_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.logs_sistema
    ADD CONSTRAINT logs_sistema_pkey PRIMARY KEY (id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: reports_tests_link reports_tests_link_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports_tests_link
    ADD CONSTRAINT reports_tests_link_pkey PRIMARY KEY (report_id, catalog_id);


--
-- Name: results_general results_general_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.results_general
    ADD CONSTRAINT results_general_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: test_modules test_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_modules
    ADD CONSTRAINT test_modules_pkey PRIMARY KEY (id);


--
-- Name: tests_catalog tests_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tests_catalog
    ADD CONSTRAINT tests_catalog_pkey PRIMARY KEY (id);


--
-- Name: tests_catalog uq_test_nombre; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tests_catalog
    ADD CONSTRAINT uq_test_nombre UNIQUE (lab_key, nombre_interno);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_username_key UNIQUE (username);


--
-- Name: idx_inputs_mono_session_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inputs_mono_session_id ON public.inputs_monoanalito USING btree (session_id);


--
-- Name: idx_inputs_multi_session_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inputs_multi_session_id ON public.inputs_multianalito USING btree (session_id);


--
-- Name: idx_lab_data_modes_lab_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lab_data_modes_lab_key ON public.lab_data_modes USING btree (lab_key);


--
-- Name: idx_logs_accion; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_logs_accion ON public.logs_sistema USING btree (accion);


--
-- Name: idx_logs_usuario_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_logs_usuario_fecha ON public.logs_sistema USING btree (usuario_id, fecha DESC);


--
-- Name: idx_reports_catalog_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reports_catalog_id ON public.reports USING btree (catalog_id);


--
-- Name: idx_reports_parent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reports_parent_id ON public.reports USING btree (parent_report_id);


--
-- Name: idx_reports_session_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reports_session_id ON public.reports USING btree (session_id);


--
-- Name: idx_reports_usuario_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reports_usuario_id ON public.reports USING btree (usuario_id);


--
-- Name: idx_rg_catalog; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rg_catalog ON public.results_general USING btree (catalog_id);


--
-- Name: idx_rg_sess_cat_ts; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rg_sess_cat_ts ON public.results_general USING btree (session_id, catalog_id, creado_en DESC);


--
-- Name: idx_rg_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rg_session ON public.results_general USING btree (session_id);


--
-- Name: idx_rtl_all; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rtl_all ON public.reports_tests_link USING btree (session_id, report_id, catalog_id);


--
-- Name: idx_rtl_catalog; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rtl_catalog ON public.reports_tests_link USING btree (catalog_id);


--
-- Name: idx_rtl_report; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rtl_report ON public.reports_tests_link USING btree (report_id);


--
-- Name: idx_rtl_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rtl_session ON public.reports_tests_link USING btree (session_id);


--
-- Name: idx_test_modules_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_test_modules_active ON public.test_modules USING btree (active) WHERE (active = true);


--
-- Name: idx_test_modules_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_test_modules_hash ON public.test_modules USING btree (code_hash);


--
-- Name: idx_tests_catalog_icon_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tests_catalog_icon_hash ON public.tests_catalog USING btree (icon_hash);


--
-- Name: reports_with_tests _RETURN; Type: RULE; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW public.reports_with_tests AS
 SELECT r.id AS report_id,
    r.session_id,
    r.tipo_informe,
    r.version_informe,
    r.estado,
    r.creado_en,
    array_agg(c.nombre_interno ORDER BY c.nombre_interno) AS tests_incluidos
   FROM ((public.reports r
     LEFT JOIN public.reports_tests_link rtl ON ((r.id = rtl.report_id)))
     LEFT JOIN public.tests_catalog c ON ((rtl.catalog_id = c.id)))
  GROUP BY r.id;


--
-- Name: test_modules tr_auto_hash_test_modules; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_auto_hash_test_modules BEFORE INSERT OR UPDATE ON public.test_modules FOR EACH ROW EXECUTE FUNCTION public.calcular_hash_test_modules();


--
-- Name: tests_catalog tr_auto_hash_tests_catalog; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_auto_hash_tests_catalog BEFORE INSERT OR UPDATE ON public.tests_catalog FOR EACH ROW EXECUTE FUNCTION public.calcular_hash_tests_catalog();


--
-- Name: tests_catalog tr_clear_hash_if_revoked_tc; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_clear_hash_if_revoked_tc BEFORE UPDATE ON public.tests_catalog FOR EACH ROW EXECUTE FUNCTION public.limpiar_hash_si_revocado_tc();


--
-- Name: test_modules tr_clear_hash_if_revoked_tm; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_clear_hash_if_revoked_tm BEFORE UPDATE ON public.test_modules FOR EACH ROW EXECUTE FUNCTION public.limpiar_hash_si_revocado_tm();


--
-- Name: reports tr_update_reports; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_update_reports BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp_reports();


--
-- Name: results_general tr_update_results_general; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_update_results_general BEFORE UPDATE ON public.results_general FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp_results_general();


--
-- Name: sessions tr_update_sessions; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_update_sessions BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp_sessions();


--
-- Name: test_modules tr_update_test_modules; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_update_test_modules BEFORE UPDATE ON public.test_modules FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_publicacion();


--
-- Name: tests_catalog tr_update_tests_catalog; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_update_tests_catalog BEFORE UPDATE ON public.tests_catalog FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp_tests_catalog();


--
-- Name: usuarios tr_update_usuarios; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_update_usuarios BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp_usuarios();


--
-- Name: tests_catalog trg_forbid_update_signed_tc; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_forbid_update_signed_tc BEFORE UPDATE ON public.tests_catalog FOR EACH ROW EXECUTE FUNCTION public.forbid_update_signed_columns_tc();


--
-- Name: test_modules trg_forbid_update_signed_tm; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_forbid_update_signed_tm BEFORE UPDATE ON public.test_modules FOR EACH ROW EXECUTE FUNCTION public.forbid_update_signed_columns_tm();


--
-- Name: lab_data_modes fk_lab_mode_lab; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_data_modes
    ADD CONSTRAINT fk_lab_mode_lab FOREIGN KEY (lab_key) REFERENCES public.labs(lab_key) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: logs_sistema fk_log_usuario; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.logs_sistema
    ADD CONSTRAINT fk_log_usuario FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: test_modules fk_module_catalog; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_modules
    ADD CONSTRAINT fk_module_catalog FOREIGN KEY (catalog_id) REFERENCES public.tests_catalog(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inputs_monoanalito fk_mono_session; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inputs_monoanalito
    ADD CONSTRAINT fk_mono_session FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inputs_multianalito fk_multi_session; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inputs_multianalito
    ADD CONSTRAINT fk_multi_session FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: reports fk_report_catalog; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT fk_report_catalog FOREIGN KEY (catalog_id) REFERENCES public.tests_catalog(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: reports fk_report_parent; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT fk_report_parent FOREIGN KEY (parent_report_id) REFERENCES public.reports(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: reports fk_report_session; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT fk_report_session FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: reports fk_report_usuario; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT fk_report_usuario FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: results_general fk_rg_catalog; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.results_general
    ADD CONSTRAINT fk_rg_catalog FOREIGN KEY (catalog_id) REFERENCES public.tests_catalog(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: results_general fk_rg_session; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.results_general
    ADD CONSTRAINT fk_rg_session FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: results_general fk_rg_usuario; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.results_general
    ADD CONSTRAINT fk_rg_usuario FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: reports_tests_link fk_rtl_catalog; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports_tests_link
    ADD CONSTRAINT fk_rtl_catalog FOREIGN KEY (catalog_id) REFERENCES public.tests_catalog(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: reports_tests_link fk_rtl_report; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports_tests_link
    ADD CONSTRAINT fk_rtl_report FOREIGN KEY (report_id) REFERENCES public.reports(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: reports_tests_link fk_rtl_session; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports_tests_link
    ADD CONSTRAINT fk_rtl_session FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sessions fk_session_lab; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT fk_session_lab FOREIGN KEY (lab_key) REFERENCES public.labs(lab_key) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sessions fk_session_parent; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT fk_session_parent FOREIGN KEY (parent_session_id) REFERENCES public.sessions(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sessions fk_session_usuario; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT fk_session_usuario FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tests_catalog fk_test_lab; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tests_catalog
    ADD CONSTRAINT fk_test_lab FOREIGN KEY (lab_key) REFERENCES public.labs(lab_key) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: usuarios fk_usuario_lab; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT fk_usuario_lab FOREIGN KEY (default_lab) REFERENCES public.labs(lab_key) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TABLE allowed_icon_hashes; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.allowed_icon_hashes TO app_reader;


--
-- Name: TABLE allowed_module_hashes; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.allowed_module_hashes TO app_reader;


--
-- Name: TABLE test_modules; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.test_modules TO app_reader;
GRANT INSERT ON TABLE public.test_modules TO publisher;


--
-- Name: TABLE test_modules_approved; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.test_modules_approved TO app_reader;


--
-- Name: TABLE tests_catalog; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.tests_catalog TO app_reader;
GRANT INSERT ON TABLE public.tests_catalog TO publisher;


--
-- Name: TABLE tests_catalog_icons_approved; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.tests_catalog_icons_approved TO app_reader;


--
-- PostgreSQL database dump complete
--

\unrestrict XNkaQTWR8LwtXLs91NL6ij3Pxo9rhqRIXGIEhEgWNTyt06Me0UZmRu0eMRUAwHQ

