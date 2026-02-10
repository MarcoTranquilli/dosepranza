#!/usr/bin/env bash
set -euo pipefail

if [ "${UAT_IN_NETLIFY:-}" != "1" ]; then
  echo "UAT_IN_NETLIFY not set. Skipping UAT PDF generation."
  exit 0
fi

echo "Running UAT + PDF generation inside Netlify build..."

npm install
npx playwright install --with-deps

# Serve static site for tests
python3 -m http.server 8081 --bind 127.0.0.1 >/tmp/uat_server.log 2>&1 &

BASE_URL="http://127.0.0.1:8081" npm run test:uat
npm run report:pdf

if [ -f "playwright-report/uat-report.pdf" ]; then
  echo "PDF generated: /uat-report.pdf (Netlify)
- Latest: /.netlify/functions/report?key=reports/latest.pdf
- Reports dashboard: /reports"

  # Store in Netlify Blobs for persistence
  node scripts/store_report_blobs.mjs
  # Store flaky tests
  node scripts/store_flaky.mjs
  # Weekly aggregate
  node scripts/weekly_aggregate.mjs
  # Optional email notification
  node scripts/send_report_email.mjs

  # Optional Slack alert on failures
  node scripts/send_report_slack.mjs
  # Optional Slack file upload (PDF)
  node scripts/send_report_slack_file.mjs
  # Optional Teams alert on failures
  node scripts/send_report_teams.mjs
  # Save failures for report history
  node scripts/store_failures_in_repo.mjs

  # Optional audit export to S3 (requires REPORT_BASE_URL + AWS creds)
  node scripts/export_audit_from_netlify.mjs || true
  node scripts/export_audit_s3.mjs || true

  echo "Report URLs:"
  echo " - /reports"
  echo " - /.netlify/functions/report?key=reports/latest.pdf"
else
  echo "PDF not found."
fi
