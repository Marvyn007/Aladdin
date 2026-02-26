import os
import sys
import json
import re
import argparse
from typing import Dict, Any

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

try:
    from paddleocr import PaddleOCR
    # Initialize PaddleOCR proactively - use English only for resumes to keep it lightweight if downloading
    ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
except ImportError:
    ocr = None
    print("Warning: paddleocr not installed. OCR will fail if needed.", file=sys.stderr)

# Heuristic parsing markers
SECTION_HEADERS = {
    'summary': [r'summary', r'profile', r'objective', r'about me'],
    'experience': [r'experience', r'employment', r'work history', r'professional experience'],
    'education': [r'education', r'academic background', r'qualifications'],
    'skills': [r'skills', r'technologies', r'core competencies', r'technical skills'],
    'projects': [r'projects', r'personal projects', r'key projects']
}

def is_header(line: str) -> str:
    # A simple heuristics: if line is short, capitalized, or matches known headers exactly
    line_lower = line.strip().lower()
    for section, patterns in SECTION_HEADERS.items():
        for pattern in patterns:
            # Match strict start or exact match to avoid false positives in sentences
            if re.match(rf'^\s*{pattern}\s*$', line_lower) or re.match(rf'^\s*{pattern}[:]?\s*$', line_lower):
                if len(line.split()) <= 4:  # True headers are usually short
                    return section
    return None

def extract_text_pdfplumber(pdf_path: str) -> str:
    """Attempt fast text extraction with bounding boxes using pdfplumber."""
    if not pdfplumber:
        return ""
    text_content = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            # Extract text preserving layout heuristics
            text = page.extract_text(x_tolerance=2, y_tolerance=3)
            if text:
                text_content.append(text)
    return "\n".join(text_content)

def extract_text_paddleocr(pdf_path: str) -> str:
    """Use PaddleOCR (heavy) to extract text from an image-based PDF."""
    if not ocr:
        raise RuntimeError("PaddleOCR not initialized but required for this image PDF.")
    
    # PaddleOCR can process PDFs directly if installed with correct CV dependencies, 
    # but strictly it returns a list of pages -> line results
    results = ocr.ocr(pdf_path, cls=True)
    
    recognized_lines = []
    for page_res in results:
        if page_res is None:
            continue
        for line in page_res:
            # line = [[box_points], (text, confidence)]
            text = line[1][0]
            recognized_lines.append(text)
            
    return "\n".join(recognized_lines)

def naive_structure_parser(raw_text: str) -> dict:
    """
    Groups raw text into basic sections using regex/heuristics.
    Since Node side has `gemini-strict.ts`, this structures enough for fallback 
    or passes straight text to the LLM if structure fails.
    """
    resume_data = {
        "basics": {"full_name": "", "email": "", "phone": "", "linkedin": ""},
        "summary": "",
        "experience": [],
        "education": [],
        "skills": {"technical": [], "tools": [], "soft": []},
        "raw_text": raw_text  # Important: ALWAYS pass raw text back so Node can run it thru Gemini if this heuristics fails
    }
    
    lines = raw_text.split('\n')
    current_section = 'basics'
    section_buffers = {
        'basics': [], 'summary': [], 'experience': [], 'education': [], 'skills': [], 'projects': []
    }

    # Pass 1: Gather lines into bins
    for line in lines:
        clean_line = line.strip()
        if not clean_line: continue
        
        detected = is_header(clean_line)
        if detected:
            current_section = detected
            continue
            
        if current_section in section_buffers:
            section_buffers[current_section].append(clean_line)
            
    # Extract Basics
    basics_text = "\n".join(section_buffers['basics'])
    # Email regex
    email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', basics_text)
    if email_match:
        resume_data['basics']['email'] = email_match.group(0)
    # Phone regex
    phone_match = re.search(r'\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}', basics_text)
    if phone_match:
        resume_data['basics']['phone'] = phone_match.group(0)
        
    # Name is usually the first non-empty line
    if section_buffers['basics']:
        resume_data['basics']['full_name'] = section_buffers['basics'][0]

    # Assign raw strings to sections (Node will convert to strict JSON format)
    # This acts as an "Extraction Layer"
    resume_data['summary'] = "\n".join(section_buffers['summary'])
    
    # For Exp, Ed, Skills, since heuristic parsing of bullet points is error-prone vs varied layouts,
    # we pack the raw chunked text for that section into a single string. 
    # Node can then map it.
    resume_data['experience'] = [{"text_dump": "\n".join(section_buffers['experience'])}] if section_buffers['experience'] else []
    resume_data['education'] = [{"text_dump": "\n".join(section_buffers['education'])}] if section_buffers['education'] else []
    
    # Just dump skills into technical so Node has them
    resume_data['skills']['technical'] = section_buffers['skills']

    return resume_data

def main():
    parser = argparse.ArgumentParser(description="Parse PDF using local heuristic/OCR fallback.")
    parser.add_argument('req_id', type=str, help="Unique request ID for temporary file routing")
    parser.add_argument('pdf_path', type=str, help="Path to the PDF file to parse")
    
    args = parser.parse_args()
    
    task_dir = f"/tmp/resume_tasks/{args.req_id}"
    os.makedirs(task_dir, exist_ok=True)
    
    # 1. Try standard text extraction
    raw_text = extract_text_pdfplumber(args.pdf_path)
    used_ocr = False
    
    # 2. If < 50 chars, it's likely an image or completely un-selectable PDF. Use PaddleOCR.
    if len(raw_text.strip()) < 50:
        used_ocr = True
        try:
            raw_text = extract_text_paddleocr(args.pdf_path)
            # Write OCR transcript
            with open(os.path.join(task_dir, 'ocr.txt'), 'w', encoding='utf-8') as f:
                f.write(raw_text)
        except Exception as e:
            print(f"OCR Failed: {e}", file=sys.stderr)
            raw_text = "FAILED_EXTRACTION"
            
    # 3. Structure text
    structured_json = naive_structure_parser(raw_text)
    structured_json['_meta_method'] = 'paddleocr' if used_ocr else 'pdfplumber'
    
    # 4. Save to JSON
    out_path = os.path.join(task_dir, 'parsed_fallback.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(structured_json, f, indent=2)
        
    # Print the output path so the Node server can read it
    print(out_path)
    
    # Ensure zero PII in sys.stdout other than the path
    sys.exit(0)

if __name__ == '__main__':
    main()
