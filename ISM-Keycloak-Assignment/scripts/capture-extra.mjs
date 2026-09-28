/*
 * Additional evidence: the "create" forms used for realm / user / role / client, and
 * LDAP user federation (ldap/setup-ldap.sh + keycloak/setup-ldap-federation.sh).
 * Forms are filled but NOT submitted (the objects already exist).
 *
 *   NPM_ROOT=$(npm root -g) node scripts/capture-extra.mjs
 */
import { createRequire } from 'module';
import { execSync } from 'child_process';
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
const LDAP_PASS = process.env.LDAP_BIND_PASS || 'LdapAdmin#2026';
const REALM = 'UniversityRealm';
const CONSOLE = `${KC}/admin/master/console/#`;

async function api(pathname) {
  const t = await (await fetch(`${KC}/realms/master/protocol/openid-connect/token`, { method: 'POST',
    body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: ADMIN.user, password: ADMIN.pass }) })).json();
  return (await fetch(`${KC}/admin/realms/${REALM}${pathname}`, { headers: { Authorization: `Bearer ${t.access_token}` } })).json();
}

const browser = await chromium.launch();
async function shot(page, name, { height = 900, wait = 1200, clip } = {}) {
  await page.setViewportSize({ width: 1440, height });
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), clip });
  console.log('  saved', name);
}
async function go(page, route) {
  await page.goto(`${CONSOLE}${route}`);
  await page.reload();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
}

const admin = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await admin.goto(`${KC}/admin/master/console/`);
await admin.fill('#username', ADMIN.user); await admin.fill('#password', ADMIN.pass);
await admin.click('#kc-login'); await admin.waitForTimeout(3000);

// ---------------------------------------------------------------- create forms
console.log('Create forms');
await go(admin, '/master/realms');
await admin.getByRole('button', { name: /create realm/i }).click();
await admin.getByLabel(/realm name/i).fill(REALM);
await shot(admin, '43-create-realm-form', { wait: 500 });

await go(admin, `/${REALM}/users/add-user`);
await admin.getByLabel(/^username/i).fill('student01');
await admin.getByLabel(/^email$/i).fill('student01@university.local');
await admin.getByLabel(/first name/i).fill('Stella');
await admin.getByLabel(/last name/i).fill('Student');
await admin.locator('#kc-user-email-verified, [id*="email-verified"]').first().click({ force: true }).catch(() => {});
await shot(admin, '44-create-user-form', { wait: 500 });

await go(admin, `/${REALM}/roles/new`);
await admin.getByLabel(/role name/i).fill('student');
await admin.getByLabel(/description/i).fill('Enrolled student - view own courses and results');
await shot(admin, '45-create-role-form', { wait: 500 });

await go(admin, `/${REALM}/clients/add-client`);
await admin.locator('#clientId').fill('student-portal');
await admin.locator('input#name').fill('Student Portal');
await shot(admin, '46-create-client-form', { wait: 500 });

// ---------------------------------------------------------------- LDAP
console.log('LDAP federation');
const env = execSync(`ldapsearch -x -H ldap://127.0.0.1 -D cn=admin,dc=university,dc=local -w '${LDAP_PASS}' ` +
  `-b dc=university,dc=local -LLL '(|(objectClass=inetOrgPerson)(objectClass=groupOfNames))' uid cn givenName sn mail member`).toString();
const term = await browser.newPage();
await term.setContent(`<body style="margin:0;background:#0c0c0c"><pre style="margin:0;padding:20px 24px;color:#d6d6d6;font:14px/1.45 'DejaVu Sans Mono',monospace">${
  ('$ ldapsearch -x -H ldap://127.0.0.1 -D cn=admin,dc=university,dc=local -W \\\n    -b dc=university,dc=local "(|(objectClass=inetOrgPerson)(objectClass=groupOfNames))"\n\n' + env)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre></body>`);
const box = await term.locator('pre').boundingBox();
await shot(term, '47-ldap-directory-entries', { wait: 200, height: 1100, clip: { x: 0, y: 0, width: 1440, height: Math.ceil(box.height) } });
await term.close();

const ldap = (await api('/components?name=university-ldap'))[0];
await go(admin, `/${REALM}/user-federation`);
await shot(admin, '48-user-federation-providers');
await go(admin, `/${REALM}/user-federation/ldap/${ldap.id}`);
await admin.setViewportSize({ width: 1440, height: 3000 });
await admin.getByRole('button', { name: /test authentication/i }).click().catch(() => {});
await shot(admin, '49a-ldap-connection-settings', { height: 3000, wait: 800, clip: { x: 0, y: 0, width: 1440, height: 1230 } });
await shot(admin, '49b-ldap-search-sync-settings', { height: 3000, wait: 5000, clip: { x: 0, y: 1230, width: 1440, height: 1500 } });
await admin.getByRole('tab', { name: /mappers/i }).click();
await shot(admin, '50-ldap-mappers', { wait: 1500 });
const mapper = (await api(`/components?parent=${ldap.id}&name=role-groups`))[0];
await go(admin, `/${REALM}/user-federation/ldap/${ldap.id}/mappers/${mapper.id}`);
await shot(admin, '51-ldap-role-mapper', { height: 1300 });

await go(admin, `/${REALM}/users`);
// with a federated provider the console asks for a search first; "*" lists everyone
await admin.getByPlaceholder(/search user/i).fill('*');
await admin.keyboard.press('Enter');
await shot(admin, '52-users-including-ldap', { wait: 2000 });
const s2 = (await api('/users?username=student02&exact=true'))[0];
await go(admin, `/${REALM}/users/${s2.id}/settings`);
await shot(admin, '53-ldap-user-student02-details', { height: 1150 });
await go(admin, `/${REALM}/users/${s2.id}/role-mapping`);
await admin.getByText(/hide inherited roles/i).click().catch(() => {});
await shot(admin, '54-ldap-user-student02-roles');

// LDAP users log in to the portal with their directory password
for (const [u, name] of [['student02', '55-ldap-student02-portal-login'], ['lecturer02', '56-ldap-lecturer02-portal-login']]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const p = await ctx.newPage();
  await p.goto(`${APP}/login`);
  await p.fill('#username', u); await p.fill('#password', PW);
  await p.click('#kc-login');
  await p.waitForURL(`${APP}/dashboard`);
  await shot(p, name, { height: 1050, wait: 400 });
  await ctx.close();
}
await browser.close();
