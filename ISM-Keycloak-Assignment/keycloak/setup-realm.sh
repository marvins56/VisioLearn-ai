#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# UniversityRealm provisioning script (Tasks 1-4 of the ISM Keycloak assessment)
#
# Idempotent-ish, reproducible configuration of Keycloak using the official
# admin CLI (kcadm.sh). Everything done here can also be done by hand in the
# Administration Console - the report shows the console screenshots.
#
# Usage:
#   KC_HOME=/opt/keycloak-26.7.4 ./setup-realm.sh
#
# Environment variables (all optional, defaults shown):
#   KC_HOME            Keycloak install directory
#   KC_URL             http://localhost:8080
#   BOOTSTRAP_USER     temp-admin        (temporary admin created at first boot)
#   BOOTSTRAP_PASS     TempAdmin#2026
#   PERM_ADMIN_USER    iamadmin          (permanent master-realm administrator)
#   PERM_ADMIN_PASS    IamAdmin#2026
#   PORTAL_URL         http://localhost:3000
#   DEMO_PASSWORD      Passw0rd#2026     (initial password for the 3 users)
# -----------------------------------------------------------------------------
set -euo pipefail

KC_HOME="${KC_HOME:-/opt/keycloak}"
KC_URL="${KC_URL:-http://localhost:8080}"
BOOTSTRAP_USER="${BOOTSTRAP_USER:-temp-admin}"
BOOTSTRAP_PASS="${BOOTSTRAP_PASS:-TempAdmin#2026}"
PERM_ADMIN_USER="${PERM_ADMIN_USER:-iamadmin}"
PERM_ADMIN_PASS="${PERM_ADMIN_PASS:-IamAdmin#2026}"
PORTAL_URL="${PORTAL_URL:-http://localhost:3000}"
DEMO_PASSWORD="${DEMO_PASSWORD:-Passw0rd#2026}"
REALM="UniversityRealm"
CLIENT_ID="student-portal"

KCADM="$KC_HOME/bin/kcadm.sh"
export KCADM_CONFIG="${KCADM_CONFIG:-$HOME/.keycloak/kcadm-university.config}"

log() { printf '\n==> %s\n' "$*"; }

# ---------------------------------------------------------------------------
# TASK 1 - administrative account
# The bootstrap admin is temporary by design; create a permanent, named
# administrator in the master realm.
# ---------------------------------------------------------------------------
log "Logging in to master realm as bootstrap admin ($BOOTSTRAP_USER)"
if ! "$KCADM" config credentials --server "$KC_URL" --realm master \
      --user "$BOOTSTRAP_USER" --password "$BOOTSTRAP_PASS" 2>/dev/null; then
  log "Bootstrap admin not available - trying permanent admin"
  "$KCADM" config credentials --server "$KC_URL" --realm master \
      --user "$PERM_ADMIN_USER" --password "$PERM_ADMIN_PASS"
fi

if [ -z "$("$KCADM" get users -r master -q username="$PERM_ADMIN_USER" -q exact=true --fields id --format csv --noquotes)" ]; then
  log "Creating permanent administrator '$PERM_ADMIN_USER' in master realm"
  "$KCADM" create users -r master -s username="$PERM_ADMIN_USER" -s enabled=true \
      -s email="iamadmin@university.local" -s emailVerified=true \
      -s firstName=IAM -s lastName=Administrator
  "$KCADM" set-password -r master --username "$PERM_ADMIN_USER" --new-password "$PERM_ADMIN_PASS"
  "$KCADM" add-roles -r master --uusername "$PERM_ADMIN_USER" --rolename admin
fi

# Switch to the permanent admin and remove the temporary bootstrap account
# (Keycloak flags it as "temporary" in the console until it is removed).
"$KCADM" config credentials --server "$KC_URL" --realm master \
    --user "$PERM_ADMIN_USER" --password "$PERM_ADMIN_PASS"
TEMP_ID="$("$KCADM" get users -r master -q username="$BOOTSTRAP_USER" -q exact=true --fields id --format csv --noquotes)"
if [ -n "$TEMP_ID" ]; then
  log "Deleting temporary bootstrap admin '$BOOTSTRAP_USER'"
  "$KCADM" delete "users/$TEMP_ID" -r master
fi

