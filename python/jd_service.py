#!/usr/bin/env python3
"""
Job Description Analysis Microservice
Uses KeyBERT, sentence-transformers, and scikit-learn for NLP analysis
"""

import json
import os
import sys
from typing import Dict, List, Any, Tuple
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Try to import ML libraries (optional)
try:
    from keybert import KeyBERT
    from sentence_transformers import SentenceTransformer
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    ML_AVAILABLE = True
    print("ML libraries imported successfully")
except ImportError as e:
    print(f"Warning: ML libraries not available. Using fallback methods. Error: {e}")
    ML_AVAILABLE = False

# Initialize models (if available)
if ML_AVAILABLE:
    try:
        # Initialize KeyBERT for keyword extraction
        kw_model = KeyBERT()
        
        # Initialize sentence transformer for embeddings
        # Using a lightweight model for efficiency
        embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Initialize TF-IDF vectorizer
        tfidf_vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words='english',
            ngram_range=(1, 2)
        )
        
        print("ML models loaded successfully")
    except Exception as e:
        print(f"Error loading ML models: {e}")
        ML_AVAILABLE = False

def extract_keywords_keybert(text: str, top_n: int = 20) -> List[Dict[str, Any]]:
    """Extract keywords using KeyBERT"""
    if not ML_AVAILABLE:
        raise ImportError("KeyBERT not available")
    
    # Extract keywords with KeyBERT
    keywords = kw_model.extract_keywords(
        text,
        keyphrase_ngram_range=(1, 2),
        stop_words='english',
        top_n=top_n,
        diversity=0.5
    )
    
    return [
        {"keyword": kw[0], "score": float(kw[1])}
        for kw in keywords
    ]

def extract_keywords_tfidf(text: str, top_n: int = 20) -> List[Dict[str, Any]]:
    """Extract keywords using TF-IDF"""
    if not ML_AVAILABLE:
        raise ImportError("scikit-learn not available")
    
    # Fit TF-IDF on the text
    tfidf_matrix = tfidf_vectorizer.fit_transform([text])
    feature_names = tfidf_vectorizer.get_feature_names_out()
    tfidf_scores = tfidf_matrix.toarray()[0]
    
    # Get top N keywords by TF-IDF score
    top_indices = np.argsort(tfidf_scores)[-top_n:][::-1]
    
    keywords = []
    for idx in top_indices:
        if tfidf_scores[idx] > 0:
            keywords.append({
                "keyword": feature_names[idx],
                "score": float(tfidf_scores[idx])
            })
    
    return keywords

def generate_embedding(text: str) -> List[float]:
    """Generate semantic embedding using sentence-transformers"""
    if not ML_AVAILABLE:
        raise ImportError("sentence-transformers not available")
    
    # Generate embedding
    embedding = embedding_model.encode(text)
    return embedding.tolist()

def extract_skills_pattern(text: str) -> List[str]:
    """Extract skills using pattern matching (fallback method)"""
    import re
    
    skills = set()
    text_lower = text.lower()
    
    # Common technical skills patterns
    skill_patterns = [
        # Programming languages
        r'\b(javascript|js|typescript|ts|python|py|java|c\+\+|c#|go|golang|rust|php|ruby|swift|kotlin|scala)\b',
        # Frameworks
        r'\b(react|angular|vue|next\.js|nuxt\.js|node\.js|express|django|flask|spring|laravel|rails)\b',
        # Databases
        r'\b(mysql|postgresql|mongodb|redis|elasticsearch|cassandra|dynamodb|oracle|sql server)\b',
        # Cloud/AWS
        r'\b(aws|azure|gcp|google cloud|kubernetes|docker|terraform|ansible|jenkins|ci/cd)\b',
        # Methodologies
        r'\b(agile|scrum|kanban|devops|ci/cd|tdd|bdd|microservices|rest|graphql|grpc)\b'
    ]
    
    for pattern in skill_patterns:
        matches = re.findall(pattern, text_lower)
        for match in matches:
            skills.add(match)
    
    # Also look for skill phrases
    skill_phrase_patterns = [
        r'(?:proficient in|experience with|knowledge of|skills? in|expertise in)\s+([^.,;:!?]+)',
        r'(?:required|must have|should have)\s+(?:skills?|experience|knowledge)\s*(?:in|with|of)?\s*([^.,;:!?]+)',
        r'(?:looking for|seeking|candidate should|applicant must)\s+(?:a|an)?\s*([^.,;:!?]+)\s+(?:with|having)\s+experience',
        r'(?:qualifications|requirements|skills)\s*:\s*([^.,;:!?]+)',
        r'(?:minimum|required|preferred)\s+(?:qualifications?|skills?)\s*(?:are|include)?\s*:\s*([^.,;:!?]+)'
    ]
    
    for pattern in skill_phrase_patterns:
        matches = re.findall(pattern, text_lower, re.IGNORECASE)
        for match in matches:
            # Split by common delimiters
            phrases = re.split(r'[,;|&]|\band\b|\bor\b', match)
            for phrase in phrases:
                skill = phrase.strip()
                if skill and len(skill) > 2:
                    skills.add(skill)
    
    return list(skills)[:30]  # Limit to top 30 skills

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "ok",
        "ml_available": ML_AVAILABLE
    })

