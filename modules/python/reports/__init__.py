#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CerperStats PDF Report Generator - Main Module

This is the entry point for the modular report generation system.
It provides a factory function to select the appropriate generator
based on the session's analysis type.

Usage:
    python -m modules.python.reports <input_json> <output_dir> [--logo <logo_path>]

Structure:
    - base.py: Shared code (constants, styles, helpers, CerperPDFBuilder)
    - monoanalito.py: MonoReportGenerator (unified, by_nivel)
    - multianalito.py: MultiReportGenerator (unified, by_nivel, by_analito, by_analito_nivel)
"""

import sys
import os
import json
import argparse

from .monoanalito import MonoReportGenerator
from .multianalito import MultiReportGenerator


def create_generator(data, config, output_dir, logo_path=None):
    """
    Factory function that selects the appropriate generator.
    
    Args:
        data: Dict with session_id, session_info, results, graphs
        config: Dict with group_by, include_graphs, include_tables, etc.
        output_dir: Directory to save generated PDFs
        logo_path: Optional path to logo image
    
    Returns:
        MonoReportGenerator or MultiReportGenerator instance
    """
    tipo = (data.get('session_info', {}).get('tipo_analisis') or '').lower()
    
    if tipo in ('multi', 'multianalito'):
        return MultiReportGenerator(data, config, output_dir, logo_path)
    else:
        return MonoReportGenerator(data, config, output_dir, logo_path)


def main():
    """Main entry point for command-line execution."""
    parser = argparse.ArgumentParser(
        description='CerperStats PDF Report Generator'
    )
    parser.add_argument(
        'input_json',
        help='Path to input JSON file with session data'
    )
    parser.add_argument(
        'output_dir',
        help='Directory to save generated PDF files'
    )
    parser.add_argument(
        '--logo',
        dest='logo_path',
        help='Path to logo image file'
    )
    
    args = parser.parse_args()
    
    # Validate inputs
    if not os.path.exists(args.input_json):
        print(json.dumps({
            'ok': False,
            'error': f'Input file not found: {args.input_json}'
        }))
        sys.exit(1)
    
    # Create output directory if needed
    os.makedirs(args.output_dir, exist_ok=True)
    
    # Load input data
    try:
        with open(args.input_json, 'r', encoding='utf-8') as f:
            input_data = json.load(f)
    except Exception as e:
        print(json.dumps({
            'ok': False,
            'error': f'Error reading input file: {str(e)}'
        }))
        sys.exit(1)
    
    # Extract components
    data = {
        'session_id': input_data.get('session_id'),
        'session_info': input_data.get('session_info', {}),
        'results': input_data.get('results', []),
        'graphs': input_data.get('graphs', [])
    }
    
    config = input_data.get('config', {})
    
    # Create generator
    try:
        generator = create_generator(
            data=data,
            config=config,
            output_dir=args.output_dir,
            logo_path=args.logo_path
        )
        
        # Generate PDFs
        generated = generator.generate()
        
        # Output result
        output = {
            'ok': True,
            'session_id': data['session_id'],
            'generated': generated,
            'count': len(generated)
        }
        
        print(json.dumps(output, ensure_ascii=False))
        
    except Exception as e:
        import traceback
        print(json.dumps({
            'ok': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
