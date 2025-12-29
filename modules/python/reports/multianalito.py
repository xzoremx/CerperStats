#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CerperStats PDF Report Generator - Multianalito Module

Generates PDF reports for multianalito sessions.
Supports four grouping modes:
- unified: All analitos and levels in one PDF (NO conclusions)
- by_nivel: One PDF per level, all analitos (NO conclusions)
- by_analito: One PDF per analito, all levels (WITH conclusions)
- by_analito_nivel: One PDF per analito+nivel combination (WITH conclusions)

Report structure:
  Category Header (e.g., "PRUEBAS ESTADÍSTICAS APLICADAS A LOS RESULTADOS")
    -> Test Name
       Test description
       - Nivel 1
         Concatenated table (all analitos)
         Conclusion (only for by_analito modes)
         Graph
       - Nivel 2
         ...
"""

import os
import json
from collections import defaultdict

from base import (
    CerperPDFBuilder, 
    get_styles, 
    CATEGORY_HEADER_MAP, 
    CATEGORY_ORDER,
    create_data_table
)


class MultiReportGenerator:
    """Generates PDF reports for multianalito sessions."""
    
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
        
        # Index graphs by catalog_id, nivel, and analito
        self._graph_index = {}
        for g in self.graphs:
            key = (g.get('catalog_id'), g.get('nivel'), g.get('analito'))
            self._graph_index[key] = g.get('grafico_data')
    
    def _get_graph(self, catalog_id, nivel, analito=None):
        """Get graph data for a specific result."""
        return self._graph_index.get((catalog_id, nivel, analito))
    
    def _get_unique_analitos(self):
        """Get list of unique analitos."""
        return sorted(set(r.get('analito') for r in self.results if r.get('analito')))
    
    def _get_unique_niveles(self):
        """Get list of unique niveles."""
        return sorted(set(r.get('nivel', 1) for r in self.results))
    
    def _filter_results(self, analito=None, nivel=None):
        """Filter results by analito and/or nivel."""
        filtered = self.results
        if analito is not None:
            filtered = [r for r in filtered if r.get('analito') == analito]
        if nivel is not None:
            filtered = [r for r in filtered if r.get('nivel') == nivel]
        return filtered
    
    def _get_category_header(self, categoria):
        """Map database category to display header."""
        return CATEGORY_HEADER_MAP.get(categoria, categoria.upper() if categoria else 'OTROS')
    
    def _group_results_by_test_nivel(self, results):
        """
        Group results by test, then by nivel.
        For multianalito, multiple analitos may be under the same test+nivel.
        
        Returns:
            Dict[test_key, Dict[nivel, List[result]]]
            where test_key is (catalog_id, test_name, categoria, descripcion)
        """
        grouped = defaultdict(lambda: defaultdict(list))
        
        for r in results:
            catalog_id = r.get('catalog_id')
            test_name = r.get('test_nombre') or r.get('nombre_interno') or f"Prueba #{catalog_id}"
            categoria = r.get('categoria', 'Tratamiento de Resultados')
            descripcion = r.get('descripcion', '')
            nivel = r.get('nivel', 1)
            
            test_key = (catalog_id, test_name, categoria, descripcion)
            grouped[test_key][nivel].append(r)
        
        return grouped
    
    def _concatenate_tables(self, results_list):
        """
        Concatenate resultado_pc from multiple results into one table.
        All results should have the same column structure.
        
        Returns:
            List of dicts (rows) for the concatenated table
        """
        all_rows = []
        
        for result in results_list:
            resultado_pc = result.get('resultado_pc')
            if isinstance(resultado_pc, str):
                try:
                    resultado_pc = json.loads(resultado_pc)
                except:
                    resultado_pc = []
            
            if isinstance(resultado_pc, list):
                # Add analito identifier to each row if not present
                analito = result.get('analito', '')
                for row in resultado_pc:
                    if isinstance(row, dict):
                        # Add analito column if multianalito
                        row_with_analito = {'analito': analito, **row}
                        all_rows.append(row_with_analito)
        
        return all_rows
    
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
    
    def _generate_pdf(self, filename, results_subset, analito=None, nivel=None):
        """
        Generate a single PDF file.
        
        Args:
            filename: Output filename
            results_subset: List of results to include
            analito: Optional analito for header display
            nivel: Optional nivel for header display
            
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
        
        builder.add_header(title, subtitle=subtitle, analito=analito, nivel=nivel)
        
        # Add session info section
        self._add_session_info(builder)
        
        # Determine if conclusions should be shown
        group_by = self.config.get('group_by', 'unified')
        show_conclusions = group_by in ('by_analito', 'by_analito_nivel')
        
        # Add results organized by category -> test -> nivel
        self._add_results_structured(
            builder, 
            results_subset, 
            show_conclusions=show_conclusions,
            filter_analito=analito,
            filter_nivel=nivel
        )
        
        # Build PDF
        file_hash = builder.build()
        
        # Determine tipo
        if analito and nivel:
            tipo = 'by_analito_nivel'
        elif analito:
            tipo = 'by_analito'
        elif nivel:
            tipo = 'by_nivel'
        else:
            tipo = 'unified'
        
        return {
            'path': output_path,
            'hash': file_hash,
            'nivel': nivel,
            'analito': analito,
            'tipo': tipo
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
    
    def _add_results_structured(self, builder, results, show_conclusions=True, 
                                 filter_analito=None, filter_nivel=None):
        """
        Add results organized by: Category Header -> Test -> Nivel.
        
        For multianalito:
        - Tables are concatenated (all analitos for the same test+nivel)
        - Conclusions only shown if show_conclusions=True (by_analito modes)
        - Graphs shown per nivel (first available or combined)
        """
        include_graphs = self.config.get('include_graphs', True)
        include_tables = self.config.get('include_tables', True)
        
        # Group results: test_key -> {nivel: [results]}
        grouped = self._group_results_by_test_nivel(results)
        
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
                if filter_nivel is not None:
                    sorted_niveles = [n for n in sorted_niveles if n == filter_nivel]
                
                for nivel in sorted_niveles:
                    results_for_nivel = niveles_data[nivel]
                    
                    # Filter by analito if specified
                    if filter_analito is not None:
                        results_for_nivel = [r for r in results_for_nivel if r.get('analito') == filter_analito]
                    
                    if not results_for_nivel:
                        continue
                    
                    # Concatenate tables from all analitos for this nivel
                    concatenated_table = self._concatenate_tables(results_for_nivel) if include_tables else None
                    
                    # Get conclusion (only for by_analito modes)
                    # Use the first result's conclusion (they should be individual per analito)
                    conclusion = None
                    if show_conclusions and results_for_nivel:
                        # For by_analito_nivel: single conclusion
                        # For by_analito: combine conclusions from all niveles shown
                        conclusion = results_for_nivel[0].get('conclusion')
                    
                    # Get ALL graphs (one per analito)
                    graphs_list = []
                    if include_graphs:
                        for r in results_for_nivel:
                            analito = r.get('analito')
                            graph = self._get_graph(catalog_id, nivel, analito)
                            if graph:
                                graphs_list.append((analito, graph))
                    
                    # Add nivel section with all graphs
                    builder.add_nivel_section(
                        nivel=nivel,
                        table_data=concatenated_table,
                        conclusion=conclusion,
                        graphs_list=graphs_list if graphs_list else None,
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
        
        if group_by == 'by_analito_nivel':
            # One PDF per analito+nivel combination
            for analito in self._get_unique_analitos():
                for nivel in self._get_unique_niveles():
                    results_subset = self._filter_results(analito=analito, nivel=nivel)
                    if results_subset:
                        safe_analito = analito.replace(' ', '_').replace('/', '-')
                        filename = f"informe_sesion_{self.session_id}_{safe_analito}_nivel_{nivel}.pdf"
                        pdf_info = self._generate_pdf(filename, results_subset, analito=analito, nivel=nivel)
                        generated.append(pdf_info)
        
        elif group_by == 'by_analito':
            # One PDF per analito (all niveles)
            for analito in self._get_unique_analitos():
                results_subset = self._filter_results(analito=analito)
                if results_subset:
                    safe_analito = analito.replace(' ', '_').replace('/', '-')
                    filename = f"informe_sesion_{self.session_id}_{safe_analito}.pdf"
                    pdf_info = self._generate_pdf(filename, results_subset, analito=analito)
                    generated.append(pdf_info)
        
        elif group_by == 'by_nivel':
            # One PDF per nivel (all analitos) - NO conclusions
            for nivel in self._get_unique_niveles():
                results_subset = self._filter_results(nivel=nivel)
                if results_subset:
                    filename = f"informe_sesion_{self.session_id}_nivel_{nivel}.pdf"
                    pdf_info = self._generate_pdf(filename, results_subset, nivel=nivel)
                    generated.append(pdf_info)
        
        else:
            # unified: All in one PDF - NO conclusions
            filename = f"informe_sesion_{self.session_id}_unificado.pdf"
            pdf_info = self._generate_pdf(filename, self.results)
            generated.append(pdf_info)
        
        return generated
