# Repo Cleanup Plan

## Proposed Deletions

| file/path | type | evidence | reason_to_delete | safety |
|-----------|------|----------|------------------|--------|
| `oldTailoredResumeEditor.txt` | orphaned-source | orphaned-candidates.txt | Text file in src directory, likely a backup of old code. | `safe_to_delete` |
| `src/lib/adapters/replicate.ts` | orphaned-source | orphaned-candidates.txt | Not imported by any other file in src. | `manual_review_required` |
| `src/lib/job-parser.ts` | orphaned-source | orphaned-candidates.txt | Not imported by any other file in src. | `manual_review_required` |
| `src/lib/keyword-extractor.ts` | orphaned-source | orphaned-candidates.txt | Not imported by any other file in src. | `manual_review_required` |
| `src/lib/reactiveResumeClient.ts` | orphaned-source | orphaned-candidates.txt | Not imported by any other file in src. | `manual_review_required` |
| `src/lib/resume-cache.ts` | orphaned-source | orphaned-candidates.txt | Not imported by any other file in src. | `manual_review_required` |
| `src/lib/resume-generation/pipeline.ts` | orphaned-source | orphaned-candidates.txt | Not imported by any other file in src. | `manual_review_required` |
| `tmp_add_constraint.ts` | root-temp | list_dir | One-off database constraint script. | `safe_to_delete` |
| `tmp_audit_geocoding.ts` | root-temp | list_dir | One-off geocoding audit script. | `safe_to_delete` |
| `tmp_check_api.ts` | root-temp | list_dir | One-off API check script. | `safe_to_delete` |
| `tmp_check_duplicates.ts` | root-temp | list_dir | One-off duplicate check script. | `safe_to_delete` |
| `tmp_check_schema.ts` | root-temp | list_dir | One-off schema check script. | `safe_to_delete` |
| `tmp_cleanup_db.ts` | root-temp | list_dir | One-off database cleanup script. | `safe_to_delete` |
| `tmp_enable_vector.ts` | root-temp | list_dir | One-off vector enable script. | `safe_to_delete` |
| `tmp_seed_companies.ts` | root-temp | list_dir | One-off company seeding script. | `safe_to_delete` |
| `tmp_test_mapbox.js` | root-temp | list_dir | One-off Mapbox test script. | `safe_to_delete` |
| `tmp_test_mapbox_v2.js` | root-temp | list_dir | One-off Mapbox v2 test script. | `safe_to_delete` |
| `tmp_test_prisma.ts` | root-temp | list_dir | One-off Prisma test script. | `safe_to_delete` |
| `tmp_update_logos_favicon.ts` | root-temp | list_dir | One-off logo update script. | `safe_to_delete` |
| `test-output-*.txt` | root-logs | list_dir | Various test output logs in root. | `safe_to_delete` |
| `test-output.txt` | root-logs | list_dir | Test output log in root. | `safe_to_delete` |
| `test_err.txt` | root-logs | list_dir | Error log in root. | `safe_to_delete` |
| `ts_errors.txt` | root-logs | list_dir | TypeScript error log in root. | `safe_to_delete` |
| `ts_errors_utf8.txt` | root-logs | list_dir | TypeScript error log in root. | `safe_to_delete` |
| `vitest_output.txt` | root-logs | list_dir | Vitest output log in root. | `safe_to_delete` |
| `prisma_gen_log.txt` | root-logs | list_dir | Prisma generation log in root. | `safe_to_delete` |
| `stripe_debug.json` | root-temp | list_dir | Debugging JSON for Stripe. | `safe_to_delete` |
| `temp/` | temp-data | list_dir | Likely temporary data directory. | `safe_to_delete` |
| `scripts/backfill-legacy-user.js` | one-off-script | scripts/ | One-off backfill script. | `safe_to_delete` |
| `scripts/migrate-data-to-neon.js` | one-off-script | scripts/ | One-off migration script. | `safe_to_delete` |
| `scripts/migrate_geo*.js` | one-off-script | scripts/ | One-off geocoding migration scripts. | `safe_to_delete` |
| `scripts/wipe-companies.mjs` | one-off-script | scripts/ | One-off cleanup script. | `safe_to_delete` |

## Risk Assessment
- **Orphaned Source Files**: If these files are used via dynamic imports or reflection (unlikely in this project), deletion could cause runtime errors.
- **One-off Scripts**: Deleting these means you lose the ability to re-run specific migrations/backfills if needed, though they are usually preserved in git history.
- **Root Logs**: Safe to delete as they are generated outputs.

## Rollback Steps
To revert any deletion:
1. Identify the deleted file path.
2. Run `git checkout backup/before-cleanup-202603171350 -- <file/path>`
3. Or simply switch back to the backup branch: `git checkout backup/before-cleanup-202603171350`
