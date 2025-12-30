#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CerperStats Report Data Generator

This file replaces the old PDF generator entry point.
It uses ReportDataProvider to process session data and outputs structured JSON
ready for HTML rendering by the Node.js/Puppeteer layer.

Usage:
    python report_generator.py <input_json> <output_dir> [--logo <logo_path>]

Output (JSON):
    {
        "ok": true,
        "reports": [
            {
                "filename": "informe_xyz.pdf",
                "data": { ... } // Structure for HTML template
            }
        ]
    }
"""

import sys
import os
import json
import argparse
import traceback

# Add the reports directory to path to enable relative imports
reports_dir = os.path.dirname(os.path.abspath(__file__))
if reports_dir not in sys.path:
    sys.path.insert(0, reports_dir)

from report_data_provider import ReportDataProvider

def main():
    parser = argparse.ArgumentParser(description='CerperStats Report Data Generator')
    parser.add_argument('input_json', help='Path to input JSON file')
    parser.add_argument('output_dir', help='Output directory (unused by Python now, but kept for compat)')
    parser.add_argument('--logo', dest='logo_path', help='Path to logo image')
    
    args = parser.parse_args()
    
    try:
        # 1. Read Input Data
        if not os.path.exists(args.input_json):
            raise FileNotFoundError(f"Input file not found: {args.input_json}")
            
        with open(args.input_json, 'r', encoding='utf-8') as f:
            input_data = json.load(f)
            
        # 2. Extract Components
        data = {
            'session_id': input_data.get('session_id'),
            'session_info': input_data.get('session_info', {}),
            'results': input_data.get('results', []),
            'graphs': input_data.get('graphs', [])
        }
        config = input_data.get('config', {})
        if args.logo_path:
            config['logo_path_url'] = args.logo_path # Pass directly, template handles it
            
        # 3. Process Data
        provider = ReportDataProvider(data, config)
        reports = provider.get_report_data()
        
        # 4. Output JSON
        output = {
            "ok": True,
            "session_id": data['session_id'],
            "reports": reports,
            "count": len(reports)
        }
        
        # Print JSON to stdout for Node.js to capture
        print(json.dumps(output, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({
            "ok": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
