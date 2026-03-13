#!/bin/bash
# Health check script for Reactive Resume

set -e

API_URL="${REACTIVE_RESUME_API:-http://127.0.0.1:4000/api/openapi}"
API_KEY="${REACTIVE_RESUME_API_KEY:-}"

echo "Checking Reactive Resume at: $API_URL"

if [ -z "$API_KEY" ]; then
  echo "Warning: REACTIVE_RESUME_API_KEY is not set"
fi

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X GET "$API_URL/ai/test-connection" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Reactive Resume connection successful!"
  echo "Response: $BODY"
  exit 0
else
  echo "❌ Reactive Resume connection failed!"
  echo "HTTP Status: $HTTP_CODE"
  echo "Response: $BODY"
  exit 1
fi
