--
-- PostgreSQL database dump
--

\restrict 86lpg7f7ZJTTwPHFeOqsH7UjdqqP1J4fnv0SJ84EHtlIJeu6oYPnWr2HgwOntnM

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
-- Name: normalize_icon_lib(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.normalize_icon_lib() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
BEGIN
  IF NEW.icon_lib IS NULL OR btrim(NEW.icon_lib) = '' OR NEW.icon_lib ~* '^\s*<svg' THEN
    NEW.icon_lib := 'lucide:bar-chart-2';
  ELSIF NEW.icon_lib ~* '^\s*lucide:' THEN
    NEW.icon_lib := 'lucide:' || regexp_replace(
      regexp_replace(lower(substring(NEW.icon_lib from '^\s*lucide:(.*)$')), '\s+', '', 'g'),
      '[^a-z0-9-]', '', 'g'
    );
    IF NEW.icon_lib = 'lucide:' THEN
      NEW.icon_lib := 'lucide:bar-chart-2';
    END IF;
  ELSE
    NEW.icon_lib := 'lucide:bar-chart-2';
  END IF;
  RETURN NEW;
END $_$;


ALTER FUNCTION public.normalize_icon_lib() OWNER TO postgres;

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN NEW.actualizado_en := NOW(); RETURN NEW; END $$;


ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

--
-- Name: test_module_increment_exec(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.test_module_increment_exec(p_catalog_id integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE public.test_modules
     SET exec_count = exec_count + 1,
         last_executed_at = NOW()
   WHERE catalog_id = p_catalog_id
     AND activo = TRUE;
END;
$$;


ALTER FUNCTION public.test_module_increment_exec(p_catalog_id integer) OWNER TO postgres;

--
-- Name: test_modules_increment_exec(integer[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.test_modules_increment_exec(p_catalog_ids integer[]) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE public.test_modules
     SET exec_count = exec_count + 1,
         last_executed_at = NOW()
   WHERE catalog_id = ANY (p_catalog_ids)
     AND activo = TRUE;
END;
$$;


ALTER FUNCTION public.test_modules_increment_exec(p_catalog_ids integer[]) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

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
-- Name: session_selected_tests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.session_selected_tests (
    session_id integer NOT NULL,
    catalog_id integer NOT NULL,
    selected_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.session_selected_tests OWNER TO postgres;

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
    parametros_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    metricas_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    autor text DEFAULT 'zorem'::text,
    fecha_publicacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    obsoleto_en timestamp without time zone,
    activo boolean DEFAULT true,
    requisitos_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    selected boolean DEFAULT false NOT NULL,
    exec_count integer DEFAULT 0 NOT NULL,
    last_executed_at timestamp with time zone,
    CONSTRAINT chk_test_modules_exec_count_nonneg CHECK ((exec_count >= 0))
);


ALTER TABLE public.test_modules OWNER TO postgres;

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
    creado_en timestamp without time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp without time zone DEFAULT now() NOT NULL,
    icon_lib text DEFAULT 'lucide:bar-chart-2'::text NOT NULL,
    CONSTRAINT icon_lib_lucide_only CHECK (((icon_lib ~ '^[a-z]*:?lucide:[a-z0-9][a-z0-9-]*$'::text) OR (icon_lib ~ '^lucide:[a-z0-9][a-z0-9-]*$'::text)))
);


ALTER TABLE public.tests_catalog OWNER TO postgres;

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
-- Name: session_selected_tests session_selected_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session_selected_tests
    ADD CONSTRAINT session_selected_tests_pkey PRIMARY KEY (session_id, catalog_id);


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
-- Name: test_modules uq_test_modules_catalog_version; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_modules
    ADD CONSTRAINT uq_test_modules_catalog_version UNIQUE (catalog_id, version);


--
-- Name: tests_catalog uq_test_nombre; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tests_catalog
    ADD CONSTRAINT uq_test_nombre UNIQUE (lab_key, nombre_interno);


--
-- Name: tests_catalog uq_tests_catalog_lab_nombre; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tests_catalog
    ADD CONSTRAINT uq_tests_catalog_lab_nombre UNIQUE (lab_key, nombre_interno);


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
-- Name: idx_test_modules_activo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_test_modules_activo ON public.test_modules USING btree (activo) WHERE (activo = true);


--
-- Name: idx_test_modules_catalog; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_test_modules_catalog ON public.test_modules USING btree (catalog_id);


--
-- Name: idx_test_modules_selected; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_test_modules_selected ON public.test_modules USING btree (selected);


--
-- Name: idx_tests_catalog_lab; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tests_catalog_lab ON public.tests_catalog USING btree (lab_key, tipo_analisis, tipo_dato);


--
-- Name: idx_tests_catalog_nombre; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tests_catalog_nombre ON public.tests_catalog USING btree (nombre_interno);


--
-- Name: uq_tm_one_active_per_test; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_tm_one_active_per_test ON public.test_modules USING btree (catalog_id) WHERE (activo = true);


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
-- Name: tests_catalog tr_update_tests_catalog; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_update_tests_catalog BEFORE UPDATE ON public.tests_catalog FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp_tests_catalog();


--
-- Name: usuarios tr_update_usuarios; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_update_usuarios BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp_usuarios();


--
-- Name: tests_catalog trg_normalize_icon_lib; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_normalize_icon_lib BEFORE INSERT OR UPDATE OF icon_lib ON public.tests_catalog FOR EACH ROW EXECUTE FUNCTION public.normalize_icon_lib();


--
-- Name: tests_catalog trg_tests_catalog_updated; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_tests_catalog_updated BEFORE UPDATE ON public.tests_catalog FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


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
-- Name: test_modules fk_test_modules_catalog; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_modules
    ADD CONSTRAINT fk_test_modules_catalog FOREIGN KEY (catalog_id) REFERENCES public.tests_catalog(id) ON DELETE CASCADE;


--
-- Name: usuarios fk_usuario_lab; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT fk_usuario_lab FOREIGN KEY (default_lab) REFERENCES public.labs(lab_key) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: session_selected_tests session_selected_tests_catalog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session_selected_tests
    ADD CONSTRAINT session_selected_tests_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES public.tests_catalog(id) ON DELETE CASCADE;


--
-- Name: session_selected_tests session_selected_tests_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session_selected_tests
    ADD CONSTRAINT session_selected_tests_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 86lpg7f7ZJTTwPHFeOqsH7UjdqqP1J4fnv0SJ84EHtlIJeu6oYPnWr2HgwOntnM

