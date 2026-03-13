#!/bin/bash

# Setup script for Python microservices

echo "Setting up Python microservices for resume pipeline..."

# Create virtual environment
echo "Creating virtual environment..."
python -m venv venv

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

echo ""
echo "Setup complete!"
echo ""
echo "To run the services:"
echo "1. PDF Parsing Service (port 5000):"
echo "   python pdf_parser_service.py"
echo ""
echo "2. JD Analysis Service (port 5001):"
echo "   python jd_service.py"
echo ""
echo "3. Both services (in separate terminals):"
echo "   ./run_services.sh"
echo ""
echo "Note: The JD analysis service requires ML libraries which may take time to download."