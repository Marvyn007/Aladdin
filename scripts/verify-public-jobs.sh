#!/bin/bash
# Verification script for Public Jobs Pipeline
# Run this after implementing the changes to verify they work correctly

echo "=== Public Jobs Pipeline Verification ==="
echo ""

# 1. Check total jobs count
echo "1. Checking total jobs in database..."
echo "   SQL: SELECT COUNT(*) FROM jobs;"
echo ""

# 2. Test the API endpoint
echo "2. Testing /api/jobs endpoint..."
curl -s "http://localhost:3000/api/jobs?page=1&limit=25" | head -c 500
echo ""
echo ""

# 3. Test pagination
echo "3. Testing pagination (page 2)..."
curl -s "http://localhost:3000/api/jobs?page=2&limit=50" | head -c 200
echo ""
echo ""

# 4. Verify response structure
echo "4. Verifying response structure..."
echo "   Expected: { jobs: [...], total: N, page: N, limit: N, totalPages: N, hasNext: bool, hasPrev: bool }"
echo ""

echo "=== Manual Verification Checklist ==="
echo ""
echo "[ ] Run 'npm run build' - should complete without errors"
echo "[ ] Run 'npm run dev' and navigate to job list"
echo "[ ] Verify page-size selector shows 25/50/100 options"
echo "[ ] Verify First/Prev/Next/Last buttons work"
echo "[ ] Verify total count matches: SELECT COUNT(*) FROM jobs"
echo "[ ] Run job finder and verify ALL fetched jobs are persisted"
echo ""

echo "=== SQL Query for Total Jobs ==="
echo ""
echo "-- For Supabase/PostgreSQL:"
echo "SELECT COUNT(*) as total_jobs FROM jobs;"
echo ""
echo "-- For detailed breakdown by source:"
echo "SELECT source_host, COUNT(*) as count FROM jobs GROUP BY source_host ORDER BY count DESC;"
echo ""