@app.route('/extract-keywords', methods=['POST'])
def extract_keywords_endpoint():
    """Extract keywords using KeyBERT"""
    try:
        data = request.get_json()
        text = data.get('text', '')
        
        if not text:
            return jsonify({
                "success": False,
                "error": "No text provided"
            }), 400
        
        if not ML_AVAILABLE:
            return jsonify({
                "success": False,
                "error": "KeyBERT not available. Install with: pip install keybert"
            }), 503
        
        keywords = extract_keywords_keybert(text)
        
        return jsonify({
            "success": True,
            "keywords": keywords
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/extract-tfidf', methods=['POST'])
def extract_tfidf_endpoint():
    """Extract keywords using TF-IDF"""
    try:
        data = request.get_json()
        text = data.get('text', '')
        
        if not text:
            return jsonify({
                "success": False,
                "error": "No text provided"
            }), 400
        
        if not ML_AVAILABLE:
            return jsonify({
                "success": False,
                "error": "scikit-learn not available. Install with: pip install scikit-learn"
            }), 503
        
        keywords = extract_keywords_tfidf(text)
        
        return jsonify({
            "success": True,
            "keywords": keywords
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/generate-embedding', methods=['POST'])
def generate_embedding_endpoint():
    """Generate semantic embedding"""
    try:
        data = request.get_json()
        text = data.get('text', '')
        
        if not text:
            return jsonify({
                "success": False,
                "error": "No text provided"
            }), 400
        
        if not ML_AVAILABLE:
            return jsonify({
                "success": False,
                "error": "sentence-transformers not available. Install with: pip install sentence-transformers"
            }), 503
        
        embedding = generate_embedding(text)
        
        return jsonify({
            "success": True,
            "embedding": embedding,
            "dimensions": len(embedding)
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/analyze', methods=['POST'])
def analyze_jd():
    """Complete job description analysis"""
    try:
        data = request.get_json()
        text = data.get('text', '')
        
        if not text:
            return jsonify({
                "success": False,
                "error": "No text provided"
            }), 400
        
        result = {
            "success": True,
            "raw_text": text,
            "keywords": [],
            "embedding": [],
            "required_skills": [],
            "ml_available": ML_AVAILABLE
        }
        
        # Extract keywords (try KeyBERT first, fallback to TF-IDF)
        try:
            if ML_AVAILABLE:
                result["keywords"] = extract_keywords_keybert(text)
            else:
                result["keywords"] = []
        except Exception as e:
            print(f"Keyword extraction failed: {e}")
            result["keywords"] = []
        
        # Generate embedding
        try:
            if ML_AVAILABLE:
                result["embedding"] = generate_embedding(text)
            else:
                # Fallback: zero vector
                result["embedding"] = [0.0] * 384  # all-MiniLM-L6-v2 dimension
        except Exception as e:
            print(f"Embedding generation failed: {e}")
            result["embedding"] = []
        
        # Extract skills (pattern matching always works)
        result["required_skills"] = extract_skills_pattern(text)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    
    print(f"Starting JD Analysis Service on port {port}")
    print(f"ML libraries available: {ML_AVAILABLE}")
    
    if not ML_AVAILABLE:
        print("\nWARNING: ML libraries not installed.")
        print("To enable full functionality, install:")
        print("  pip install keybert sentence-transformers scikit-learn")
        print("\nRunning in fallback mode with pattern matching only.")
    
    app.run(host='0.0.0.0', port=port, debug=debug)