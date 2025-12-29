#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CerperStats PDF Report Generator - Base Module

Contains shared code for all report generators:
- Constants (page size, margins, colors)
- Styles (paragraph styles for ReportLab)
- Helper functions (image decoding, value formatting, etc.)
- CerperPDFBuilder class (core PDF building logic)
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

# Category to PDF Header mapping
# Categories 'Tratamiento de Resultados' and 'Atípicos' use the same header
CATEGORY_HEADER_MAP = {
    'Tratamiento de Resultados': 'PRUEBAS ESTADÍSTICAS APLICADAS A LOS RESULTADOS',
    'Atípicos': 'PRUEBAS ESTADÍSTICAS APLICADAS A LOS RESULTADOS',
    'Veracidad': 'VERACIDAD',
    'Precisión': 'PRECISIÓN',
}

# Order in which category headers should appear in the PDF
CATEGORY_ORDER = [
    'PRUEBAS ESTADÍSTICAS APLICADAS A LOS RESULTADOS',
    'VERACIDAD',
    'PRECISIÓN',
]


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
    
    styles.add(ParagraphStyle(
        name='ConclusionText',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#334155'),
        spaceAfter=4,
        spaceBefore=8
    ))
    
    # Category header style (large, bold, prominent)
    styles.add(ParagraphStyle(
        name='CategoryHeader',
        parent=styles['Heading1'],
        fontSize=14,
        textColor=COLOR_PRIMARY,
        spaceBefore=20,
        spaceAfter=12,
        fontName='Helvetica-Bold',
        alignment=TA_LEFT
    ))
    
    # Test description style (italic, smaller)
    styles.add(ParagraphStyle(
        name='TestDescription',
        parent=styles['Normal'],
        fontSize=9,
        textColor=COLOR_SECONDARY,
        spaceAfter=8,
        fontName='Helvetica-Oblique'
    ))
    
    # Nivel subtitle style
    styles.add(ParagraphStyle(
        name='NivelTitle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#475569'),
        spaceBefore=10,
        spaceAfter=6,
        fontName='Helvetica-Bold'
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
    if any(word in conclusion_lower for word in ['cumple', 'normal', 'sí', 'aprobado', 'homogéneo', 'siguen']):
        return COLOR_SUCCESS
    if any(word in conclusion_lower for word in ['no cumple', 'no normal', 'rechazado', 'no homogéneo', 'no siguen']):
        return COLOR_DANGER
    return colors.black


def create_data_table(data_rows, styles):
    """Create a formatted table from dataframe rows."""
    if not data_rows:
        return Paragraph("No hay datos disponibles.", styles['CerperBodyText'])
    
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
        return Paragraph("No hay datos disponibles.", styles['CerperBodyText'])
    
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
    
    def __init__(self, output_path, logo_path=None, session_info=None, config=None):
        self.output_path = output_path
        self.logo_path = logo_path
        self.session_info = session_info or {}
        self.config = config or {}
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
        
        # Use execution_date from config if available, otherwise current date
        exec_date = self.config.get('execution_date')
        if exec_date:
            info_parts.append(f"<b>Fecha:</b> {exec_date}")
        else:
            info_parts.append(f"<b>Fecha:</b> {datetime.now().strftime('%d/%m/%Y')}")
        
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
    
    def add_test_section(self, test_title, test_data, conclusion=None, graph_data=None, include_graph=True):
        """Add a test result section with table, conclusion, and optional graph."""
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
        
        # Conclusion (below table)
        if conclusion:
            color = get_conclusion_color(conclusion)
            conclusion_para = Paragraph(
                f"<b>Conclusión:</b> {conclusion}",
                ParagraphStyle(
                    'ConclusionInline',
                    parent=self.styles['CerperBodyText'],
                    textColor=color,
                    fontSize=9,
                    spaceBefore=8,
                    spaceAfter=4
                )
            )
            section_elements.append(conclusion_para)
        
        # Graph
        if include_graph and graph_data:
            img = decode_base64_image(graph_data)
            if img:
                section_elements.append(Spacer(1, 10))
                section_elements.append(img)
        
        section_elements.append(Spacer(1, 8))
        
        # Wrap in KeepTogether to avoid page breaks in middle of section
        self.elements.append(KeepTogether(section_elements))
    
    def add_section_title(self, title):
        """Add a section title."""
        self.elements.append(Paragraph(title, self.styles['SectionTitle']))
    
    def add_text(self, text, style_name='CerperBodyText'):
        """Add a text paragraph."""
        self.elements.append(Paragraph(text, self.styles[style_name]))
    
    def add_page_break(self):
        """Add a page break."""
        self.elements.append(PageBreak())
    
    def add_spacer(self, height=12):
        """Add vertical space."""
        self.elements.append(Spacer(1, height))
    
    def add_category_header(self, category_name):
        """
        Add a category header (e.g., 'PRUEBAS ESTADÍSTICAS APLICADAS A LOS RESULTADOS').
        Maps the database category to the display header using CATEGORY_HEADER_MAP.
        """
        # Map the category to its display header
        header_text = CATEGORY_HEADER_MAP.get(category_name, category_name.upper())
        
        # Add a horizontal rule before the header for visual separation
        self.elements.append(Spacer(1, 16))
        self.elements.append(HRFlowable(width="100%", thickness=1, color=COLOR_PRIMARY))
        self.elements.append(Paragraph(header_text, self.styles['CategoryHeader']))
    
    def add_test_with_description(self, test_name, description=None):
        """
        Add a test name with its optional description.
        
        Args:
            test_name: The name of the test (e.g., 'Prueba de Normalidad')
            description: Optional description text for the test
        """
        self.elements.append(Paragraph(f"→ {test_name}", self.styles['TestTitle']))
        if description:
            self.elements.append(Paragraph(description, self.styles['TestDescription']))
    
    def add_nivel_title(self, nivel):
        """Add a nivel subtitle (e.g., '- Nivel 1')."""
        self.elements.append(Paragraph(f"- Nivel {nivel}", self.styles['NivelTitle']))
    
    def add_nivel_section(self, nivel, table_data, conclusion=None, graph_data=None, include_graph=True):
        """
        Add a complete nivel section with table, conclusion, and graph.
        
        Args:
            nivel: The nivel number
            table_data: Data for the results table (list of dicts or JSON string)
            conclusion: Optional conclusion text
            graph_data: Optional base64 encoded graph image
            include_graph: Whether to include the graph
        """
        section_elements = []
        
        # Nivel title
        section_elements.append(Paragraph(f"- Nivel {nivel}", self.styles['NivelTitle']))
        
        # Data table
        if table_data:
            data_rows = table_data
            if isinstance(table_data, str):
                try:
                    data_rows = json.loads(table_data)
                except:
                    data_rows = []
            if not isinstance(data_rows, list):
                data_rows = [data_rows] if data_rows else []
            
            if data_rows:
                table = create_data_table(data_rows, self.styles)
                section_elements.append(table)
        
        # Conclusion
        if conclusion:
            color = get_conclusion_color(conclusion)
            conclusion_para = Paragraph(
                f"<b>Conclusión:</b> {conclusion}",
                ParagraphStyle(
                    'ConclusionInline',
                    parent=self.styles['CerperBodyText'],
                    textColor=color,
                    fontSize=9,
                    spaceBefore=8,
                    spaceAfter=4
                )
            )
            section_elements.append(conclusion_para)
        
        # Graph
        if include_graph and graph_data:
            img = decode_base64_image(graph_data)
            if img:
                section_elements.append(Spacer(1, 10))
                section_elements.append(img)
        
        section_elements.append(Spacer(1, 8))
        
        # Add all elements (try to keep together if possible)
        for elem in section_elements:
            self.elements.append(elem)
    
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
