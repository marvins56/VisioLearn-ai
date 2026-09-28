#!/usr/bin/env bash
# Two-pass build of the practical report:
#   pass 1 -> render with LibreOffice -> find the page of every heading ->
#   pass 2 with real page numbers in the table of contents -> final DOCX + PDF.
# Requires: node (npm install in this folder), LibreOffice Writer, python3 + pymupdf.
set -euo pipefail
cd "$(dirname "$0")"
REPORT=../report/ISM_Keycloak_Practical_Report
WORK=$(mktemp -d)

node build-report.js
env -u JAVA_TOOL_OPTIONS soffice --headless --convert-to pdf --outdir "$WORK" "$REPORT.docx" >/dev/null 2>&1

python3 - "$WORK/ISM_Keycloak_Practical_Report.pdf" "$WORK/toc.json" <<'PY'
import sys, json, pymupdf
doc = pymupdf.open(sys.argv[1])
heads = json.load(open('.headings.json'))
norm = lambda t: ' '.join(t.split())
pages = [norm(pg.get_text()) for pg in doc]
out, start = {}, 2                      # skip cover + contents page
for h in heads:
    for i in range(start, len(pages)):
        if norm(h['text']) in pages[i]:
            out[h['text']] = i + 1
            start = i
            break
missing = [h['text'] for h in heads if h['text'] not in out]
if missing: print('WARNING: headings not located:', missing)
json.dump(out, open(sys.argv[2], 'w'))
PY

TOC_PAGES="$WORK/toc.json" node build-report.js
env -u JAVA_TOOL_OPTIONS soffice --headless --convert-to pdf --outdir ../report "$REPORT.docx" >/dev/null 2>&1
rm -rf "$WORK" .headings.json
echo "built $REPORT.docx and $REPORT.pdf"
