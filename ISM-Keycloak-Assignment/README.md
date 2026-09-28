# ISM Practical — Identity Management using Keycloak

Take-home assessment (40 marks): centralised IAM for a university with **Keycloak 26.7.4**.
Realm `UniversityRealm`, users `admin01` / `lecturer01` / `student01`, RBAC roles
`system-admin` / `lecturer` / `student`, and the OIDC client `student-portal` with a working demo app.

## Deliverables

| What | Where |
|------|-------|
| **Final report (submit this)** | [`report/ISM_Keycloak_Practical_Report.docx`](report/ISM_Keycloak_Practical_Report.docx) · [`.pdf`](report/ISM_Keycloak_Practical_Report.pdf) |
| Design document | [`docs/01-DESIGN.md`](docs/01-DESIGN.md) |
| Implementation plan | [`docs/02-PLAN.md`](docs/02-PLAN.md) |
| Architecture + sequence diagrams | [`docs/diagrams/`](docs/diagrams) |
| Keycloak provisioning script | [`keycloak/setup-realm.sh`](keycloak/setup-realm.sh) |
| Realm export (secrets masked) | [`keycloak/UniversityRealm-realm-export.json`](keycloak/UniversityRealm-realm-export.json) |
| Demo application (OIDC client) | [`student-portal/`](student-portal) |
| Evidence (52 screenshots + environment log) | [`evidence/`](evidence) |

> **Before submitting:** put your name, registration number, programme, lecturer and date on the cover page.
> Either edit the .docx directly, or rebuild it:
> `STUDENT_NAME="…" STUDENT_REG="…" PROGRAMME="…" LECTURER="…" SUBMIT_DATE="…" ./scripts/build-report.sh`

## Reproduce everything on your own VM (≈10 minutes)

Prerequisites: Ubuntu 22.04/24.04, OpenJDK 21, Node.js ≥ 18.

```bash
# 1. Install & start Keycloak (Task 1)
curl -LO https://repo1.maven.org/maven2/org/keycloak/keycloak-quarkus-dist/26.7.4/keycloak-quarkus-dist-26.7.4.tar.gz
tar xzf keycloak-quarkus-dist-26.7.4.tar.gz
export KC_HOME=$PWD/keycloak-26.7.4
KC_BOOTSTRAP_ADMIN_USERNAME=temp-admin KC_BOOTSTRAP_ADMIN_PASSWORD='TempAdmin#2026' \
  $KC_HOME/bin/kc.sh start-dev --http-port=8080 &

# 2. Configure admin account, realm, roles, users and client (Tasks 1-4) — prints the client secret
./keycloak/setup-realm.sh

# 3. Run the test application
cd student-portal
cp .env.example .env        # paste KC_CLIENT_SECRET from step 2
npm install && npm start    # http://localhost:3000
```

Credentials in the lab: Keycloak admin `iamadmin` / `IamAdmin#2026`; the three realm users use
`Passw0rd#2026`. These are **lab-only** values, so change them (env vars in `setup-realm.sh`) on any shared machine.

### Regenerate the evidence and the report (optional)

```bash
npm i -g playwright                                   # uses Chromium
NPM_ROOT=$(npm root -g) node scripts/capture-evidence.mjs
NPM_ROOT=$(npm root -g) node scripts/render-diagrams.mjs
cd scripts && npm install && ./build-report.sh        # needs LibreOffice Writer + pip install pymupdf
```

You can also follow the report's click-by-click steps in the Admin Console and take your own screenshots.
The script just automates the same configuration.

## Demo accounts and expected results

| User | Role | /admin | /lecturer/grades | /student/courses |
|------|------|--------|------------------|------------------|
| admin01 | system-admin | ✅ | 403 | 403 |
| lecturer01 | lecturer | 403 | ✅ | 403 |
| student01 | student | 403 | 403 | ✅ |
