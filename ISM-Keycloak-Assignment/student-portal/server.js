/*
 * Student Portal - demo institutional application protected by Keycloak.
 *
 *   Authentication : OpenID Connect Authorization Code flow + PKCE (S256)
 *                    against realm "UniversityRealm", client "student-portal".
 *   Authorization  : realm roles (system-admin | lecturer | student) read from
 *                    the access token's realm_access.roles claim and enforced
 *                    per route by requireRole().
 *
 * Flow demonstrated:  User -> Application -> Keycloak -> Login ->
 *                     Authentication -> Application Access
 */
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const { Issuer, generators } = require('openid-client');

const {
  PORT = 3000,
  APP_URL = `http://localhost:${PORT}`,
  KC_ISSUER = 'http://localhost:8080/realms/UniversityRealm',
  KC_CLIENT_ID = 'student-portal',
  KC_CLIENT_SECRET,
  SESSION_SECRET = generators.random(32),
} = process.env;

if (!KC_CLIENT_SECRET) {
  console.error('KC_CLIENT_SECRET is not set - copy .env.example to .env and fill it in.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Authorization model: which role may open which feature of the portal.
// Each user gets exactly one role (least privilege); nothing is inherited.
// ---------------------------------------------------------------------------
const FEATURES = [
  { path: '/admin',            title: 'System Administration', role: 'system-admin',
    desc: 'Manage portal configuration, audit logs and service accounts.' },
  { path: '/lecturer/grades',  title: 'Grade Management',      role: 'lecturer',
    desc: 'Enter and publish marks for the courses you teach.' },
  { path: '/student/courses',  title: 'My Courses & Results',  role: 'student',
    desc: 'View your registered courses, timetable and released results.' },
];

const app = express();
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: APP_URL.startsWith('https://') },
}));

let client;

// --------------------------------------------------------------------------- helpers
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const decodeJwt = (jwt) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());

const rolesOf = (req) => {
  const at = req.session.tokens?.access_token;
  if (!at) return [];
  return (decodeJwt(at).realm_access?.roles || [])
    .filter((r) => FEATURES.some((f) => f.role === r));
};

function requireAuth(req, res, next) {
  if (!req.session.user) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => requireAuth(req, res, () => {
    if (rolesOf(req).includes(role)) return next();
    res.status(403).send(page('Access denied', `
      <div class="card deny">
        <h2>403 &mdash; Access denied</h2>
        <p>You are <b>authenticated</b> as <code>${esc(req.session.user.preferred_username)}</code>,
           but you are <b>not authorized</b> to open <code>${esc(req.originalUrl)}</code>.</p>
        <p>Required role: <span class="pill">${esc(role)}</span>
           &nbsp; Your roles: ${rolesOf(req).map((r) => `<span class="pill">${esc(r)}</span>`).join(' ') || '<i>none</i>'}</p>
        <p><a class="btn" href="/dashboard">Back to dashboard</a></p>
      </div>`, req));
  });
}

