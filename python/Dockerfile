FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# Copy project files into container
COPY . /app

# Install dependencies
RUN pip install --upgrade pip
RUN pip install -r pdf_requirements.txt

EXPOSE 5000

CMD ["python", "pdf_parser_service.py"]