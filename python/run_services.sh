#!/bin/bash

# Run both Python microservices

echo "Starting Python microservices for resume pipeline..."
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Virtual environment not found. Running setup..."
    ./setup.sh
fi

# Activate virtual environment
source venv/bin/activate

echo "Starting PDF Parsing Service on port 5000..."
python pdf_parser_service.py &

echo "Starting JD Analysis Service on port 5001..."
python jd_service.py &

echo ""
echo "Services started!"
echo "PDF Parsing: http://localhost:5000"
echo "JD Analysis: http://localhost:5001"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for Ctrl+C
trap 'kill $(jobs -p)' EXIT
wait