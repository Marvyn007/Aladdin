#!/usr/bin/env python3
"""
PDF Parsing Microservice for LinkedIn and resume PDFs
Uses pdfplumber for text extraction with PaddleOCR fallback
"""

import os
import sys
import json
import base64
import tempfile
from typing import Dict, Any, Optional
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Try to import PDF parsing libraries
pdfplumber = None
PDFPLUMBER_AVAILABLE = False
try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
    print("pdfplumber imported successfully")
except ImportError as e:
    print(f"Warning: pdfplumber not available. Install with: pip install pdfplumber")
    PDFPLUMBER_AVAILABLE = False

# PaddleOCR - lazy initialized to avoid startup crashes
PADDLEOCR_AVAILABLE = False
ocr = None

def init_paddleocr():
    """Initialize PaddleOCR lazily"""
    global ocr, PADDLEOCR_AVAILABLE
    if ocr is not None:
        return
    
    try:
        from paddleocr import PaddleOCR
        # Initialize with valid parameters only - no show_log
        ocr = PaddleOCR(use_textline_orientation=True, lang='en')
        PADDLEOCR_AVAILABLE = True
        print("PaddleOCR initialized successfully")
    except ImportError as e:
        print(f"Warning: paddleocr not available. Install with: pip install paddleocr")
        PADDLEOCR_AVAILABLE = False
    except Exception as e:
        print(f"Warning: Failed to initialize PaddleOCR: {e}")
        PADDLEOCR_AVAILABLE = False

def extract_text_with_pdfplumber(pdf_bytes: bytes) -> str:
    """Extract text from PDF using pdfplumber"""
    if not PDFPLUMBER_AVAILABLE:
        raise ImportError("pdfplumber not installed")
    
    print("[pdf_parser] Extracting text with pdfplumber...")
    
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
        tmp_file.write(pdf_bytes)
        tmp_file.flush()
        tmp_path = tmp_file.name
    
    try:
        with pdfplumber.open(tmp_path) as pdf:
            text_pages = []
            for page_num, page in enumerate(pdf.pages):
                page_text = page.extract_text()
                if page_text:
                    text_pages.append(page_text)
                    print(f"[pdf_parser] Page {page_num + 1}: {len(page_text)} chars")
            
            full_text = '\n'.join(text_pages)
            print(f"[pdf_parser] pdfplumber extracted {len(full_text)} total chars")
            return full_text
    finally:
        os.unlink(tmp_path)

def extract_text_with_paddleocr(pdf_bytes: bytes) -> str:
    """Extract text from PDF using PaddleOCR (for image-based PDFs)"""
    global ocr
    
    if not PADDLEOCR_AVAILABLE:
        # Try to initialize if not done yet
        init_paddleocr()
        if not PADDLEOCR_AVAILABLE:
            raise ImportError("paddleocr not installed or failed to initialize")
    
    print("[pdf_parser] Extracting text with PaddleOCR...")
    
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
        tmp_file.write(pdf_bytes)
        tmp_file.flush()
        tmp_path = tmp_file.name
    
    try:
        # PaddleOCR can handle PDFs directly
        result = ocr.ocr(tmp_path, cls=True)
        
        # Extract text from OCR results
        text_lines = []
        page_count = 0
        
        if result:
            for page in result:
                if page:
                    page_count += 1
                    for line in page:
                        if line and len(line) >= 2:
                            text = line[1][0]
                            if text:
                                text_lines.append(text)
        
        full_text = '\n'.join(text_lines)
        print(f"[pdf_parser] PaddleOCR extracted {len(full_text)} chars from {page_count} pages")
        return full_text
    finally:
        os.unlink(tmp_path)

def detect_if_image_based(pdf_bytes: bytes) -> bool:
    """Check if PDF is image-based by looking for text operators"""
    pdf_content = pdf_bytes[:1000].decode('utf-8', errors='ignore')
    
    text_operators = ['Tj', 'TJ', 'Tf', 'Td', 'Tm', 'T*']
    has_text_operators = any(op in pdf_content for op in text_operators)
    return not has_text_operators

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "ok",
        "pdfplumber_available": PDFPLUMBER_AVAILABLE,
        "paddleocr_available": PADDLEOCR_AVAILABLE
    })

