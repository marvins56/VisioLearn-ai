/*
 * Captures the evidence screenshots used in the report (evidence/screenshots).
 *
 * Prerequisites: Keycloak running on :8080 and configured by keycloak/setup-realm.sh,
 * student-portal running on :3000, Playwright (npm i -g playwright).
 *
 *   NPM_ROOT=$(npm root -g) node scripts/capture-evidence.mjs
 */
import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.NPM_ROOT || '', 'playwright'));

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../evidence/screenshots');
const KC = process.env.KC_URL || 'http://localhost:8080';
const APP = process.env.APP_URL || 'http://localhost:3000';
const ADMIN = { user: process.env.PERM_ADMIN_USER || 'iamadmin', pass: process.env.PERM_ADMIN_PASS || 'IamAdmin#2026' };
const PW = process.env.DEMO_PASSWORD || 'Passw0rd#2026';
const REALM = 'UniversityRealm';
const CONSOLE = `${KC}/admin/master/console/#`;

// ----------------------------------------------------------------- admin REST helper (for ids)
async function adminToken() {
  const r = await fetch(`${KC}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: ADMIN.user, password: ADMIN.pass }),
  });
  return (await r.json()).access_token;
}
async function api(pathname, init = {}) {
  const r = await fetch(`${KC}/admin/realms/${REALM}${pathname}`, {
    ...init,
    headers: { Authorization: `Bearer ${await adminToken()}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  return r.status === 204 ? null : r.json();
}
const userId = async (u) => (await api(`/users?username=${u}&exact=true`))[0].id;
const roleId = async (r) => (await api(`/roles/${r}`)).id;
const clientId = async (c) => (await api(`/clients?clientId=${c}`))[0].id;

// ----------------------------------------------------------------- browser helpers
const browser = await chromium.launch();
const shots = [];
async function shot(page, name, { height = 900, wait = 1500, clip } = {}) {
  await page.setViewportSize({ width: 1440, height });
  await page.waitForTimeout(wait);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, clip });
  shots.push(name);
  console.log('  saved', name);
}
async function consoleGo(page, route, opts) {
  await page.goto(`${CONSOLE}${route}`);
  await page.reload();
  await page.waitForLoadState('networkidle').catch(() => {});
  if (opts?.name) await shot(page, opts.name, opts);
}

// ================================================================= TASK 1
console.log('Task 1 - installation & admin console');
const envFile = path.resolve(here, '../evidence/environment.txt');
if (existsSync(envFile)) {
  const p = await browser.newPage();
  const txt = readFileSync(envFile, 'utf8').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  await p.setContent(`<body style="margin:0;background:#0c0c0c"><pre style="margin:0;padding:20px 24px;color:#d6d6d6;
    font:14px/1.45 'DejaVu Sans Mono',monospace;white-space:pre-wrap">${txt}</pre></body>`);
  const box = await p.locator('pre').boundingBox();
  await shot(p, '01-environment-terminal', { height: 1100, wait: 200, clip: { x: 0, y: 0, width: 1440, height: Math.ceil(box.height) } });
  await p.close();
}

const admin = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await admin.goto(`${KC}/admin/master/console/`);
await admin.waitForSelector('#username');
await admin.fill('#username', ADMIN.user);
await shot(admin, '02-admin-console-login', { wait: 300 });
await admin.fill('#password', ADMIN.pass);
await admin.click('#kc-login');
await admin.waitForTimeout(3000);
await shot(admin, '03-admin-console-home');
await consoleGo(admin, '/master/info', { name: '04-server-info-version' });
await consoleGo(admin, '/master/users', { name: '05-master-admin-account' });
const masterAdminId = (await (await fetch(`${KC}/admin/realms/master/users?username=${ADMIN.user}&exact=true`,
  { headers: { Authorization: `Bearer ${await adminToken()}` } })).json())[0].id;
await consoleGo(admin, `/master/users/${masterAdminId}/role-mapping`, { name: '06-master-admin-role' });

// ================================================================= TASK 2
console.log('Task 2 - realm & users');
await consoleGo(admin, '/master/realms', { name: '07-realm-list' });
await consoleGo(admin, `/${REALM}/realm-settings`, { name: '08-realm-settings-general', height: 1100 });
await consoleGo(admin, `/${REALM}/users`, { name: '09-users-list' });
const ids = {};
for (const u of ['admin01', 'lecturer01', 'student01']) {
  ids[u] = await userId(u);
  await consoleGo(admin, `/${REALM}/users/${ids[u]}/settings`, { name: `10-user-${u}-details` });
}
await consoleGo(admin, `/${REALM}/users/${ids.student01}/credentials`, { name: '11-user-student01-credentials' });
await consoleGo(admin, `/${REALM}/authentication/policies`, { name: '12-password-policy' });
await consoleGo(admin, `/${REALM}/realm-settings/security-defenses`);
await admin.getByRole('tab', { name: /brute force/i }).click().catch(() => {});
await shot(admin, '13-brute-force-protection', { height: 1000 });

// ================================================================= TASK 3
console.log('Task 3 - roles');
await consoleGo(admin, `/${REALM}/roles`, { name: '14-realm-roles-list' });
for (const r of ['system-admin', 'lecturer', 'student']) {
  const rid = await roleId(r);
  await consoleGo(admin, `/${REALM}/roles/${rid}/details`, { name: `15-role-${r}-details` });
  await consoleGo(admin, `/${REALM}/roles/${rid}/users-in-role`, { name: `16-role-${r}-users` });
}
for (const u of ['admin01', 'lecturer01', 'student01']) {
  await consoleGo(admin, `/${REALM}/users/${ids[u]}/role-mapping`, { name: `17-role-mapping-${u}` });
}

