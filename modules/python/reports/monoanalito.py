#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CerperStats PDF Report Generator - Monoanalito Module

Generates PDF reports for monoanalito sessions.
Supports two grouping modes:
- unified: All levels in one PDF
- by_nivel: One PDF per level

Report structure:
  Category Header (e.g., "PRUEBAS ESTADÍSTICAS APLICADAS A LOS RESULTADOS")
    -> Test Name
       Test description
       - Nivel 1
         Table | Conclusion | Graph
       - Nivel 2
         Table | Conclusion | Graph
"""

import os
import json
from collections import defaultdict

from base import (
    CerperPDFBuilder, 
    get_styles, 
    CATEGORY_HEADER_MAP, 
    CATEGORY_ORDER
)


class MonoReportGenerator:
    """Generates PDF reports for monoanalito sessions."""
    
    def __init__(self, data, config, output_dir, logo_path=None):
        """
        Initialize the generator.
        
        Args:
            data: Dict with session_id, session_info, results, graphs
            config: Dict with group_by, include_graphs, include_tables, etc.
            output_dir: Directory to save generated PDFs
            logo_path: Optional path to logo image
        """
        self.session_id = data.get('session_id')
        self.session_info = data.get('session_info', {})
        self.results = data.get('results', [])
        self.graphs = data.get('graphs', [])
        self.config = config
        self.output_dir = output_dir
        self.logo_path = logo_path
        
        # Index graphs by catalog_id and nivel
        self._graph_index = {}
        for g in self.graphs:
            key = (g.get('catalog_id'), g.get('nivel'))
            self._graph_index[key] = g.get('grafico_data')
    
    def _get_graph(self, catalog_id, nivel):
        """Get graph data for a specific result."""
        return self._graph_index.get((catalog_id, nivel))
    
    def _group_results_by_nivel(self):
        """Group results by nivel."""
        by_nivel = defaultdict(list)
        for r in self.results:
            nivel = r.get('nivel', 1)
            by_nivel[nivel].append(r)
        return dict(by_nivel)
    
    def _group_results_by_test_and_nivel(self, results):
        """
        Group results by test name, then by nivel.
        
        Returns:
            Dict[test_key, Dict[nivel, result]]
            where test_key is (catalog_id, test_name, categoria, descripcion)
        """
        grouped = defaultdict(lambda: defaultdict(dict))
        
        for r in results:
            catalog_id = r.get('catalog_id')
            test_name = r.get('test_nombre') or r.get('nombre_interno') or f"Prueba #{catalog_id}"
            categoria = r.get('categoria', 'Tratamiento de Resultados')
            descripcion = r.get('descripcion', '')
            nivel = r.get('nivel', 1)
            
            test_key = (catalog_id, test_name, categoria, descripcion)
            grouped[test_key][nivel] = r
        
        return grouped
    
    def _get_category_header(self, categoria):
        """Map database category to display header."""
        return CATEGORY_HEADER_MAP.get(categoria, categoria.upper() if categoria else 'OTROS')
    
    def _get_test_names_by_category(self, results):
        """
        Extract unique test names grouped by category header.
        Used for the cover page.
        """
        test_names_by_category = {}
        seen_tests = set()
        
        for r in results:
            catalog_id = r.get('catalog_id')
            test_name = r.get('test_nombre') or r.get('nombre_interno') or f"Prueba #{catalog_id}"
            categoria = r.get('categoria', 'Tratamiento de Resultados')
            header = self._get_category_header(categoria)
            
            # Avoid duplicates
            if (header, test_name) in seen_tests:
                continue
            seen_tests.add((header, test_name))
            
            if header not in test_names_by_category:
                test_names_by_category[header] = []
            test_names_by_category[header].append(test_name)
        
        return test_names_by_category
    
    def _generate_pdf(self, filename, results_subset, nivel=None):
        """
        Generate a single PDF file.
        
        Args:
            filename: Output filename
            results_subset: List of results to include
            nivel: Optional nivel for header display (used in by_nivel mode)
            
        Returns:
            Dict with path, hash, nivel, analito info
        """
        output_path = os.path.join(self.output_dir, filename)
        
        builder = CerperPDFBuilder(
            output_path=output_path,
            logo_path=self.logo_path,
            session_info=self.session_info,
            config=self.config
        )
        
        # ===== COVER PAGE (mandatory first page) =====
        test_names_by_category = self._get_test_names_by_category(results_subset)
        builder.add_cover_page(test_names_by_category)
        
        # ===== CONTENT HEADER =====
        lab_nombre = self.session_info.get('lab_nombre', self.session_info.get('lab_key', 'CerperStats'))
        metodo = self.session_info.get('metodo', '')
        
        title = "INFORME ESTADÍSTICO"
        subtitle = f"{lab_nombre} - {metodo}" if metodo else lab_nombre
        
        builder.add_header(title, subtitle=subtitle, nivel=nivel)
        
        # Add session info section
        self._add_session_info(builder)
        
        # Add results organized by category -> test -> nivel
        self._add_results_structured(builder, results_subset, nivel_filter=nivel)
        
        # Build PDF
        file_hash = builder.build()
        
        return {
            'path': output_path,
            'hash': file_hash,
            'nivel': nivel,
            'analito': None,
            'tipo': 'unified' if nivel is None else 'by_nivel'
        }
    
    def _add_session_info(self, builder):
        """Add session information section."""
        info = self.session_info
        builder.add_section_title("Información de la Sesión")
        
        info_lines = []
        if info.get('producto'):
            info_lines.append(f"<b>Producto:</b> {info['producto']}")
        if info.get('ensayo'):
            info_lines.append(f"<b>Ensayo:</b> {info['ensayo']}")
        if info.get('metodo'):
            info_lines.append(f"<b>Método:</b> {info['metodo']}")
        if info.get('unidad'):
            info_lines.append(f"<b>Unidad:</b> {info['unidad']}")
        if info.get('parametro'):
            info_lines.append(f"<b>Parámetro:</b> {info['parametro']}")
        if info.get('expediente'):
            info_lines.append(f"<b>Expediente:</b> {info['expediente']}")
        
        if info_lines:
            builder.add_text(" | ".join(info_lines))
        
        builder.add_spacer()
    
    def _add_results_structured(self, builder, results, nivel_filter=None):
        """
        Add results organized by: Category Header -> Test -> Nivel.
        
        Structure for unified mode:
          CATEGORY HEADER
            -> Test Name
               description
               - Nivel 1: table, conclusion, graph
               - Nivel 2: table, conclusion, graph
        
        Structure for by_nivel mode:
          CATEGORY HEADER
            -> Test Name
               description
               table, conclusion, graph (single nivel)
        """
        include_graphs = self.config.get('include_graphs', True)
        include_tables = self.config.get('include_tables', True)
        
        # Group results: test_key -> {nivel: result}
        grouped = self._group_results_by_test_and_nivel(results)
        
        # Group tests by their mapped category header
        by_category_header = defaultdict(list)
        for test_key in grouped.keys():
            catalog_id, test_name, categoria, descripcion = test_key
            header = self._get_category_header(categoria)
            by_category_header[header].append(test_key)
        
        # Process categories in the defined order
        ordered_headers = []
        for header in CATEGORY_ORDER:
            if header in by_category_header:
                ordered_headers.append(header)
        # Add any headers not in CATEGORY_ORDER
        for header in by_category_header.keys():
            if header not in ordered_headers:
                ordered_headers.append(header)
        
        # Generate content
        for header in ordered_headers:
            test_keys = by_category_header[header]
            
            # Add category header
            builder.add_category_header(header)
            
            # Sort tests by catalog_id for consistent ordering
            test_keys_sorted = sorted(test_keys, key=lambda x: x[0] or 0)
            
            for test_key in test_keys_sorted:
                catalog_id, test_name, categoria, descripcion = test_key
                niveles_data = grouped[test_key]
                
                # Add test name and description
                builder.add_test_with_description(test_name, descripcion)
                
                # Get sorted niveles
                sorted_niveles = sorted(niveles_data.keys())
                
                # Filter by nivel if specified
                if nivel_filter is not None:
                    sorted_niveles = [n for n in sorted_niveles if n == nivel_filter]
                
                for nivel in sorted_niveles:
                    result = niveles_data[nivel]
                    
                    # Parse resultado_pc
                    resultado_pc = result.get('resultado_pc')
                    if isinstance(resultado_pc, str):
                        try:
                            resultado_pc = json.loads(resultado_pc)
                        except:
                            resultado_pc = []
                    
                    # Get conclusion
                    conclusion = result.get('conclusion')
                    
                    # Get graph
                    graph_data = self._get_graph(catalog_id, nivel) if include_graphs else None
                    
                    # Add nivel section
                    builder.add_nivel_section(
                        nivel=nivel,
                        table_data=resultado_pc if include_tables else None,
                        conclusion=conclusion,
                        graph_data=graph_data,
                        include_graph=include_graphs
                    )
    
    def generate(self):
        """
        Generate PDFs according to config.group_by.
        
        Returns:
            List of dicts with generated PDF info (path, hash, nivel, analito, tipo)
        """
        group_by = self.config.get('group_by', 'unified')
        generated = []
        
        if group_by == 'by_nivel':
            # One PDF per nivel
            by_nivel = self._group_results_by_nivel()
            for nivel in sorted(by_nivel.keys()):
                results_subset = by_nivel[nivel]
                filename = f"informe_sesion_{self.session_id}_nivel_{nivel}.pdf"
                pdf_info = self._generate_pdf(filename, results_subset, nivel=nivel)
                generated.append(pdf_info)
        else:
            # unified: All in one PDF
            filename = f"informe_sesion_{self.session_id}_unificado.pdf"
            pdf_info = self._generate_pdf(filename, self.results)
            generated.append(pdf_info)
        
        return generated