@app.route('/extract-text', methods=['POST'])
def extract_text():
    """Extract text from PDF - legacy endpoint"""
    try:
        data = request.get_json()
        pdf_base64 = data.get('pdf_base64', '')
        file_name = data.get('file_name', 'unknown.pdf')
        
        if not pdf_base64:
            return jsonify({
                "success": False,
                "error": "No PDF data provided"
            }), 400
        
        print(f"[pdf_parser] Processing file: {file_name}")
        
        # Decode base64 PDF
        pdf_bytes = base64.b64decode(pdf_base64)
        print(f"[pdf_parser] PDF size: {len(pdf_bytes)} bytes")
        
        extracted_text = ""
        method_used = "unknown"
        
        # Try pdfplumber first
        if PDFPLUMBER_AVAILABLE:
            try:
                extracted_text = extract_text_with_pdfplumber(pdf_bytes)
                method_used = "pdfplumber"
                
                # Check if extraction was successful
                if not extracted_text or len(extracted_text.strip()) < 50:
                    print(f"[pdf_parser] pdfplumber extracted little text ({len(extracted_text)} chars), trying PaddleOCR...")
                    extracted_text = extract_text_with_paddleocr(pdf_bytes)
                    method_used = "paddleocr_fallback"
            except Exception as pdfplumber_error:
                print(f"[pdf_parser] pdfplumber extraction failed: {pdfplumber_error}")
                if PADDLEOCR_AVAILABLE or True:  # Try to initialize PaddleOCR
                    try:
                        extracted_text = extract_text_with_paddleocr(pdf_bytes)
                        method_used = "paddleocr"
                    except Exception as ocr_error:
                        print(f"[pdf_parser] PaddleOCR also failed: {ocr_error}")
                        raise pdfplumber_error
                else:
                    raise pdfplumber_error
        elif PADDLEOCR_AVAILABLE or True:  # Try to initialize
            try:
                extracted_text = extract_text_with_paddleocr(pdf_bytes)
                method_used = "paddleocr_only"
            except Exception as e:
                return jsonify({
                    "success": False,
                    "error": f"PDF parsing failed: {str(e)}"
                }), 500
        else:
            return jsonify({
                "success": False,
                "error": "No PDF parsing libraries available. Install pdfplumber or paddleocr."
            }), 503
        
        # Check if we got any text
        if not extracted_text or len(extracted_text.strip()) < 10:
            return jsonify({
                "success": False,
                "error": "Failed to extract text from PDF",
                "method_used": method_used
            }), 400
        
        is_image_based = detect_if_image_based(pdf_bytes)
        
        return jsonify({
            "success": True,
            "text": extracted_text,
            "method_used": method_used,
            "is_image_based": is_image_based,
            "text_length": len(extracted_text)
        })
        
    except Exception as e:
        print(f"[pdf_parser] Error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/parse', methods=['POST'])
def parse():
    """
    Parse PDF and extract text.
    Accepts: { "file": { "name": "<string>", "data": "<base64 PDF string>" } }
    Returns: { "text": "<extracted text>" }
    """
    try:
        data = request.get_json()
        
        if not data or 'file' not in data:
            return jsonify({
                "success": False,
                "error": "Missing 'file' object in request body"
            }), 400
        
        file_obj = data['file']
        file_name = file_obj.get('name', 'resume.pdf')
        pdf_base64 = file_obj.get('data', '')
        
        if not pdf_base64:
            return jsonify({
                "success": False,
                "error": "No PDF data provided in 'file.data'"
            }), 400
        
        print(f"[pdf_parser] Processing file: {file_name}")
        
        # Decode base64 PDF
        pdf_bytes = base64.b64decode(pdf_base64)
        print(f"[pdf_parser] PDF size: {len(pdf_bytes)} bytes")
        
        extracted_text = ""
        method_used = "unknown"
        
        # Try pdfplumber first
        if PDFPLUMBER_AVAILABLE:
            try:
                extracted_text = extract_text_with_pdfplumber(pdf_bytes)
                method_used = "pdfplumber"
                
                # Check if extraction was successful
                if not extracted_text or len(extracted_text.strip()) < 50:
                    print(f"[pdf_parser] pdfplumber extracted little text, trying PaddleOCR...")
                    extracted_text = extract_text_with_paddleocr(pdf_bytes)
                    method_used = "paddleocr_fallback"
            except Exception as pdfplumber_error:
                print(f"[pdf_parser] pdfplumber failed: {pdfplumber_error}")
                try:
                    extracted_text = extract_text_with_paddleocr(pdf_bytes)
                    method_used = "paddleocr"
                except Exception as ocr_error:
                    print(f"[pdf_parser] PaddleOCR also failed: {ocr_error}")
                    raise pdfplumber_error
        else:
            # pdfplumber not available, try PaddleOCR
            try:
                extracted_text = extract_text_with_paddleocr(pdf_bytes)
                method_used = "paddleocr"
            except Exception as e:
                return jsonify({
                    "success": False,
                    "error": f"PDF parsing failed: {str(e)}"
                }), 500
        
        if not extracted_text or len(extracted_text.strip()) < 10:
            return jsonify({
                "text": ""
            }), 200
        
        print(f"[pdf_parser] Successfully extracted {len(extracted_text)} chars using {method_used}")
        
        return jsonify({
            "text": extracted_text
        })
        
    except Exception as e:
        print(f"[pdf_parser] Error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/detect-image-pdf', methods=['POST'])
def detect_image_pdf():
    """Detect if PDF is image-based"""
    try:
        data = request.get_json()
        pdf_base64 = data.get('pdf_base64', '')
        
        if not pdf_base64:
            return jsonify({
                "success": False,
                "error": "No PDF data provided"
            }), 400
        
        pdf_bytes = base64.b64decode(pdf_base64)
        is_image_based = detect_if_image_based(pdf_bytes)
        
        return jsonify({
            "success": True,
            "is_image_based": is_image_based
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    
    print(f"Starting PDF Parser Service on 0.0.0.0:{port}")
    print(f"pdfplumber available: {PDFPLUMBER_AVAILABLE}")
    print(f"PaddleOCR available: {PADDLEOCR_AVAILABLE} (lazy init)")
    
    if not PDFPLUMBER_AVAILABLE and not PADDLEOCR_AVAILABLE:
        print("\nWARNING: No PDF parsing libraries installed!")
        print("Install at least one of:")
        print("  pip install pdfplumber")
        print("  pip install paddleocr")
        print("\nService will fail PDF parsing requests.")
    
    # Run on 0.0.0.0 to be accessible from outside
    app.run(host='0.0.0.0', port=port, debug=debug)
