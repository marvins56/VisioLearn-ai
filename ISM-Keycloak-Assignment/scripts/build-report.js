/*
 * Builds report/ISM_Keycloak_Practical_Report.docx from the evidence screenshots
 * and diagrams.   cd scripts && npm install && node build-report.js
 *
 * Cover-page details can be supplied via env vars:
 *   STUDENT_NAME, STUDENT_REG, PROGRAMME, LECTURER, SUBMIT_DATE
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, Table, TableRow,
  TableCell, WidthType, ShadingType, BorderStyle, LevelFormat, PageBreak, Header,
  Footer, PageNumber, TabStopType,
} = require('docx');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'evidence', 'screenshots');
const DIAG = path.join(ROOT, 'docs', 'diagrams');
const OUT = path.join(ROOT, 'report', 'ISM_Keycloak_Practical_Report.docx');
// page numbers for the static TOC, produced by build-report.sh from a rendered PDF (pass 2)
const TOC_PAGES = process.env.TOC_PAGES && fs.existsSync(process.env.TOC_PAGES) ? JSON.parse(fs.readFileSync(process.env.TOC_PAGES, 'utf8')) : {};

const STUDENT_NAME = process.env.STUDENT_NAME || '[Your full name]';
const STUDENT_REG = process.env.STUDENT_REG || '[Your registration number]';
const PROGRAMME = process.env.PROGRAMME || '[Programme / Course]';
const LECTURER = process.env.LECTURER || '[Lecturer name]';
const SUBMIT_DATE = process.env.SUBMIT_DATE || '[Submission date]';

// A4 with 1" margins -> 9026 DXA content width (~6.27in)
const CONTENT_W = 9026;
const FONT = 'Calibri';
const BRAND = '1F4E8C';

// ------------------------------------------------------------------ helpers
const p = (text, opts = {}) => new Paragraph({
  spacing: { after: 120, line: 276 },
  ...opts,
  children: runs(text, opts.run),
});
// **bold** and `code` inline markup
function runs(text, base = {}) {
  if (Array.isArray(text)) return text;
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    const t = m[0];
    if (t.startsWith('**')) out.push(new TextRun({ text: t.slice(2, -2), bold: true, ...base }));
    else out.push(new TextRun({ text: t.slice(1, -1), font: 'Consolas', size: 20, color: '9A3412', ...base }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}
const HEADINGS = [];
const h1 = (t) => { HEADINGS.push({ level: 1, text: t }); return new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(t)] }); };
const h2 = (t) => { HEADINGS.push({ level: 2, text: t }); return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] }); };
const h3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] });
const bullet = (t, level = 0) => new Paragraph({ numbering: { reference: 'bullets', level }, spacing: { after: 60 }, children: runs(t) });
const num = (t, ref = 'steps') => new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 60 }, children: runs(t) });
const code = (lines) => lines.map((l, i) => new Paragraph({
  shading: { type: ShadingType.CLEAR, fill: 'F1F5F9', color: 'auto' },
  spacing: { after: i === lines.length - 1 ? 160 : 0, line: 240 },
  indent: { left: 144, right: 144 },
  children: [new TextRun({ text: l || ' ', font: 'Consolas', size: 18 })],
}));

function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
let figNo = 0;
const FIG = {};
const F = (a, b) => `Fig${b ? 's' : ''}. ${FIG[a + '.png']}${b ? '–' + FIG[b + '.png'] : ''}`;
function figure(file, caption, { maxW = 600, maxH = 560, dir = SHOTS } = {}) {
  const f = path.join(dir, file);
  if (!fs.existsSync(f)) throw new Error('missing ' + f);
  const { w, h } = pngSize(f);
  let width = maxW, height = Math.round((h / w) * maxW);
  if (height > maxH) { height = maxH; width = Math.round((w / h) * maxH); }
  figNo += 1;
  if (!(file in FIG)) FIG[file] = figNo;
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 120, after: 40 }, keepNext: true,
      children: [new ImageRun({ type: 'png', data: fs.readFileSync(f), transformation: { width, height },
        altText: { title: caption, description: caption, name: file } })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 200 },
      children: [new TextRun({ text: `Figure ${figNo}: `, bold: true, italics: true, size: 19, color: '475569' }),
        new TextRun({ text: caption, italics: true, size: 19, color: '475569' })],
    }),
  ];
}

const border = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
const borders = { top: border, bottom: border, left: border, right: border };
function table(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  const cell = (t, i, head) => new TableCell({
    borders, width: { size: widths[i], type: WidthType.DXA },
    shading: head ? { type: ShadingType.CLEAR, fill: 'E8EEF8', color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ spacing: { after: 0 }, children: runs(t, head ? { bold: true, size: 20 } : { size: 20 }) })],
  });
  return new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: [new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, i, true)) }),
      ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, i, false)) }))],
  });
}
const spacer = () => new Paragraph({ spacing: { after: 120 }, children: [] });

// ------------------------------------------------------------------ cover
function buildCover() { return [
  new Paragraph({ spacing: { before: 1400, after: 120 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'INFORMATION SECURITY MANAGEMENT', bold: true, size: 36, color: BRAND })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 },
    children: [new TextRun({ text: 'Practical Take-Home Assessment', size: 28, color: '334155' })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 },
    border: { top: { style: BorderStyle.SINGLE, size: 12, color: BRAND, space: 12 }, bottom: { style: BorderStyle.SINGLE, size: 12, color: BRAND, space: 12 } },
    children: [new TextRun({ text: 'Identity Management using Keycloak', bold: true, size: 48 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 1000 },
    children: [new TextRun({ text: 'Centralised IAM for UniversityRealm: realm, users, RBAC, OIDC client and authentication demonstration', size: 24, italics: true, color: '475569' })] }),
  ...[
    ['Student name', STUDENT_NAME], ['Registration number', STUDENT_REG], ['Programme', PROGRAMME],
    ['Course unit', 'Information Security Management'], ['Lecturer', LECTURER],
    ['Practical tool', 'Keycloak 26.7.4 (OpenID Connect)'], ['Total marks', '40'], ['Date of submission', SUBMIT_DATE],
  ].map(([k, v]) => new Paragraph({
    tabStops: [{ type: TabStopType.LEFT, position: 4300 }], indent: { left: 1100 }, spacing: { after: 100 },
    children: [new TextRun({ text: k, bold: true, size: 24 }), new TextRun({ text: '\t' + v, size: 24 })],
  })),
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: 'Table of Contents', bold: true, size: 32, color: BRAND })] }),
  ...HEADINGS.map((h) => new Paragraph({
    indent: { left: h.level === 1 ? 0 : 400 }, spacing: { after: h.level === 1 ? 80 : 40, before: h.level === 1 ? 80 : 0 },
    tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W, leader: 'dot' }],
    children: [new TextRun({ text: h.text, bold: h.level === 1, size: h.level === 1 ? 22 : 20 }),
      new TextRun({ text: '\t' + (TOC_PAGES[h.text] ?? ''), size: h.level === 1 ? 22 : 20 })],
  })),
]; }

// ------------------------------------------------------------------ body
const body = [
  // 1 ---------------------------------------------------------------
  h1('1. Introduction'),
  p('The institution is moving to a single, centralised Identity and Access Management (IAM) service built on **Keycloak**, an open-source Identity Provider that supports OpenID Connect (OIDC), OAuth 2.0 and SAML 2.0. The institution has three categories of users: **Administrators, Lecturers and Students**. Until now each application kept its own user accounts, so the same person had several passwords, there was no single place to revoke access, and permissions were inconsistent.'),
  p('Acting as the **IAM Administrator**, I installed Keycloak and did the following:'),
  bullet('created the dedicated realm `UniversityRealm`;'),
  bullet('created the users `admin01`, `lecturer01` and `student01`;'),
  bullet('configured role-based access control with the roles `system-admin`, `lecturer` and `student`;'),
  bullet('registered an institutional application, `student-portal`, as an OIDC client;'),
  bullet('showed that each user authenticates through Keycloak and receives different authorization in the application.'),
  p('The report follows the required structure. Every configuration step has screenshot evidence taken from the running system. The full configuration can also be reproduced from the accompanying scripts (Appendix A).'),
  h2('1.1 Objectives'),
  table(['Task', 'Objective', 'Section'], [
    ['1', 'Install and start Keycloak, create an administrative account, document the environment', '2'],
    ['2', 'Create UniversityRealm and three users with attributes; enable/disable accounts', '3, 4'],
    ['3', 'Create roles, assign them, apply least privilege, prove different privileges', '5'],
    ['4', 'Create an OIDC client, configure redirect URLs, demonstrate authentication', '6, 7'],
    ['5', 'Architecture diagram, security analysis and recommendations', '8, 9, 10'],
  ], [900, 6426, 1700]),

  // 2 ---------------------------------------------------------------
  h1('2. Keycloak Environment and Setup (Task 1)'),
  h2('2.1 Environment used'),
  table(['Item', 'Value'], [
    ['Operating system', 'Ubuntu 24.04.4 LTS (Noble Numbat), x86_64, Linux kernel 6.18'],
    ['Hardware (VM)', '4 vCPU, 15 GiB RAM'],
    ['Java runtime', 'OpenJDK 21.0.10'],
    ['Keycloak version', '26.7.4 (Quarkus distribution, keycloak-26.7.4.tar.gz)'],
    ['Start mode', '`kc.sh start-dev`, development profile, embedded H2 database, HTTP port 8080'],
    ['Admin Console URL', '`http://localhost:8080/admin`'],
    ['Test application', 'Student Portal: Node.js 22, Express 4, openid-client 5, port 3000'],
  ], [2600, 6426]),
  h2('2.2 Installation steps'),
  num('Install the Java 21 runtime: `sudo apt install openjdk-21-jre-headless`.'),
  num('Download the Keycloak 26.7.4 distribution and extract it: `tar xzf keycloak-26.7.4.tar.gz && cd keycloak-26.7.4`.'),
  num('Start Keycloak with a temporary bootstrap administrator (Keycloak 26 creates the first admin from these variables):'),
  ...code([
    'export KC_BOOTSTRAP_ADMIN_USERNAME=temp-admin',
    'export KC_BOOTSTRAP_ADMIN_PASSWORD=********',
    'bin/kc.sh start-dev --http-port=8080',
  ]),
  num('Open `http://localhost:8080/admin` and sign in as the temporary admin.'),
  num('Create a **permanent, named administrator** `iamadmin` in the `master` realm (Users → Add user). Set its password on the Credentials tab and give it the `admin` realm role on the Role mapping tab.'),
  num('Sign in again as `iamadmin` and **delete `temp-admin`**. Keycloak marks the bootstrap account as temporary, and leaving a shared bootstrap credential in place is a security risk.'),
  ...figure('01-environment-terminal.png', 'Environment: OS, Java and Keycloak version, and the start-up log showing Keycloak 26.7.4 listening on port 8080', { maxH: 520 }),
  ...figure('02-admin-console-login.png', 'Keycloak Administration Console login page (master realm)'),
  ...figure('03-admin-console-home.png', 'Successful access to the Administration Console as "IAM Administrator"'),
  ...figure('04-server-info-version.png', 'Server info tab confirming Keycloak version 26.7.4'),
  ...figure('05-master-admin-account.png', 'Permanent administrative account iamadmin in the master realm (temporary bootstrap admin removed)'),
  ...figure('06-master-admin-role.png', 'iamadmin holds the master-realm "admin" role'),

  // 3 ---------------------------------------------------------------
  h1('3. Realm Configuration (Task 2)'),
  p('A realm is an isolated space that holds its own users, roles, clients and policies. The `master` realm is kept only for administering Keycloak. The institution\'s identities live in a separate realm, so ordinary users can never reach the Keycloak administration functions.'),
  h2('3.1 Creating UniversityRealm'),
  p('Steps: open the realm selector and choose **Manage realms → Create realm**, enter Realm name `UniversityRealm`, and click Create. Then open Realm settings → General and set the Display name to "University Identity Service", which is shown on the login page.'),
  ...figure('07-realm-list.png', 'Manage realms: UniversityRealm created alongside master'),
  ...figure('08-realm-settings-general.png', 'UniversityRealm general settings (enabled, Require SSL: external requests)', { maxH: 600 }),
  h2('3.2 Realm security settings'),
  table(['Setting', 'Value', 'Purpose'], [
    ['User registration', 'Off', 'Only the IAM administrator creates identities'],
    ['Login with email', 'On; duplicate emails Off', 'Convenient and unique sign-in'],
    ['Forgot password', 'On', 'Self-service reset through verified email'],
    ['Password policy', 'min. 10 chars, 1 upper, 1 lower, 1 digit, 1 special, not username, history 3', 'Resist guessing and reuse'],
    ['Brute-force detection', 'Lockout temporarily after 5 failures, wait 1 min increasing to 15 min', 'Stop password guessing'],
    ['Token lifetimes', 'Access token 5 min, SSO idle 30 min, SSO max 10 h', 'Limit damage from stolen tokens or sessions'],
    ['Events', 'Login and admin events saved for 30 days', 'Audit trail'],
  ], [2200, 3700, 3126]),
  ...figure('12-password-policy.png', 'Authentication → Policies → Password policy for UniversityRealm'),
  ...figure('13-brute-force-protection.png', 'Realm settings → Security defenses → Brute force detection'),

  // 4 ---------------------------------------------------------------
  h1('4. User Configuration (Task 2)'),
  p('Each user was created under Users → Add user with the required attributes. The password was then set on the **Credentials** tab with "Temporary" switched off, so it can be used for the demonstration.'),
  table(['Username', 'First name', 'Last name', 'Email', 'Password'], [
    ['admin01', 'Alice', 'Admin', 'admin01@university.local', 'set (meets policy)'],
    ['lecturer01', 'Leonard', 'Lecturer', 'lecturer01@university.local', 'set (meets policy)'],
    ['student01', 'Stella', 'Student', 'student01@university.local', 'set (meets policy)'],
  ], [1500, 1350, 1350, 3026, 1800]),
  ...figure('09-users-list.png', 'UniversityRealm users: admin01, lecturer01 and student01'),
  ...figure('10-user-admin01-details.png', 'admin01: username, email, first name, last name'),
  ...figure('10-user-lecturer01-details.png', 'lecturer01 user details'),
  ...figure('10-user-student01-details.png', 'student01 user details'),
  ...figure('11-user-student01-credentials.png', 'Credentials tab: a password credential is stored (hashed) for student01'),
  h2('4.1 Enabling and disabling a user account'),
  p('**Demonstration:** on student01\'s Details page I switched the **Enabled** toggle off and confirmed the dialog. The Users list then shows a "Disabled" badge. When student01 tries to sign in to the Student Portal, Keycloak rejects the attempt with **"Account is disabled, contact your administrator."** The account was then switched back on and login worked again.'),
  ...figure('37-disable-confirm.png', 'Disabling student01: confirmation dialog'),
  ...figure('38-student01-disabled.png', 'student01 saved as Disabled'),
  ...figure('39-users-list-disabled.png', 'Users list showing student01 flagged as Disabled'),
  ...figure('40-disabled-login-rejected.png', 'Login attempt by the disabled account is refused by Keycloak'),
  ...figure('41-student01-re-enabled.png', 'student01 re-enabled'),
  p('**When this control is needed.** Disabling blocks authentication immediately but keeps the identity, its roles and its audit history. Deleting would lose all of those. Typical cases are:'),
  bullet('a student is suspended, has deferred, or has not cleared fees;'),
  bullet('a staff member is on extended leave, or their contract has ended and offboarding is still pending;'),
  bullet('**suspected compromise**: stolen credentials or unusual login events. The account is frozen while the incident is investigated;'),
  bullet('graduates and leavers are disabled first and deleted later under the records-retention policy;'),
  bullet('a disciplinary or legal hold, where evidence must be preserved.'),

  // 5 ---------------------------------------------------------------
  h1('5. Role Configuration (Task 3)'),
  h2('5.1 Creating the roles'),
  p('Under Realm roles → Create role I created three **realm roles**, each with a description. Realm roles, rather than client roles, were chosen so that any future institutional application such as an LMS or library system can reuse the same roles.'),
  ...figure('14-realm-roles-list.png', 'Realm roles: system-admin, lecturer and student (plus Keycloak defaults)'),
  ...figure('15-role-system-admin-details.png', 'Role details: system-admin'),
  ...figure('15-role-lecturer-details.png', 'Role details: lecturer'),
  ...figure('15-role-student-details.png', 'Role details: student'),
  h2('5.2 Assigning roles to users'),
  p('Roles were assigned from each user\'s **Role mapping → Assign role** tab (filter by realm roles):'),
  table(['User', 'Assigned role', 'Access in student-portal'], [
    ['admin01', 'system-admin', '/admin (System Administration)'],
    ['lecturer01', 'lecturer', '/lecturer/grades (Grade Management)'],
    ['student01', 'student', '/student/courses (My Courses & Results)'],
  ], [2000, 2500, 4526]),
  ...figure('17-role-mapping-admin01.png', 'admin01 → system-admin'),
  ...figure('17-role-mapping-lecturer01.png', 'lecturer01 → lecturer'),
  ...figure('17-role-mapping-student01.png', 'student01 → student'),
  ...figure('16-role-system-admin-users.png', '"Users in role" for system-admin: only admin01'),
  ...figure('16-role-lecturer-users.png', '"Users in role" for lecturer: only lecturer01'),
  ...figure('16-role-student-users.png', '"Users in role" for student: only student01'),
  h2('5.3 How least privilege is applied'),
  bullet('**One role per user, no composite roles.** A user gets only the permissions their job needs. `system-admin` is deliberately **not** a composite of `lecturer` or `student`, so the administrator cannot read or change grades (demonstrated in section 5.4).'),
  bullet('**Application administrator is not the IdP administrator.** admin01 has **no** `realm-management` roles, so they cannot create users or change roles in Keycloak. Only `iamadmin` in the master realm can, which keeps IAM duties separate from application duties.'),
  bullet('**Deny by default in the application.** Every protected page checks for one specific role. If the role is missing, the application returns HTTP 403.'),
  bullet('**Minimal client capabilities.** student-portal has only the Standard (authorization code) flow. Implicit flow, direct password grants and service accounts are disabled.'),
  bullet('**Short-lived credentials.** Access tokens last 5 minutes and sessions expire after 30 idle minutes, so privileges that are removed or disabled take effect quickly.'),
  h2('5.4 Demonstrating different authorization privileges'),
  p('Each user signed in to the Student Portal. The dashboard shows the roles Keycloak put in the token and which features are allowed. Each user was then sent directly to a page for another role, and the portal refused with **403 Access denied**.'),
  table(['Page (required role)', 'admin01', 'lecturer01', 'student01'], [
    ['/admin (system-admin)', 'ALLOWED', 'DENIED 403', 'DENIED'],
    ['/lecturer/grades (lecturer)', 'DENIED 403', 'ALLOWED', 'DENIED 403'],
    ['/student/courses (student)', 'DENIED', 'DENIED', 'ALLOWED'],
  ], [3026, 2000, 2000, 2000]),
  ...figure('25a-dashboard-admin01.png', 'admin01 dashboard: role system-admin, only System Administration allowed'),
  ...figure('26-admin01-admin-granted.png', 'admin01 opens /admin: access granted'),
  ...figure('27-admin01-grades-denied.png', 'admin01 opens /lecturer/grades: 403, authenticated but not authorized'),
  ...figure('25b-dashboard-lecturer01.png', 'lecturer01 dashboard: role lecturer, only Grade Management allowed'),
  ...figure('28-lecturer01-grades-granted.png', 'lecturer01 opens /lecturer/grades: access granted'),
  ...figure('29-lecturer01-admin-denied.png', 'lecturer01 opens /admin: 403 denied'),
  ...figure('25c-dashboard-student01.png', 'student01 dashboard: role student, only My Courses allowed'),
  ...figure('30-student01-courses-granted.png', 'student01 opens /student/courses: access granted'),
  ...figure('31-student01-grades-denied.png', 'student01 opens /lecturer/grades: 403 denied'),

  // 6 ---------------------------------------------------------------
  h1('6. Client Configuration (Task 4)'),
  p('A **client** in Keycloak is an application that delegates login to Keycloak. I created the client under Clients → Create client:'),
  num('**General settings:** Client type **OpenID Connect**, Client ID `student-portal`, Name "Student Portal".', 'client'),
  num('**Capability config:** Client authentication **On** (confidential client), Standard flow **On**; Direct access grants, Implicit flow and Service accounts **Off**; PKCE required with method **S256**.', 'client'),
  num('**Login settings:** Root URL `http://localhost:3000`, Home URL `/`, Valid redirect URIs `http://localhost:3000/callback`, Valid post-logout redirect URIs `http://localhost:3000/`, Web origins `http://localhost:3000`.', 'client'),
  num('**Credentials tab:** copy the generated client secret into the application\'s `.env` file. The secret is never committed to source control.', 'client'),
  h2('6.1 Authentication protocol: OpenID Connect'),
  p('OIDC is an identity layer on top of OAuth 2.0. After login the application receives a signed **ID token** (a JWT) that proves who the user is, and an **access token** that carries the user\'s roles. I chose the **Authorization Code flow with PKCE** because it is the current best practice (OAuth 2.0 Security BCP / RFC 9700):'),
  bullet('the browser only ever sees a short-lived, one-time code, never the tokens;'),
  bullet('the code is exchanged server-to-server using the client secret **and** the PKCE code_verifier, so an intercepted code is useless;'),
  bullet('`state` protects against CSRF and `nonce` protects against ID-token replay;'),
  bullet('the application checks the token signature against Keycloak\'s published JWKS keys.'),
  h2('6.2 Redirect / allowed URLs'),
  p('Redirect URIs are an **exact match with no wildcards**. Keycloak will only return an authorization code to `http://localhost:3000/callback`. This stops an attacker from building a login link that sends the code to their own site (open redirect / code theft). Web origins restricts cross-origin requests to the portal\'s origin, and the post-logout URI restricts where users land after signing out.'),
  ...figure('18-clients-list.png', 'Clients list showing student-portal (OpenID Connect)'),
  ...figure('19a-client-settings-access.png', 'student-portal general and access settings: exact redirect URI, post-logout URI and web origin'),
  ...figure('19b-client-settings-capability.png', 'Capability config: client authentication On, Standard flow only, PKCE S256 required'),
  ...figure('20-client-credentials.png', 'Credentials tab: Client Id and Secret authentication (secret masked)'),
  ...figure('22-oidc-discovery.png', 'OIDC discovery document of UniversityRealm (issuer, endpoints, PKCE S256 support)'),

  // 7 ---------------------------------------------------------------
  h1('7. Authentication Demonstration (Task 4)'),
  p('The flow below, **User → Application → Keycloak → Login → Authentication → Application Access**, was carried out with the Student Portal:'),
  ...figure('sequence.png', 'OIDC Authorization Code + PKCE sequence as implemented', { dir: DIAG, maxH: 460 }),
  num('**User → Application:** the user opens `http://localhost:3000` and clicks "Log in with University SSO".', 'demo'),
  num('**Application → Keycloak:** the portal redirects the browser to the UniversityRealm authorization endpoint with client_id, redirect_uri, PKCE code_challenge, state and nonce.', 'demo'),
  num('**Login:** Keycloak shows its own login page, branded "University Identity Service". The password is typed only into Keycloak.', 'demo'),
  num('**Authentication:** Keycloak checks the password hash, whether the account is enabled, and the brute-force counters. It then sends the browser back to `/callback` with a one-time code.', 'demo'),
  num('**Token exchange:** the portal swaps the code, client secret and code_verifier for signed ID and access tokens, and validates the ID token.', 'demo'),
  num('**Application access:** the portal creates its session and shows the dashboard with the user\'s identity and roles.', 'demo'),
  ...figure('23-portal-landing.png', 'Step 1: Student Portal landing page (not signed in)'),
  ...figure('24-keycloak-login-page.png', 'Step 3: redirected to the Keycloak login page for UniversityRealm'),
  ...figure('25a-dashboard-admin01.png', 'Step 6: successful authentication, identity claims issued by Keycloak shown in the application'),
  ...figure('32-student01-access-token.png', 'Decoded access token: issuer UniversityRealm, azp student-portal, realm_access.roles = [student, …]'),
  ...figure('33-active-sessions.png', 'Keycloak Sessions: active SSO sessions of the three users for student-portal'),
  ...figure('34-client-sessions.png', 'Client → Sessions for student-portal'),
  ...figure('42-login-events.png', 'Realm Events: LOGIN, CODE_TO_TOKEN, LOGOUT and LOGIN_ERROR (wrong password, disabled user) recorded'),
  h3('Negative tests'),
  ...figure('36-invalid-password.png', 'Wrong password: "Invalid username or password." (counted by brute-force detection)'),
  ...figure('35-after-logout.png', 'After logout: the portal session and the Keycloak SSO session are ended (RP-initiated logout)'),
  h2('7.3 Authentication vs authorization in this implementation'),
  table(['', 'Authentication', 'Authorization'], [
    ['Question answered', 'Who are you?', 'What are you allowed to do?'],
    ['Performed by', 'Keycloak (UniversityRealm)', 'Student Portal (requireRole) using roles issued by Keycloak'],
    ['Inputs', 'Username + password, account enabled, brute-force state', 'realm_access.roles claim in the access token'],
    ['Output', 'Signed ID token (sub, preferred_username, email)', 'Allow the page, or HTTP 403 Access denied'],
    ['Failure example', `Wrong password / disabled account: Keycloak refuses login (${F('36-invalid-password')}, ${F('40-disabled-login-rejected')})`, `student01 is logged in but gets 403 on /lecturer/grades (${F('31-student01-grades-denied')})`],
  ], [2000, 3513, 3513]),
  p('Put simply: **authentication proves identity once, at Keycloak. Authorization is checked on every request, in the application, using roles managed centrally in Keycloak.** A user can be fully authenticated and still not be authorized, as the 403 pages show.'),

  // 8 ---------------------------------------------------------------
  h1('8. IAM Architecture Diagram (Task 5A)'),
  ...figure('architecture.png', 'Identity Management Architecture: Users → Application (student-portal) → Keycloak (UniversityRealm)', { dir: DIAG, maxH: 420 }),
  bullet('**Users** (Administrator, Lecturer, Student) use only a web browser. Their credentials go only to Keycloak.'),
  bullet('**Application (student-portal)** is an OIDC Relying Party. It redirects users for login, receives tokens over a back channel, and enforces role-based authorization per page.'),
  bullet('**Keycloak** is the central Identity Provider. The master realm is for administering Keycloak. UniversityRealm holds the users, roles, client, security policies and audit events.'),

  // 9 ---------------------------------------------------------------
  h1('9. Security Analysis (Task 5B)'),
  h2('Risk 1: Weak, reused or stolen passwords (credential compromise)'),
  p('**Risk.** When every application manages its own passwords, users reuse weak passwords across systems. A leak in one system allows credential-stuffing and brute-force attacks on the others. Passwords typed into many applications can also be logged or stolen by any one of them.'),
  p('**How Keycloak mitigates it (as configured):**'),
  bullet('**Single sign-on:** the password is entered only on Keycloak\'s login page. The portal never receives or stores it.'),
  bullet('**Password policy:** at least 10 characters with mixed classes, must not equal the username, and history of 3. Passwords are stored as salted hashes.'),
  bullet('**Brute-force detection:** after 5 failures the account is temporarily locked, with the wait growing to 15 minutes. Failures are recorded as LOGIN_ERROR events.'),
  bullet('Keycloak can require **MFA** (OTP or WebAuthn) and supports **passkeys**, so a stolen password alone is not enough (see Recommendation 1).'),
  h2('Risk 2: Excessive privileges and orphaned accounts (privilege creep)'),
  p('**Risk.** Without central control, people pick up permissions as they change roles, and accounts of leavers stay active in some systems. An attacker or a former insider can then reach grades, personal data or admin functions they should not have. This is a common cause of data breaches and audit findings.'),
  p('**How Keycloak mitigates it (as configured):**'),
  bullet('**Central RBAC:** roles are defined once in UniversityRealm and each user has exactly one role. "Users in role" gives an instant access review.'),
  bullet(`**One switch to revoke:** disabling an account in Keycloak blocks login to **every** connected application at once (${F('40-disabled-login-rejected')}). Short token lifetimes make the change take effect within minutes.`),
  bullet('**Separation of duties:** the application administrator (admin01) cannot administer the IdP.'),
  bullet('**Audit trail:** login and admin events record who did what and when, for accountability and investigations.'),

  // 10 --------------------------------------------------------------
  h1('10. Recommendations (Task 5C)'),
  h2('Recommendation 1: Enforce Multi-Factor Authentication (MFA), starting with privileged roles'),
  p('Turn on OTP (authenticator app) or WebAuthn/passkeys in UniversityRealm. Make it **mandatory for system-admin and lecturer** using a conditional authentication flow based on role, and optional for students. Also require MFA for the master-realm `iamadmin` account. MFA stops most credential-stuffing and phishing attacks that a password policy alone cannot. Roll it out in stages: staff first, with communication and helpdesk procedures for lost devices (recovery codes).'),
  h2('Recommendation 2: Harden the production deployment and connect Keycloak to the authoritative directory'),
  bullet('Run Keycloak in **production mode** (`kc.sh start`) behind HTTPS with a valid TLS certificate. Set `sslRequired=all`, use a proper hostname, and use a PostgreSQL database with backups instead of the dev-mode H2 database. Use at least two nodes for availability.'),
  bullet('Configure **User Federation with LDAP / Active Directory** so accounts are created and disabled automatically from HR and admissions records (joiner/mover/leaver). This removes orphaned accounts.'),
  bullet('Send Keycloak login and admin events to the university **SIEM**, alert on repeated LOGIN_ERROR events and lockouts, and run **quarterly access reviews** of role membership.'),
  bullet('Rotate client secrets regularly, or move confidential clients to `private_key_jwt`. Keep Keycloak patched against published CVEs.'),

  // 11 --------------------------------------------------------------
  h1('11. Conclusion'),
  p('Keycloak 26.7.4 was installed and made the university\'s central Identity Provider. A dedicated realm, **UniversityRealm**, holds three users with full attributes. Each user has one of three realm roles, following least privilege. The **student-portal** application was registered as a confidential OpenID Connect client using the Authorization Code flow with PKCE and strict redirect URIs.'),
  p('The demonstration showed the complete flow, User → Application → Keycloak → Login → Authentication → Application Access. It also showed the difference between authentication and authorization: every user signed in successfully, but each could only open the part of the portal their role allows. Disabling an account blocked access immediately, and failed logins were recorded and rate-limited.'),
  p('Centralising identity in Keycloak gives the institution one place to manage, audit and revoke access. Adding MFA, production hardening and directory federation would make this lab setup ready for production.'),

  // 12 --------------------------------------------------------------
  h1('12. References'),
  ...[
    'Keycloak Project (2026). Keycloak Server Administration Guide. https://www.keycloak.org/docs/latest/server_admin/',
    'Keycloak Project (2026). Getting started: OpenJDK / bare metal, and Configuring Keycloak for production. https://www.keycloak.org/guides',
    'Keycloak Project (2026). Securing Applications and Services Guide (OIDC clients). https://www.keycloak.org/docs/latest/securing_apps/',
    'Sakimura, N. et al. (2014). OpenID Connect Core 1.0. OpenID Foundation. https://openid.net/specs/openid-connect-core-1_0.html',
    'Hardt, D. (2012). RFC 6749: The OAuth 2.0 Authorization Framework. IETF.',
    'Sakimura, N., Bradley, J. and Agarwal, N. (2015). RFC 7636: Proof Key for Code Exchange (PKCE). IETF.',
    'Lodderstedt, T. et al. (2025). RFC 9700: Best Current Practice for OAuth 2.0 Security. IETF.',
    'Grassi, P. A. et al. (2017, rev.). NIST SP 800-63B: Digital Identity Guidelines, Authentication and Lifecycle Management. NIST.',
    'NIST (2020). SP 800-53 Rev. 5: Security and Privacy Controls, AC-2 Account Management, AC-6 Least Privilege. NIST.',
    'OWASP Foundation (2021). OWASP Top 10: A01 Broken Access Control; A07 Identification and Authentication Failures.',
  ].map((r) => new Paragraph({ numbering: { reference: 'refs', level: 0 }, spacing: { after: 80 }, children: [new TextRun({ text: r, size: 21 })] })),

  // Appendix -----------------------------------------------------------
  h1('Appendix A: Reproducing the Configuration'),
  p('The whole lab can be rebuilt from the project folder `ISM-Keycloak-Assignment/`:'),
  ...code([
    '# 1. start Keycloak (see section 2.2)',
    'KC_BOOTSTRAP_ADMIN_USERNAME=temp-admin KC_BOOTSTRAP_ADMIN_PASSWORD=TempAdmin#2026 \\',
    '  $KC_HOME/bin/kc.sh start-dev --http-port=8080',
    '',
    '# 2. create iamadmin, UniversityRealm, roles, users, client (idempotent)',
    'KC_HOME=/opt/keycloak-26.7.4 ./keycloak/setup-realm.sh',
    '',
    '# 3. run the test application',
    'cd student-portal && cp .env.example .env   # paste client secret',
    'npm install && npm start                     # http://localhost:3000',
  ]),
  p('`keycloak/UniversityRealm-realm-export.json` contains a partial export of the realm (roles, client and policies, with secrets masked). It can be imported through Manage realms → Create realm → Resource file.'),
  h2('Appendix B: Marking-scheme cross-reference'),
  table(['Requirement', 'Marks', 'Evidence'], [
    ['Install & start; admin account', '2', `§2.2, ${F('02-admin-console-login', '06-master-admin-role')}`],
    ['Version, OS, environment', '1', `§2.1, ${F('01-environment-terminal')}, ${F('04-server-info-version')}`],
    ['Screenshots of installation / console', '2', F('01-environment-terminal', '06-master-admin-role')],
    ['Create realm', '2', `§3.1, ${F('07-realm-list', '08-realm-settings-general')}`],
    ['Create three users', '3', `§4, ${F('09-users-list', '10-user-student01-details')}`],
    ['User attributes incl. password', '1', `§4 table, ${F('10-user-admin01-details', '11-user-student01-credentials')}`],
    ['Enable/disable + when', '1', `§4.1, ${F('37-disable-confirm', '41-student01-re-enabled')}`],
    ['Screenshots realm & users', '1', F('07-realm-list', '41-student01-re-enabled')],
    ['Create three roles', '3', `§5.1, ${F('14-realm-roles-list', '15-role-student-details')}`],
    ['Assign roles', '2', `§5.2, ${F('17-role-mapping-admin01', '16-role-student-users')}`],
    ['Least privilege explained', '1', '§5.3'],
    ['Different privileges demonstrated', '2', `§5.4, ${F('25a-dashboard-admin01', '31-student01-grades-denied')}`],
    ['Create client', '3', `§6, ${F('18-clients-list')}`],
    ['OIDC protocol configured', '3', `§6.1, ${F('19b-client-settings-capability', '22-oidc-discovery')}`],
    ['Redirect / allowed URLs', '2', `§6.2, ${F('19a-client-settings-access')}`],
    ['Authentication demonstrated', '3', `§7, ${F('sequence', '35-after-logout')}`],
    ['Authentication vs authorization', '2', '§7.3'],
    ['Architecture diagram', '2', `§8, ${F('architecture')}`],
    ['Two risks + mitigation', '2', '§9'],
    ['Two recommendations', '2', '§10'],
  ], [4300, 900, 3826]),
];

// ------------------------------------------------------------------ document
const doc = new Document({
  creator: STUDENT_NAME,
  title: 'ISM Practical: Identity Management using Keycloak',
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, font: FONT, color: BRAND }, paragraph: { spacing: { before: 240, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: FONT, color: '1E293B' }, paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 23, bold: true, font: FONT, color: '334155' }, paragraph: { spacing: { before: 180, after: 100 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }, { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 1440, hanging: 360 } } } }] },
      ...['steps', 'client', 'demo', 'refs'].map((reference) => ({ reference, levels: [{ level: 0, format: LevelFormat.DECIMAL,
        text: reference === 'refs' ? '[%1]' : '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 400 } } } }] })),
    ],
  },
  sections: [
    { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: buildCover() },
    { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: 'ISM Practical: Identity Management using Keycloak', size: 16, color: '64748B' })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Page ', size: 18, color: '64748B' }), new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '64748B' })] })] }) },
      children: body },
  ],
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  fs.writeFileSync(path.join(__dirname, '.headings.json'), JSON.stringify(HEADINGS));
  console.log(`wrote ${OUT} (${(buf.length / 1024 / 1024).toFixed(1)} MB, ${figNo} figures)`);
});
