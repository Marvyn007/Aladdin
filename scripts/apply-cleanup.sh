#!/bin/bash
# Apply Repo Cleanup deletions

TIMESTAMP=$(date +%Y%m%d%H%M)
BRANCH_NAME="cleanup/apply-$TIMESTAMP"

echo "Creating branch $BRANCH_NAME..."
git checkout -b $BRANCH_NAME

echo "Deleting safe_to_delete files..."

# Orphaned Source
git rm src/components/resume-editor/oldTailoredResumeEditor.txt

# Root Temp Files
git rm tmp_add_constraint.ts
git rm tmp_audit_geocoding.ts
git rm tmp_check_api.ts
git rm tmp_check_duplicates.ts
git rm tmp_check_schema.ts
git rm tmp_cleanup_db.ts
git rm tmp_enable_vector.ts
git rm tmp_seed_companies.ts
git rm tmp_test_mapbox.js
git rm tmp_test_mapbox_v2.js
git rm tmp_test_prisma.ts
git rm tmp_update_logos_favicon.ts

# Root Log Files
git rm test-output-ats.txt
git rm test-output-bullets.txt
git rm test-output-compose.txt
git rm test-output-integrity.txt
git rm test-output-li.txt
git rm test-output-merge.txt
git rm test-output-orchestrator.txt
git rm test-output-orchestrator2.txt
git rm test-output.txt
git rm test_err.txt
git rm ts_errors.txt
git rm ts_errors_utf8.txt
git rm vitest_output.txt
git rm prisma_gen_log.txt
git rm stripe_debug.json

# Temp Directory
git rm -r temp/

# One-off Scripts
git rm scripts/backfill-legacy-user.js
git rm scripts/migrate-data-to-neon.js
git rm scripts/migrate_geo.js
git rm scripts/migrate_geo_columns.js
git rm scripts/migrate_geo_v2.js
git rm scripts/wipe-companies.mjs

echo "Verifying build..."
npm ci && npm run build

if [ $? -eq 0 ]; then
  echo "Build successful! Committing changes..."
  git commit -m "chore: remove unused files — cleanup"
  git push -u origin $BRANCH_NAME
  echo "Cleanup applied and pushed. Please open a PR."
else
  echo "Build failed! Reverting deletions..."
  git reset --hard HEAD
  echo "Failed build recorded in reports/cleanup-failure.log"
  echo "Build failure at $TIMESTAMP" >> reports/cleanup-failure.log
  exit 1
fi
