#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CerperStats PDF Report Generator

Generates professional PDF reports using ReportLab/Platypus.
Supports multiple grouping modes: by_analito, by_nivel, by_analito_nivel, unified.

Usage:
    python report_generator.py <input_json> <output_dir> [--logo <logo_path>]

Input JSON format:
{
    "session_id": 123,
    "session_info": { "lab_key": "...", "metodo": "...", ... },
    "config": {
        "group_by": "by_analito" | "by_nivel" | "by_analito_nivel" | "unified",
        "include_graphs": true,
        "include_tables": true
    },
    "results": [...],  // results_general rows
    "graphs": [...]    // evaluaciones_graficos rows
}

Output: List of generated PDF paths written to stdout as JSON
"""

import sys
import os
import json
import base64
import hashlib
from io import BytesIO
from datetime import datetime
from collections import defaultdict

# ReportLab imports
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm, mm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

# Try to import PIL for image processing
try:
    from PIL import Image as PILImage
    HAS_PIL = True
except ImportError:
    HAS_PIL = False


# =============================================================================
# Constants
# =============================================================================

PAGE_SIZE = A4
MARGIN = 2 * cm
LOGO_HEIGHT = 1.2 * cm

# Color palette (CerperStats theme)
COLOR_PRIMARY = colors.HexColor('#4f46e5')      # Indigo
COLOR_SECONDARY = colors.HexColor('#64748b')    # Slate
COLOR_SUCCESS = colors.HexColor('#059669')      # Green
COLOR_DANGER = colors.HexColor('#dc2626')       # Red
COLOR_HEADER_BG = colors.HexColor('#f8fafc')    # Light gray
COLOR_BORDER = colors.HexColor('#e2e8f0')       # Border gray


# =============================================================================
# Styles
# =============================================================================

def get_styles():
    """Create custom paragraph styles."""
    styles = getSampleStyleSheet()
    
    styles.add(ParagraphStyle(
        name='ReportTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=6,
        fontName='Helvetica-Bold'
    ))
    
    styles.add(ParagraphStyle(
        name='ReportSubtitle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=COLOR_SECONDARY,
        spaceAfter=12
    ))
    
    styles.add(ParagraphStyle(
        name='SectionTitle',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=COLOR_PRIMARY,
        spaceBefore=16,
        spaceAfter=8,
        fontName='Helvetica-Bold'
    ))
    
    styles.add(ParagraphStyle(
        name='TestTitle',
        parent=styles['Heading3'],
        fontSize=11,
        textColor=colors.HexColor('#1e293b'),
        spaceBefore=12,
        spaceAfter=6,
        fontName='Helvetica-Bold'
    ))
    
    # Use CerperBodyText to avoid conflict with default BodyText
    styles.add(ParagraphStyle(
        name='CerperBodyText',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#334155'),
        spaceAfter=6
    ))
    
    styles.add(ParagraphStyle(
        name='TableHeader',
        parent=styles['Normal'],
        fontSize=8,
        textColor=COLOR_SECONDARY,
        fontName='Helvetica-Bold'
    ))
    
    styles.add(ParagraphStyle(
        name='TableCell',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#1e293b')
    ))
    
    styles.add(ParagraphStyle(
        name='Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=COLOR_SECONDARY,
        alignment=TA_CENTER
    ))
    
    return styles


# =============================================================================
# Helper Functions
# =============================================================================

def decode_base64_image(data_url, max_width=400, max_height=250):
    """Decode a base64 data URL to a ReportLab Image object."""
    if not data_url or not isinstance(data_url, str):
        return None
    
    try:
        # Extract base64 data
        if ';base64,' in data_url:
            header, encoded = data_url.split(';base64,', 1)
        else:
            return None
        
        # Decode
        image_data = base64.b64decode(encoded)
        
        # Create image buffer
        img_buffer = BytesIO(image_data)
        
        # Get dimensions using PIL if available
        if HAS_PIL:
            pil_img = PILImage.open(BytesIO(image_data))
            orig_width, orig_height = pil_img.size
            
            # Calculate scaled dimensions
            scale = min(max_width / orig_width, max_height / orig_height, 1.0)
            width = orig_width * scale
            height = orig_height * scale
        else:
            width = max_width
            height = max_height
        
        # Create ReportLab image
        img_buffer.seek(0)
        return Image(img_buffer, width=width, height=height)
    
    except Exception as e:
        print(f"[WARN] Error decoding image: {e}", file=sys.stderr)
        return None


def format_value(value):
    """Format a value for display in table."""
    if value is None:
        return "-"
    if isinstance(value, bool):
        return "Sí" if value else "No"
    if isinstance(value, float):
        if value != value:  # NaN check
            return "-"
        return f"{value:.4f}" if abs(value) < 1000 else f"{value:.2f}"
    return str(value)


def get_conclusion_color(conclusion):
    """Get color based on conclusion text."""
    if not conclusion:
        return colors.black
    
    conclusion_lower = str(conclusion).lower()
    if any(word in conclusion_lower for word in ['cumple', 'normal', 'sí', 'aprobado', 'homogéneo']):
        return COLOR_SUCCESS
    if any(word in conclusion_lower for word in ['no cumple', 'no normal', 'rechazado', 'no homogéneo']):
        return COLOR_DANGER
    return colors.black


def create_data_table(data_rows, styles):
    """Create a formatted table from dataframe rows."""
    if not data_rows:
        return Paragraph("No hay datos disponibles.", styles['BodyText'])
    
    # Get all unique keys
    all_keys = set()
    for row in data_rows:
        if isinstance(row, dict):
            all_keys.update(row.keys())
    
    # Order columns
    ordered_keys = []
    priority_keys = ['parametro', 'prueba_normalidad', 'prueba_homogeneidad', 'prueba_tendencia']
    for key in priority_keys:
        if key in all_keys:
            ordered_keys.append(key)
            all_keys.discard(key)
    ordered_keys.extend(sorted(all_keys))
    
    # Column labels
    labels = {
        'n': 'n',
        'media': 'Media',
        'desviacion': 'Desv.',
        'asimetria': 'Asimetría',
        'curtosis': 'Curtosis',
        'p_value': 'P-Value',
        'normalidad': 'Normal',
        'prueba_normalidad': 'Prueba',
        'parametro': 'Parámetro',
        'estadistico': 'Estadístico',
        'conclusion': 'Conclusión',
        'prueba_homogeneidad': 'Prueba',
        'prueba_tendencia': 'Prueba'
    }
    
    # Build table data
    header = [labels.get(k, k.replace('_', ' ').title()) for k in ordered_keys]
    table_data = [header]
    
    for row in data_rows:
        if not isinstance(row, dict):
            continue
        row_values = []
        for key in ordered_keys:
            value = row.get(key)
            row_values.append(format_value(value))
        table_data.append(row_values)
    
    if len(table_data) <= 1:
        return Paragraph("No hay datos disponibles.", styles['BodyText'])
    
    # Calculate column widths
    available_width = PAGE_SIZE[0] - 2 * MARGIN
    col_count = len(ordered_keys)
    col_width = available_width / col_count
    
    # Create table
    table = Table(table_data, colWidths=[col_width] * col_count)
    
    # Style the table
    table_style = TableStyle([
        # Header
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_HEADER_BG),
        ('TEXTCOLOR', (0, 0), (-1, 0), COLOR_SECONDARY),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('ALIGN', (0, 0), (-1, 0), 'LEFT'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        
        # Body
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#1e293b')),
        ('ALIGN', (0, 1), (-1, -1), 'LEFT'),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        
        # Borders
        ('LINEBELOW', (0, 0), (-1, 0), 1, COLOR_BORDER),
        ('LINEBELOW', (0, 1), (-1, -2), 0.5, colors.HexColor('#f1f5f9')),
        
        # Grid
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ])
    
    table.setStyle(table_style)
    return table


# =============================================================================
# PDF Document Builder
# =============================================================================

class CerperPDFBuilder:
    """Builds PDF reports with professional styling."""
    
    def __init__(self, output_path, logo_path=None, session_info=None):
        self.output_path = output_path
        self.logo_path = logo_path
        self.session_info = session_info or {}
        self.styles = get_styles()
        self.elements = []
        
    def add_header(self, title, subtitle=None, analito=None, nivel=None):
        """Add report header with logo and title."""
        # Header table with logo and title
        header_data = []
        
        # Logo
        logo_img = None
        if self.logo_path and os.path.exists(self.logo_path):
            try:
                logo_img = Image(self.logo_path, height=LOGO_HEIGHT, width=LOGO_HEIGHT * 3)
            except:
                pass
        
        # Title section
        title_parts = [
            Paragraph(title, self.styles['ReportTitle'])
        ]
        if subtitle:
            title_parts.append(Paragraph(subtitle, self.styles['ReportSubtitle']))
        
        # Info section
        info_parts = []
        info_parts.append(f"<b>Fecha:</b> {datetime.now().strftime('%d/%m/%Y %H:%M')}")
        if self.session_info.get('id'):
            info_parts.append(f"<b>Sesión:</b> #{self.session_info['id']}")
        if analito:
            info_parts.append(f"<b>Analito:</b> {analito}")
        if nivel:
            info_parts.append(f"<b>Nivel:</b> {nivel}")
        
        info_text = " | ".join(info_parts)
        title_parts.append(Paragraph(info_text, self.styles['ReportSubtitle']))
        
        # Build header row
        if logo_img:
            header_table = Table(
                [[logo_img, title_parts]],
                colWidths=[LOGO_HEIGHT * 3 + 10, PAGE_SIZE[0] - 2*MARGIN - LOGO_HEIGHT*3 - 10]
            )
        else:
            header_table = Table(
                [[title_parts]],
                colWidths=[PAGE_SIZE[0] - 2*MARGIN]
            )
        
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ]))
        
        self.elements.append(header_table)
        self.elements.append(Spacer(1, 12))
        self.elements.append(HRFlowable(width="100%", thickness=1, color=COLOR_BORDER))
        self.elements.append(Spacer(1, 12))
    
    def add_test_section(self, test_title, test_data, graph_data=None, include_graph=True):
        """Add a test result section with table and optional graph."""
        section_elements = []
        
        # Test title
        section_elements.append(Paragraph(test_title, self.styles['TestTitle']))
        
        # Data table
        if test_data:
            data_rows = test_data
            if isinstance(test_data, str):
                try:
                    data_rows = json.loads(test_data)
                except:
                    data_rows = []
            if not isinstance(data_rows, list):
                data_rows = [data_rows] if data_rows else []
            
            table = create_data_table(data_rows, self.styles)
            section_elements.append(table)
        
        # Graph
        if include_graph and graph_data:
            img = decode_base64_image(graph_data)
            if img:
                section_elements.append(Spacer(1, 10))
                section_elements.append(img)
        
        section_elements.append(Spacer(1, 8))
        
        # Wrap in KeepTogether to avoid page breaks in middle of section
        self.elements.append(KeepTogether(section_elements))
    
    def add_page_break(self):
        """Add a page break."""
        self.elements.append(PageBreak())
    
    def add_spacer(self, height=12):
        """Add vertical space."""
        self.elements.append(Spacer(1, height))
    
    def build(self):
        """Generate the PDF file."""
        doc = SimpleDocTemplate(
            self.output_path,
            pagesize=PAGE_SIZE,
            leftMargin=MARGIN,
            rightMargin=MARGIN,
            topMargin=MARGIN,
            bottomMargin=MARGIN + 0.5*cm
        )
        
        # Add footer with page numbers
        def add_page_footer(canvas, doc):
            canvas.saveState()
            footer_text = f"Página {doc.page}  |  Generado por CerperStats"
            canvas.setFont('Helvetica', 8)
            canvas.setFillColor(COLOR_SECONDARY)
            canvas.drawCentredString(
                PAGE_SIZE[0] / 2,
                MARGIN / 2,
                footer_text
            )
            canvas.restoreState()
        
        doc.build(self.elements, onFirstPage=add_page_footer, onLaterPages=add_page_footer)
        
        # Calculate hash
        with open(self.output_path, 'rb') as f:
            file_hash = hashlib.sha256(f.read()).hexdigest()
        
        return file_hash


# =============================================================================
# Report Generator
# =============================================================================

class PDFReportGenerator:
    """Main report generator class."""
    
    def __init__(self, data, config, output_dir, logo_path=None):
        self.session_id = data.get('session_id')
        self.session_info = data.get('session_info', {})
        self.results = data.get('results', [])
        self.graphs = data.get('graphs', [])
        self.config = config
        self.output_dir = output_dir
        self.logo_path = logo_path
        
        # Index graphs by catalog_id + nivel + analito for quick lookup
        self.graphs_index = {}
        for g in self.graphs:
            key = (g.get('catalog_id'), g.get('nivel'), g.get('analito'))
            self.graphs_index[key] = g
    
    def _get_graph(self, catalog_id, nivel, analito):
        """Get graph data for a specific result."""
        key = (catalog_id, nivel, analito)
        graph = self.graphs_index.get(key)
        return graph.get('grafico_data') if graph else None
    
    def _group_results(self, group_by):
        """Group results according to mode."""
        grouped = defaultdict(list)
        
        for r in self.results:
            if group_by == 'by_analito':
                key = r.get('analito', 'Sin Analito')
            elif group_by == 'by_nivel':
                key = r.get('nivel', 1)
            elif group_by == 'by_analito_nivel':
                key = (r.get('analito', 'Sin Analito'), r.get('nivel', 1))
            else:  # unified
                key = 'all'
            
            grouped[key].append(r)
        
        return grouped
    
    def _generate_pdf(self, filename, results_subset, analito=None, nivel=None):
        """Generate a single PDF file."""
        output_path = os.path.join(self.output_dir, filename)
        
        builder = CerperPDFBuilder(
            output_path,
            logo_path=self.logo_path,
            session_info=self.session_info
        )
        
        # Add header
        title = "Informe de Evaluación Estadística"
        subtitle = self.session_info.get('metodo') or self.session_info.get('lab_key')
        builder.add_header(title, subtitle, analito=analito, nivel=nivel)
        
        # Group results by catalog_id (test type)
        tests = defaultdict(list)
        for r in results_subset:
            tests[r.get('catalog_id')].append(r)
        
        include_graphs = self.config.get('include_graphs', True)
        
        # Add each test section
        for catalog_id, test_results in sorted(tests.items()):
            if not test_results:
                continue
            
            # Get test info from first result
            first = test_results[0]
            test_title = first.get('test_titulo') or first.get('nombre_interno') or f"Prueba #{catalog_id}"
            
            # Combine all resultado_pc data
            all_data = []
            graph_data = None
            
            for r in test_results:
                data = r.get('resultado_pc')
                if isinstance(data, str):
                    try:
                        data = json.loads(data)
                    except:
                        data = None
                
                if isinstance(data, list):
                    all_data.extend(data)
                elif data:
                    all_data.append(data)
                
                # Get first available graph
                if not graph_data and include_graphs:
                    graph_data = self._get_graph(catalog_id, r.get('nivel'), r.get('analito'))
            
            builder.add_test_section(
                test_title,
                all_data,
                graph_data=graph_data,
                include_graph=include_graphs
            )
        
        # Build PDF
        file_hash = builder.build()
        
        return {
            'filename': filename,
            'path': output_path,
            'hash': file_hash,
            'analito': analito,
            'nivel': nivel,
            'tests_count': len(tests)
        }
    
    def generate(self):
        """Generate PDFs according to config.group_by."""
        group_by = self.config.get('group_by', 'unified')
        generated = []
        
        grouped = self._group_results(group_by)
        
        for key, results in grouped.items():
            if group_by == 'by_analito':
                analito = key
                filename = f"reporte_analito_{analito.replace(' ', '_')}.pdf"
                pdf_info = self._generate_pdf(filename, results, analito=analito)
            
            elif group_by == 'by_nivel':
                nivel = key
                filename = f"reporte_nivel_{nivel}.pdf"
                pdf_info = self._generate_pdf(filename, results, nivel=nivel)
            
            elif group_by == 'by_analito_nivel':
                analito, nivel = key
                filename = f"reporte_{analito.replace(' ', '_')}_nivel_{nivel}.pdf"
                pdf_info = self._generate_pdf(filename, results, analito=analito, nivel=nivel)
            
            else:  # unified
                filename = f"reporte_completo_session_{self.session_id}.pdf"
                pdf_info = self._generate_pdf(filename, results)
            
            generated.append(pdf_info)
        
        return generated


# =============================================================================
# Main Entry Point
# =============================================================================

def main():
    if len(sys.argv) < 3:
        print("Usage: python report_generator.py <input_json> <output_dir> [--logo <logo_path>]", file=sys.stderr)
        sys.exit(1)
    
    input_json_path = sys.argv[1]
    output_dir = sys.argv[2]
    
    # Parse optional logo path
    logo_path = None
    if '--logo' in sys.argv:
        logo_idx = sys.argv.index('--logo')
        if logo_idx + 1 < len(sys.argv):
            logo_path = sys.argv[logo_idx + 1]
    
    # Load input data
    try:
        with open(input_json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error loading input JSON: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Extract config
    config = data.get('config', {'group_by': 'unified'})
    
    # Generate reports
    generator = PDFReportGenerator(data, config, output_dir, logo_path)
    
    try:
        results = generator.generate()
        print(json.dumps(results, ensure_ascii=False))
    except Exception as e:
        print(f"Error generating reports: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