function page(title, body, req) {
  const u = req?.session?.user;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Student Portal</title>
<style>
  :root { --bg:#f4f6fb; --fg:#1d2433; --muted:#5b6475; --card:#fff; --line:#dde2ec;
          --brand:#1f4e8c; --ok:#1e7b4a; --okbg:#e5f4ec; --no:#a8321f; --nobg:#fbe9e6; }
  * { box-sizing:border-box } body { margin:0; font:15px/1.5 system-ui,Segoe UI,Roboto,sans-serif; background:var(--bg); color:var(--fg) }
  header { background:var(--brand); color:#fff; padding:14px 24px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap }
  header a { color:#fff } header .brand { font-weight:700; font-size:18px; text-decoration:none }
  main { max-width:960px; margin:24px auto; padding:0 16px }
  .card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:20px 24px; margin-bottom:18px }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:14px }
  .tile { border:1px solid var(--line); border-radius:10px; padding:16px; background:#fff }
  .tile.allow { border-left:6px solid var(--ok) } .tile.deny { border-left:6px solid var(--no); opacity:.8 }
  .tag { display:inline-block; font-size:12px; font-weight:600; padding:2px 8px; border-radius:99px }
  .tag.allow { background:var(--okbg); color:var(--ok) } .tag.deny { background:var(--nobg); color:var(--no) }
  .pill { display:inline-block; background:#e8eef8; color:var(--brand); padding:2px 10px; border-radius:99px; font-weight:600; font-size:13px }
  .deny h2 { color:var(--no) } .ok h2 { color:var(--ok) }
  table { border-collapse:collapse; width:100% } td,th { text-align:left; padding:6px 8px; border-bottom:1px solid var(--line); vertical-align:top }
  th { color:var(--muted); font-weight:600; width:190px }
  .btn { display:inline-block; background:var(--brand); color:#fff; padding:9px 18px; border-radius:8px; text-decoration:none; font-weight:600 }
  .btn.secondary { background:#fff; color:var(--brand); border:1px solid var(--brand) }
  pre { background:#0f172a; color:#e2e8f0; padding:14px; border-radius:8px; overflow:auto; font-size:12.5px }
  .muted { color:var(--muted) } code { font-size:13px }
</style></head><body>
<header>
  <a class="brand" href="/">🎓 University Student Portal</a>
  <span>${u ? `Signed in as <b>${esc(u.preferred_username)}</b> &nbsp;·&nbsp; <a href="/token">Token</a> &nbsp;·&nbsp; <a href="/logout">Log out</a>`
            : '<a href="/login">Log in</a>'}</span>
</header>
<main>${body}</main></body></html>`;
}

// --------------------------------------------------------------------------- routes
app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.send(page('Welcome', `
    <div class="card">
      <h1>Welcome to the Student Portal</h1>
      <p>This application does <b>not</b> store any passwords. Sign-in is delegated to the
         institution's central Identity Provider (<b>Keycloak</b>, realm <code>UniversityRealm</code>)
         using <b>OpenID Connect</b>.</p>
      <p><a class="btn" href="/login">Log in with University SSO</a></p>
    </div>
    <div class="card muted"><b>Flow:</b> User &rarr; Student Portal &rarr; Keycloak &rarr; Login &rarr;
      Authentication &rarr; back to Student Portal with an authorization code &rarr; tokens &rarr; Application Access</div>`, req));
});

// Step 1: redirect the browser to Keycloak's authorization endpoint.
app.get('/login', (req, res) => {
  const code_verifier = generators.codeVerifier();
  const state = generators.state();
  const nonce = generators.nonce();
  req.session.oidc = { code_verifier, state, nonce };
  res.redirect(client.authorizationUrl({
    scope: 'openid profile email',
    code_challenge: generators.codeChallenge(code_verifier),
    code_challenge_method: 'S256',
    state,
    nonce,
  }));
});

// Step 2: Keycloak redirects back with ?code=...; exchange it for tokens
// (back-channel, authenticated with the client secret) and validate the ID token.
app.get('/callback', async (req, res, next) => {
  try {
    const params = client.callbackParams(req);
    if (params.error) {
      return res.status(401).send(page('Login failed', `<div class="card deny"><h2>Login failed</h2>
        <p><code>${esc(params.error)}</code>: ${esc(params.error_description)}</p>
        <p><a class="btn" href="/">Home</a></p></div>`, req));
    }
    const { code_verifier, state, nonce } = req.session.oidc || {};
    const tokenSet = await client.callback(`${APP_URL}/callback`, params, { code_verifier, state, nonce });
    const returnTo = req.session.returnTo || '/dashboard';
    req.session.regenerate((err) => {          // new session id after login (anti session-fixation)
      if (err) return next(err);
      req.session.tokens = {
        id_token: tokenSet.id_token,
        access_token: tokenSet.access_token,
        expires_at: tokenSet.expires_at,
      };
      req.session.user = tokenSet.claims();
      res.redirect(returnTo);
    });
  } catch (e) { next(e); }
});

app.get('/dashboard', requireAuth, (req, res) => {
  const u = req.session.user;
  const roles = rolesOf(req);
  const tiles = FEATURES.map((f) => {
    const ok = roles.includes(f.role);
    return `<div class="tile ${ok ? 'allow' : 'deny'}">
      <span class="tag ${ok ? 'allow' : 'deny'}">${ok ? 'ALLOWED' : 'DENIED'}</span>
      <h3>${esc(f.title)}</h3><p class="muted">${esc(f.desc)}</p>
      <p>Requires <span class="pill">${esc(f.role)}</span></p>
      <a class="btn ${ok ? '' : 'secondary'}" href="${f.path}">Open</a></div>`;
  }).join('');
  res.send(page('Dashboard', `
    <div class="card ok">
      <h2>✅ Authenticated via Keycloak</h2>
      <table>
        <tr><th>Username</th><td><code>${esc(u.preferred_username)}</code></td></tr>
        <tr><th>Name</th><td>${esc(u.given_name)} ${esc(u.family_name)}</td></tr>
        <tr><th>Email</th><td>${esc(u.email)}</td></tr>
        <tr><th>Subject (sub)</th><td><code>${esc(u.sub)}</code></td></tr>
        <tr><th>Issuer</th><td><code>${esc(u.iss)}</code></td></tr>
        <tr><th>Realm roles (authorization)</th><td>${roles.map((r) => `<span class="pill">${esc(r)}</span>`).join(' ') || '<i>none</i>'}</td></tr>
      </table>
    </div>
    <h3>What you are authorized to do</h3>
    <div class="grid">${tiles}</div>`, req));
});

const protectedPage = (title, role, content) => (req, res) =>
  res.send(page(title, `<div class="card ok"><h2>✅ ${esc(title)}</h2>
    <p>Access granted because your token contains the realm role <span class="pill">${esc(role)}</span>.</p>
    ${content}<p><a class="btn" href="/dashboard">Back to dashboard</a></p></div>`, req));

app.get('/admin', requireRole('system-admin'), protectedPage('System Administration', 'system-admin', `
  <table><tr><th>Portal version</th><td>1.0.0</td></tr>
  <tr><th>Identity provider</th><td><code>${esc(KC_ISSUER)}</code></td></tr>
  <tr><th>Registered features</th><td>${FEATURES.length}</td></tr></table>`));

app.get('/lecturer/grades', requireRole('lecturer'), protectedPage('Grade Management', 'lecturer', `
  <table><tr><th>Course</th><th>Students</th><th>Status</th></tr>
  <tr><td>ISM 7101 Information Security Management</td><td>42</td><td>Draft marks</td></tr>
  <tr><td>ISM 7105 Identity &amp; Access Management</td><td>37</td><td>Published</td></tr></table>`));

app.get('/student/courses', requireRole('student'), protectedPage('My Courses & Results', 'student', `
  <table><tr><th>Course</th><th>Result</th></tr>
  <tr><td>ISM 7101 Information Security Management</td><td>Pending</td></tr>
  <tr><td>ISM 7105 Identity &amp; Access Management</td><td>A</td></tr></table>`));

// Evidence page: decoded token claims (signature/nonce already validated for the ID token).
app.get('/token', requireAuth, (req, res) => {
  const at = decodeJwt(req.session.tokens.access_token);
  const pick = ({ iss, aud, azp, sub, typ, exp, iat, preferred_username, email, realm_access, scope, session_state, sid }) =>
    ({ iss, aud, azp, typ, sub, preferred_username, email, realm_access, scope, sid: sid || session_state,
       iat: new Date(iat * 1000).toISOString(), exp: new Date(exp * 1000).toISOString() });
  res.send(page('Token', `<div class="card"><h2>Access token issued by Keycloak (decoded payload)</h2>
    <p class="muted">The <code>realm_access.roles</code> claim is what the portal uses for authorization decisions.</p>
    <pre>${esc(JSON.stringify(pick(at), null, 2))}</pre></div>`, req));
});

// RP-initiated logout: end the Keycloak SSO session too, not just the local one.
app.get('/logout', (req, res) => {
  const id_token_hint = req.session.tokens?.id_token;
  req.session.destroy(() => {
    res.redirect(id_token_hint
      ? client.endSessionUrl({ id_token_hint, post_logout_redirect_uri: `${APP_URL}/` })
      : '/');
  });
});

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).send(page('Error', `<div class="card deny"><h2>Error</h2><pre>${esc(err.message)}</pre>
    <p><a class="btn" href="/">Home</a></p></div>`, req));
});

// --------------------------------------------------------------------------- start
(async () => {
  const issuer = await Issuer.discover(KC_ISSUER);   // .well-known/openid-configuration
  client = new issuer.Client({
    client_id: KC_CLIENT_ID,
    client_secret: KC_CLIENT_SECRET,
    redirect_uris: [`${APP_URL}/callback`],
    post_logout_redirect_uris: [`${APP_URL}/`],
    response_types: ['code'],
  });
  app.listen(PORT, () => console.log(`Student Portal on ${APP_URL} (issuer ${issuer.issuer})`));
})().catch((e) => { console.error('Startup failed:', e.message); process.exit(1); });
