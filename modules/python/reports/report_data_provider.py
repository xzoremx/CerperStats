#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CerperStats Report Data Provider

Transforms raw session data into structured JSON for HTML report generation.
Replaces the direct PDF generation logic from monoanalito.py/multianalito.py.
"""

import json
from collections import defaultdict
from datetime import datetime

# =============================================================================
# Constants & Helpers
# =============================================================================

CATEGORY_HEADER_MAP = {
    'Tratamiento de Resultados': 'PRUEBAS ESTADÍSTICAS APLICADAS A LOS RESULTADOS',
    'Atípicos': 'PRUEBAS ESTADÍSTICAS APLICADAS A LOS RESULTADOS',
    'Veracidad': 'VERACIDAD',
    'Precisión': 'PRECISIÓN',
}

CATEGORY_ORDER = [
    'PRUEBAS ESTADÍSTICAS APLICADAS A LOS RESULTADOS',
    'VERACIDAD',
    'PRECISIÓN',
]

def format_value(value):
    """Format a value for display."""
    if value is None:
        return "-"
    if isinstance(value, bool):
        return "Sí" if value else "No"
    if isinstance(value, float):
        if value != value:  # NaN check
            return "-"
        return f"{value:.4f}" if abs(value) < 1000 else f"{value:.2f}"
    return str(value)

def get_conclusion_status(conclusion_text):
    """Determine status (success/danger/neutral) from conclusion text."""
    if not conclusion_text:
        return 'neutral'
    
    text = str(conclusion_text).lower()
    if any(w in text for w in ['cumple', 'normal', 'sí', 'aprobado', 'homogéneo']):
        return 'success'
    if any(w in text for w in ['no cumple', 'no normal', 'rechazado', 'no homogéneo']):
        return 'danger'
    return 'neutral'

def get_category_header(categoria):
    """Map database category to display header."""
    return CATEGORY_HEADER_MAP.get(categoria, categoria.upper() if categoria else 'OTROS')

# =============================================================================
# Main Data Provider Class
# =============================================================================

class ReportDataProvider:
    """Provides structured data for reports."""
    
    def __init__(self, data, config):
        self.session_id = data.get('session_id')
        self.session_info = data.get('session_info', {})
        self.results = data.get('results', [])
        self.graphs = data.get('graphs', [])
        self.config = config
        
        # Index graphs
        self._graph_index = {}
        for g in self.graphs:
            # Key: (catalog_id, nivel, analito) - analito can be None for mono
            key = (g.get('catalog_id'), g.get('nivel'), g.get('analito'))
            self._graph_index[key] = g.get('grafico_data')

    def _get_graph(self, catalog_id, nivel, analito=None):
        """Get graph data, trying specific analito first, then generic."""
        # Try specific match
        g = self._graph_index.get((catalog_id, nivel, analito))
        if g: return g
        
        # Try generic (None analito) if monoanalito
        return self._graph_index.get((catalog_id, nivel, None))

    def get_report_data(self):
        """
        Main entry point. Returns list of report objects based on grouping config.
        """
        group_by = self.config.get('group_by', 'unified')
        reports = []
        
        if group_by == 'by_analito_nivel':
            reports = self._generate_by_analito_nivel()
        elif group_by == 'by_analito':
            reports = self._generate_by_analito()
        elif group_by == 'by_nivel':
            reports = self._generate_by_nivel()
        else: # unified
            reports = self._generate_unified()
            
        return reports

    # =========================================================================
    # Generation Strategies
    # =========================================================================

    def _generate_unified(self):
        """All results in one report."""
        return [self._build_report_structure(
            self.results, 
            title_suffix="Unificado", 
            filename_suffix="unificado"
        )]

    def _generate_by_nivel(self):
        """One report per nivel."""
        by_nivel = defaultdict(list)
        for r in self.results:
            by_nivel[r.get('nivel', 1)].append(r)
            
        reports = []
        for nivel, subset in by_nivel.items():
            reports.append(self._build_report_structure(
                subset,
                title_suffix=f"Nivel {nivel}",
                filename_suffix=f"nivel_{nivel}",
                filter_nivel=nivel
            ))
        return reports

    def _generate_by_analito(self):
        """One report per analito."""
        by_analito = defaultdict(list)
        for r in self.results:
            analito = r.get('analito')
            if analito:
                by_analito[analito].append(r)
                
        reports = []
        for analito, subset in by_analito.items():
            safe_analito = analito.replace(' ', '_').replace('/', '-')
            reports.append(self._build_report_structure(
                subset,
                title_suffix=analito,
                filename_suffix=safe_analito,
                filter_analito=analito
            ))
        return reports

    def _generate_by_analito_nivel(self):
        """One report per analito + nivel."""
        grouped = defaultdict(list)
        for r in self.results:
            analito = r.get('analito')
            nivel = r.get('nivel', 1)
            if analito:
                grouped[(analito, nivel)].append(r)
                
        reports = []
        for (analito, nivel), subset in grouped.items():
            safe_analito = analito.replace(' ', '_').replace('/', '-')
            reports.append(self._build_report_structure(
                subset,
                title_suffix=f"{analito} - Nivel {nivel}",
                filename_suffix=f"{safe_analito}_nivel_{nivel}",
                filter_analito=analito,
                filter_nivel=nivel
            ))
        return reports

    # =========================================================================
    # Structure Builder
    # =========================================================================

    def _build_report_structure(self, results_subset, title_suffix="", filename_suffix="", filter_analito=None, filter_nivel=None):
        """Build the complete JSON structure for a single report."""
        
        # 1. Prepare Cover Data
        cover_data = self._build_cover_data(results_subset, title_suffix)
        
        # 2. Prepare Sections Data
        sections_data = self._build_sections_data(results_subset, filter_analito, filter_nivel)
        
        return {
            "filename": f"informe_sesion_{self.session_id}_{filename_suffix}.pdf",
            "data": {
                "cover": cover_data,
                "sections": sections_data
            }
        }

    def _build_cover_data(self, results, title_suffix):
        info = self.session_info
        exec_date = self.config.get('execution_date') or datetime.now().strftime('%d/%m/%Y')
        
        # Participants
        participants = []
        analyst_names = self.config.get('analyst_names', [])
        is_analyst_param = (info.get('parametro') or '').lower() == 'analista'
        
        if is_analyst_param and analyst_names:
            for i, name in enumerate(analyst_names, 1):
                participants.append({"index": f"Analista {i}", "name": name})

        # Tests List for Cover
        test_names_by_category = defaultdict(list)
        seen_tests = set()
        for r in results:
            cat_header = get_category_header(r.get('categoria'))
            name = r.get('titulo') or r.get('test_titulo') or r.get('nombre_interno')
            
            if (cat_header, name) not in seen_tests:
                test_names_by_category[cat_header].append(name)
                seen_tests.add((cat_header, name))
        
        tests_list = []
        for header in CATEGORY_ORDER + [k for k in test_names_by_category.keys() if k not in CATEGORY_ORDER]:
            if header in test_names_by_category:
                tests_list.append({
                    "header": header,
                    "tests": test_names_by_category[header]
                })

        return {
            "title": "INFORME ESTADÍSTICO",
            "subtitle": title_suffix, # Can be used in template if needed
            "lab": info.get('lab_nombre') or info.get('lab_key', ''),
            "expediente": info.get('expediente', ''),
            "fecha": exec_date,
            "ensayo": info.get('ensayo', ''),
            "metodo": info.get('metodo', ''),
            "producto": info.get('producto', ''),
            "unidad": info.get('unidad', ''),
            "parametro": info.get('parametro', ''),
            "participants": participants,
            "tests_list": tests_list,
            "logo": self.config.get('logo_path_url'), # Needs special handling for file:// probably
            "signatures": {
                "supervisor_name": info.get('supervisor_nombre') or info.get('supervisor') or '_________________',
                "supervisor_role": "Supervisor / Responsable de laboratorio"
            }
        }

    def _build_sections_data(self, results, filter_analito, filter_nivel):
        """Group results into sections -> tests -> niveles."""
        
        # Group by Header -> Test(CatalogID) -> Nivel
        grouped = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
        
        for r in results:
            cat_header = get_category_header(r.get('categoria'))
            
            test_id = r.get('catalog_id')
            test_name = r.get('titulo') or r.get('test_titulo') or r.get('nombre_interno')
            test_desc = r.get('descripcion', '')
            
            # Key for test uniqueness
            test_key = (test_id, test_name, test_desc)
            
            nivel = r.get('nivel', 1)
            
            grouped[cat_header][test_key][nivel].append(r)
            
        # Build output structure
        sections = []
        
        # Order categories
        headers = [h for h in CATEGORY_ORDER if h in grouped] + [h for h in grouped if h not in CATEGORY_ORDER]
        
        for header in headers:
            tests_data = []
            test_keys_sorted = sorted(grouped[header].keys(), key=lambda x: x[0] or 0) # Sort by catalog_id
            
            for test_key in test_keys_sorted:
                test_id, test_name, test_desc = test_key
                niveles_dict = grouped[header][test_key]
                
                niveles_data = []
                sorted_niveles = sorted(niveles_dict.keys())
                
                for nivel in sorted_niveles:
                    r_list = niveles_dict[nivel]
                    if not r_list: continue
                    
                    # Prepare Table
                    table_rows = []
                    cols = set()
                    
                    for r in r_list:
                        # Parse JSONB
                        raw_pc = r.get('resultado_pc')
                        if isinstance(raw_pc, str):
                            try:
                                raw_pc = json.loads(raw_pc)
                            except:
                                raw_pc = []
                        if not isinstance(raw_pc, list): raw_pc = []
                        
                        analito_label = r.get('analito')
                        
                        for row in raw_pc:
                            formatted = {k: format_value(v) for k,v in row.items()}
                            if analito_label and len(r_list) > 1: # If multianalito mixed
                                formatted['_analito'] = analito_label # Internal key? Or display
                                # Actually, user wants tables concatenated usually
                            table_rows.append(formatted)
                            cols.update(formatted.keys())
                            
                    # Table Columns Logic
                    columns = self._order_columns(cols)
                    
                    # Graphs
                    graphs = []
                    include_graphs = self.config.get('include_graphs', True)
                    if include_graphs:
                        # Collect graphs for this test+nivel
                        # If multianalito, we might have multiple
                        for r in r_list:
                             analito = r.get('analito')
                             g_data = self._get_graph(test_id, nivel, analito)
                             if g_data:
                                 graphs.append({
                                     "data": g_data if g_data.startswith('data:') else f"data:image/png;base64,{g_data}",
                                     "label": analito if len(r_list) > 1 else None
                                 })

                    # Conclusion
                    # Usually just one conclusion per analito.
                    # If mixed (unified), usually we pick one or show multiple?
                    # The old logic:
                    # by_analito -> show conclusion
                    # unified -> NO conclusion (because it's mixed)
                    conclusion = None
                    show_conclusions = (filter_analito is not None) or (self.config.get('group_by') in ['by_analito', 'by_analito_nivel'])
                    
                    if show_conclusions and r_list:
                         c_text = r_list[0].get('conclusion')
                         if c_text:
                             conclusion = {
                                 "text": c_text,
                                 "status": get_conclusion_status(c_text)
                             }

                    niveles_data.append({
                        "nivel": nivel if len(sorted_niveles) > 1 or filter_nivel is None else None, # Hide nivel title if filtered by single level?
                        # Actually old logic always shows "- Nivel X"
                        "nivel_label": f"Nivel {nivel}", 
                        "table": {"rows": table_rows, "columns": columns},
                        "conclusion": conclusion,
                        "graphs": graphs
                    })
                    
                tests_data.append({
                    "name": test_name,
                    "description": test_desc,
                    "niveles": niveles_data
                })
                
            sections.append({
                "header": header,
                "tests": tests_data
            })
            
        return sections

    def _order_columns(self, keys):
        """Order columns logically."""
        priority = ['analito', 'parametro', 'n', 'media', 'desviacion', 'cv', 'asimetria', 'curtosis', 'p_value', 'estadistico', 'normalidad', 'homogeneidad']
        ordered = []
        keys = set(keys)
        
        for k in priority:
            if k in keys:
                ordered.append(k)
                keys.remove(k)
        
        ordered.extend(sorted(list(keys)))
        
        # Map to label objects
        labels = {
            'n': 'n',
            'media': 'Media',
            'desviacion': 'Desv. Est.',
            'asimetria': 'Asimetría',
            'curtosis': 'Curtosis',
            'p_value': 'P-Value',
            'normalidad': 'Normalidad',
            'analito': 'Analito',
            'parametro': 'Parámetro',
             # Add other mappings...
        }
        
        return [{"key": k, "label": labels.get(k, k.replace('_', ' ').title())} for k in ordered]