# ---------------------------------------------------------------------------
# TASK 2 - realm
# ---------------------------------------------------------------------------
if ! "$KCADM" get "realms/$REALM" >/dev/null 2>&1; then
  log "Creating realm $REALM"
  "$KCADM" create realms \
    -s realm="$REALM" \
    -s enabled=true \
    -s displayName="University Identity Service" \
    -s sslRequired=external \
    -s registrationAllowed=false \
    -s loginWithEmailAllowed=true \
    -s duplicateEmailsAllowed=false \
    -s resetPasswordAllowed=true \
    -s bruteForceProtected=true \
    -s permanentLockout=false \
    -s failureFactor=5 \
    -s waitIncrementSeconds=60 \
    -s maxFailureWaitSeconds=900 \
    -s 'passwordPolicy="length(10) and upperCase(1) and lowerCase(1) and digits(1) and specialChars(1) and notUsername and passwordHistory(3)"' \
    -s accessTokenLifespan=300 \
    -s ssoSessionIdleTimeout=1800 \
    -s ssoSessionMaxLifespan=36000 \
    -s eventsEnabled=true \
    -s 'enabledEventTypes=["LOGIN","LOGIN_ERROR","LOGOUT","CODE_TO_TOKEN","CODE_TO_TOKEN_ERROR","UPDATE_PASSWORD"]' \
    -s eventsExpiration=2592000 \
    -s adminEventsEnabled=true \
    -s adminEventsDetailsEnabled=true
else
  log "Realm $REALM already exists - skipping"
fi

# ---------------------------------------------------------------------------
# TASK 3 - realm roles
# ---------------------------------------------------------------------------
create_role() {
  local name="$1" desc="$2"
  if ! "$KCADM" get "roles/$name" -r "$REALM" >/dev/null 2>&1; then
    log "Creating realm role $name"
    "$KCADM" create roles -r "$REALM" -s name="$name" -s "description=$desc"
  fi
}
create_role system-admin "Institution system administrator - manages the student-portal application (NOT the Keycloak server)"
create_role lecturer     "Teaching staff - manage course content and grades for own courses"
create_role student      "Enrolled student - view own courses and results"

# ---------------------------------------------------------------------------
# TASK 2 - users (username, email, first/last name, password)
# ---------------------------------------------------------------------------
create_user() {
  local username="$1" first="$2" last="$3" email="$4" role="$5"
  if [ -z "$("$KCADM" get users -r "$REALM" -q username="$username" -q exact=true --fields id --format csv --noquotes)" ]; then
    log "Creating user $username"
    "$KCADM" create users -r "$REALM" \
      -s username="$username" -s enabled=true \
      -s firstName="$first" -s lastName="$last" \
      -s email="$email" -s emailVerified=true
    "$KCADM" set-password -r "$REALM" --username "$username" --new-password "$DEMO_PASSWORD"
  fi
  log "Assigning role $role to $username"
  "$KCADM" add-roles -r "$REALM" --uusername "$username" --rolename "$role"
}
create_user admin01    Alice   Admin    admin01@university.local    system-admin
create_user lecturer01 Leonard Lecturer lecturer01@university.local lecturer
create_user student01  Stella  Student  student01@university.local  student

# ---------------------------------------------------------------------------
# TASK 4 - OIDC client
# ---------------------------------------------------------------------------
if [ -z "$("$KCADM" get clients -r "$REALM" -q clientId="$CLIENT_ID" --fields id --format csv --noquotes)" ]; then
  log "Creating OIDC client $CLIENT_ID"
  "$KCADM" create clients -r "$REALM" \
    -s clientId="$CLIENT_ID" \
    -s name="Student Portal" \
    -s description="Institutional web portal for students, lecturers and administrators" \
    -s protocol=openid-connect \
    -s enabled=true \
    -s publicClient=false \
    -s clientAuthenticatorType=client-secret \
    -s standardFlowEnabled=true \
    -s implicitFlowEnabled=false \
    -s directAccessGrantsEnabled=false \
    -s serviceAccountsEnabled=false \
    -s rootUrl="$PORTAL_URL" \
    -s baseUrl="/" \
    -s "redirectUris=[\"$PORTAL_URL/callback\"]" \
    -s "webOrigins=[\"$PORTAL_URL\"]" \
    -s 'attributes."post.logout.redirect.uris"='"$PORTAL_URL/" \
    -s 'attributes."pkce.code.challenge.method"=S256' \
    -s frontchannelLogout=true \
    -s fullScopeAllowed=true
fi

CID="$("$KCADM" get clients -r "$REALM" -q clientId="$CLIENT_ID" --fields id --format csv --noquotes)"
SECRET="$("$KCADM" get "clients/$CID/client-secret" -r "$REALM" --fields value --format csv --noquotes)"

log "Done."
cat <<EOF

  Realm        : $REALM
  Issuer       : $KC_URL/realms/$REALM
  Client ID    : $CLIENT_ID
  Client secret: $SECRET
  Redirect URI : $PORTAL_URL/callback

  Put the secret in student-portal/.env as KC_CLIENT_SECRET=...
EOF
