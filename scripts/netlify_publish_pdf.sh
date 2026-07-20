#!/bin/bash
set -euo pipefail

echo "--- Inizio Build DOSepranza ---"

DIST_DIR="dist"

# 1. Crea una cartella pulita per il deploy
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# 2. Copia i file fondamentali nella cartella dist
cp index.html "$DIST_DIR/"
cp app.js "$DIST_DIR/" 2>/dev/null || true
cp app.v20260210.js "$DIST_DIR/" 2>/dev/null || true
cp app.v20260325.js "$DIST_DIR/" 2>/dev/null || cp app.js "$DIST_DIR/index.js"
cp styles.css "$DIST_DIR/" 2>/dev/null || echo "No CSS file found"
cp tailwind-config.js "$DIST_DIR/" 2>/dev/null || echo "No Tailwind config found"
cp sw-killer.js "$DIST_DIR/" 2>/dev/null || echo "No service worker helper found"
cp netlify-preauth-reset.js "$DIST_DIR/" 2>/dev/null || echo "No preauth reset found"
cp netlify-staff-auth-guard.js "$DIST_DIR/" 2>/dev/null || echo "No staff auth guard found"
cp favicondosepranza.png "$DIST_DIR/" 2>/dev/null || echo "No favicon found"
cp -R login "$DIST_DIR/" 2>/dev/null || echo "No login folder"
cp -R reports "$DIST_DIR/" 2>/dev/null || echo "No reports folder"

python3 - <<'PY'
from pathlib import Path

index_path = Path('dist/index.html')
html = index_path.read_text(encoding='utf-8')
pre = '<script src="netlify-preauth-reset.js?v=staff-preauth-1"></script>'
post = '<script src="netlify-staff-auth-guard.js?v=staff-auth-1"></script>'
app_tag = '<script type="module" src="app.v20260325.js?v=13"></script>'
if pre not in html:
    html = html.replace(app_tag, f'    {pre}\n    {app_tag}')
if post not in html:
    html = html.replace('</body>', f'    {post}\n</body>')
index_path.write_text(html, encoding='utf-8')

app_path = Path('dist/app.v20260325.js')
js = app_path.read_text(encoding='utf-8')
old = "if(role === 'user' && state.authzSource !== 'claims') {"
new = "if(role === 'user' && state.authzSource !== 'claims' && auth_fb.currentUser && !auth_fb.currentUser.isAnonymous && normalizeEmail(auth_fb.currentUser.email) === e) {"
if old not in js:
    raise SystemExit('staff fallback patch target not found')
js = js.replace(old, new, 1)
needle = "                const name = normalizeName(isAnon ? cached?.name : (u.displayName || u.email?.split('@')[0] || ''));"
insert = needle + """
                if(isAnon && isMappedStaffEmail(email)) {
                    localStorage.removeItem('dose_user');
                    localStorage.removeItem('menu_admin_open');
                    state.user = null;
                    state.role = 'user';
                    state.authzSource = 'unverified';
                    document.getElementById('user-modal').classList.remove('hidden');
                    renderRoleStatus();
                    renderMenuAdminToggle();
                    return;
                }"""
if needle not in js:
    raise SystemExit('anonymous staff cache patch target not found')
js = js.replace(needle, insert, 1)
app_path.write_text(js, encoding='utf-8')
PY

echo "--- Build completata con successo nella cartella /$DIST_DIR ---"