// ================================================================= TASK 4 (client)
console.log('Task 4 - client');
const cid = await clientId('student-portal');
await consoleGo(admin, `/${REALM}/clients`, { name: '18-clients-list' });
await consoleGo(admin, `/${REALM}/clients/${cid}/settings`);
await shot(admin, '19a-client-settings-access', { height: 2300, clip: { x: 0, y: 0, width: 1440, height: 1150 } });
await shot(admin, '19b-client-settings-capability', { height: 2300, wait: 200, clip: { x: 0, y: 1180, width: 1440, height: 720 } });
await consoleGo(admin, `/${REALM}/clients/${cid}/credentials`, { name: '20-client-credentials' });

const disc = await browser.newPage();
await disc.goto(`${KC}/realms/${REALM}/.well-known/openid-configuration`);
const cfg = JSON.parse(await disc.innerText('body'));
const subset = Object.fromEntries(['issuer', 'authorization_endpoint', 'token_endpoint', 'userinfo_endpoint', 'end_session_endpoint',
  'jwks_uri', 'grant_types_supported', 'response_types_supported', 'code_challenge_methods_supported',
  'id_token_signing_alg_values_supported'].map((k) => [k, cfg[k]]));
await disc.setContent(`<body style="margin:0;font:13px monospace;background:#fff"><div style="background:#eee;padding:8px 16px;border-bottom:1px solid #ccc">
  GET ${KC}/realms/${REALM}/.well-known/openid-configuration (excerpt)</div><pre style="padding:12px 16px;margin:0">${
  JSON.stringify(subset, null, 2).replace(/</g, '&lt;')}</pre></body>`);
await shot(disc, '22-oidc-discovery', { height: 760, wait: 200 });
await disc.close();

// ================================================================= TASK 4 (authentication demo)
console.log('Task 4 - authentication flow');
async function loginAs(username, prefix, visits) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(APP);
  if (prefix === 'a') await shot(p, '23-portal-landing', { wait: 400 });
  await p.click('text=Log in with University SSO');
  await p.waitForSelector('#username');
  await p.fill('#username', username);
  await p.fill('#password', PW);
  if (prefix === 'a') await shot(p, '24-keycloak-login-page', { wait: 400 });
  await p.click('#kc-login');
  await p.waitForURL(`${APP}/dashboard`);
  await shot(p, `25${prefix}-dashboard-${username}`, { height: 1050, wait: 400 });
  for (const [v, name] of visits) {
    await p.goto(`${APP}${v}`);
    await shot(p, name, { wait: 300 });
  }
  return { ctx, p };
}
const a = await loginAs('admin01', 'a', [['/admin', '26-admin01-admin-granted'], ['/lecturer/grades', '27-admin01-grades-denied']]);
const l = await loginAs('lecturer01', 'b', [['/lecturer/grades', '28-lecturer01-grades-granted'], ['/admin', '29-lecturer01-admin-denied']]);
const s = await loginAs('student01', 'c', [['/student/courses', '30-student01-courses-granted'],
  ['/lecturer/grades', '31-student01-grades-denied'], ['/token', '32-student01-access-token']]);

await consoleGo(admin, `/${REALM}/sessions`, { name: '33-active-sessions' });
await consoleGo(admin, `/${REALM}/clients/${cid}/sessions`, { name: '34-client-sessions' });

// Logout (RP-initiated) - ends Keycloak SSO session as well
await s.p.goto(`${APP}/logout`);
await s.p.waitForTimeout(1500);
await shot(s.p, '35-after-logout', { wait: 300 });
for (const x of [a, l, s]) await x.ctx.close();

// Wrong password attempt (authentication failure)
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${APP}/login`);
  await p.fill('#username', 'lecturer01'); await p.fill('#password', 'WrongPassword1!');
  await p.click('#kc-login');
  await shot(p, '36-invalid-password', { wait: 800 });
  await ctx.close();
}

// ================================================================= TASK 2 - disable / enable
console.log('Task 2 - disable/enable account');
await consoleGo(admin, `/${REALM}/users/${ids.student01}/settings`);
const toggle = admin.locator('[data-testid="user-enabled-switch"], #user-enabled-switch, .pf-v5-c-switch input').first();
await toggle.click({ force: true });
const confirm = admin.getByRole('button', { name: /^disable$/i });
if (await confirm.isVisible().catch(() => false)) {
  await shot(admin, '37-disable-confirm', { wait: 300 });
  await confirm.click();
}
await admin.waitForTimeout(1000);
let u = await api(`/users/${ids.student01}`);
if (u.enabled) { // fallback if the console markup changed
  await api(`/users/${ids.student01}`, { method: 'PUT', body: JSON.stringify({ ...u, enabled: false }) });
  await admin.reload();
}
await shot(admin, '38-student01-disabled', { height: 1000 });
await consoleGo(admin, `/${REALM}/users`, { name: '39-users-list-disabled' });
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${APP}/login`);
  await p.fill('#username', 'student01'); await p.fill('#password', PW);
  await p.click('#kc-login');
  await shot(p, '40-disabled-login-rejected', { wait: 800 });
  await ctx.close();
}
u = await api(`/users/${ids.student01}`);
await api(`/users/${ids.student01}`, { method: 'PUT', body: JSON.stringify({ ...u, enabled: true }) });
await consoleGo(admin, `/${REALM}/users/${ids.student01}/settings`, { name: '41-student01-re-enabled', height: 1000 });

// ================================================================= events (audit)
await consoleGo(admin, `/${REALM}/events`, { name: '42-login-events', height: 1100 });

await browser.close();
console.log(`\n${shots.length} screenshots written to ${OUT}`);
