# Implementation Plan

The plan is in the order it was carried out. Each step lists its **output**, the **evidence** it produces
(screenshot files in `evidence/screenshots/`), and the **marks** it covers.

## Phase 0 — Preparation
| Step | Action | Output |
|------|--------|--------|
| 0.1 | Read the brief and map every mark to a deliverable | Goals table in `01-DESIGN.md` §2 |
| 0.2 | Pick the environment: Ubuntu 24.04 VM, OpenJDK 21, Keycloak 26.7.4 zip/tar | `evidence/environment.txt` |
| 0.3 | Design the realm, roles, client and app | `01-DESIGN.md` |

## Phase 1 — Task 1: Installation (5 marks)
| Step | Action | Evidence |
|------|--------|----------|
| 1.1 | Download `keycloak-26.7.4.tar.gz` and extract it | `01-environment-terminal` |
| 1.2 | Start it: `KC_BOOTSTRAP_ADMIN_USERNAME=temp-admin KC_BOOTSTRAP_ADMIN_PASSWORD=… bin/kc.sh start-dev` | `01` (startup log) |
| 1.3 | Open http://localhost:8080/admin | `02-admin-console-login`, `03-admin-console-home` |
| 1.4 | Record the version (Server info tab) | `04-server-info-version` |
| 1.5 | Create the permanent admin `iamadmin` with the `admin` role, then **delete the temporary admin** | `05-master-admin-account`, `06-master-admin-role` |

## Phase 2 — Task 2: Realm and users (8 marks)
| Step | Action | Evidence |
|------|--------|----------|
| 2.1 | Create realm `UniversityRealm` (display name *University Identity Service*) | `07-realm-list`, `08-realm-settings-general` |
| 2.2 | Harden it: password policy, brute force, no self-registration, events | `12-password-policy`, `13-brute-force-protection`, `42-login-events` |
| 2.3 | Create `admin01`, `lecturer01`, `student01` with username, email, first and last name | `09-users-list`, `10-user-*-details` |
| 2.4 | Set passwords (Credentials tab, not temporary) | `11-user-student01-credentials` |
| 2.5 | Disable `student01`, try to log in (rejected), then re-enable | `37`–`41` |

## Phase 3 — Task 3: RBAC (8 marks)
| Step | Action | Evidence |
|------|--------|----------|
| 3.1 | Create realm roles `system-admin`, `lecturer`, `student` with descriptions | `14-realm-roles-list`, `15-role-*-details` |
| 3.2 | Assign one role per user | `17-role-mapping-*`, `16-role-*-users` |
| 3.3 | Write up least privilege | Design §6, report §5.3 |
| 3.4 | Prove different privileges: each user opens every page | `25a/b/c-dashboard-*`, `26`–`31` |

## Phase 4 — Task 4: Client and authentication (13 marks)
| Step | Action | Evidence |
|------|--------|----------|
| 4.1 | Create client `student-portal`, OpenID Connect | `18-clients-list` |
| 4.2 | Turn on client authentication and standard flow only, with PKCE S256 | `19b-client-settings-capability`, `20-client-credentials`, `22-oidc-discovery` |
| 4.3 | Set the redirect URI, post-logout URI and web origin | `19a-client-settings-access` |
| 4.4 | Build the student-portal app (Node/Express/openid-client) | `student-portal/server.js` |
| 4.5 | Demo the User → App → Keycloak → Login → App flow | `23`, `24`, `25a`, `32`, `33`, `34`, `35` |
| 4.6 | Negative test: wrong password | `36-invalid-password` |
| 4.7 | Write up authentication vs authorization | Design §7, report §7.3 |

## Phase 5 — Task 5: Assessment report (6 marks)
| Step | Action | Output |
|------|--------|--------|
| 5.1 | Architecture diagram (Users → Application → Keycloak) | `docs/diagrams/architecture.png` |
| 5.2 | Two risks and how Keycloak mitigates them | report §9 |
| 5.3 | Two recommendations | report §10 |
| 5.4 | Put the report together in the required section order | `report/ISM_Keycloak_Practical_Report.docx` |

## Phase 6 — Quality checks
- [x] Re-run `setup-realm.sh`: it is idempotent and makes no duplicates
- [x] Every screenshot is checked by eye; client-secret values are masked
- [x] Every section the brief requires is in the report, in order
- [ ] **Student:** fill in name / registration number on the cover page
- [ ] **Student:** optionally re-run on your own VM so the screenshots show your machine (see README)

## Risks to the plan
| Risk | Mitigation |
|------|------------|
| Admin Console layout differs between Keycloak versions | Pin 26.7.4; the CLI script is the source of truth |
| The lab has no LDAP/AD | Documented as a recommendation; design allows adding User Federation later |
| Screenshots must be the student's own work | A reproducible script means the student can regenerate everything on their own VM |
