#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# LDAP user federation for UniversityRealm (evidence item "LDAP/AD configuration").
#
# Connects Keycloak to the institutional directory loaded by ldap/setup-ldap.sh:
#   - READ_ONLY provider "university-ldap" (directory stays the source of truth)
#   - users under ou=people, imported and periodically synchronised
#   - role-ldap-mapper: LDAP groups cn=lecturer / cn=student -> realm roles
#
# Usage:  KC_HOME=/opt/keycloak-26.7.4 ./setup-ldap-federation.sh
# Works the same against Active Directory by changing vendor/URL/DNs/attributes.
# -----------------------------------------------------------------------------
set -euo pipefail

KC_HOME="${KC_HOME:-/opt/keycloak}"
KC_URL="${KC_URL:-http://localhost:8080}"
PERM_ADMIN_USER="${PERM_ADMIN_USER:-iamadmin}"
PERM_ADMIN_PASS="${PERM_ADMIN_PASS:-IamAdmin#2026}"
LDAP_URL="${LDAP_URL:-ldap://127.0.0.1:389}"
LDAP_BIND_DN="${LDAP_BIND_DN:-cn=admin,dc=university,dc=local}"
LDAP_BIND_PASS="${LDAP_BIND_PASS:-LdapAdmin#2026}"
REALM="UniversityRealm"
PROVIDER="university-ldap"

KCADM="$KC_HOME/bin/kcadm.sh"
export KCADM_CONFIG="${KCADM_CONFIG:-$HOME/.keycloak/kcadm-university.config}"
log() { printf '\n==> %s\n' "$*"; }

"$KCADM" config credentials --server "$KC_URL" --realm master \
  --user "$PERM_ADMIN_USER" --password "$PERM_ADMIN_PASS"

REALM_ID="$("$KCADM" get "realms/$REALM" --fields id --format csv --noquotes)"
LDAP_ID="$("$KCADM" get components -r "$REALM" -q name="$PROVIDER" --fields id --format csv --noquotes)"

if [ -z "$LDAP_ID" ]; then
  log "Creating LDAP user-storage provider $PROVIDER"
  "$KCADM" create components -r "$REALM" \
    -s name="$PROVIDER" -s providerId=ldap \
    -s providerType=org.keycloak.storage.UserStorageProvider \
    -s parentId="$REALM_ID" \
    -s 'config.enabled=["true"]' \
    -s 'config.priority=["0"]' \
    -s 'config.vendor=["other"]' \
    -s "config.connectionUrl=[\"$LDAP_URL\"]" \
    -s 'config.startTls=["false"]' \
    -s 'config.authType=["simple"]' \
    -s "config.bindDn=[\"$LDAP_BIND_DN\"]" \
    -s "config.bindCredential=[\"$LDAP_BIND_PASS\"]" \
    -s 'config.editMode=["READ_ONLY"]' \
    -s 'config.usersDn=["ou=people,dc=university,dc=local"]' \
    -s 'config.usernameLDAPAttribute=["uid"]' \
    -s 'config.rdnLDAPAttribute=["uid"]' \
    -s 'config.uuidLDAPAttribute=["entryUUID"]' \
    -s 'config.userObjectClasses=["inetOrgPerson, organizationalPerson"]' \
    -s 'config.searchScope=["1"]' \
    -s 'config.pagination=["false"]' \
    -s 'config.importEnabled=["true"]' \
    -s 'config.syncRegistrations=["false"]' \
    -s 'config.trustEmail=["true"]' \
    -s 'config.useTruststoreSpi=["always"]' \
    -s 'config.connectionPooling=["true"]' \
    -s 'config.batchSizeForSync=["1000"]' \
    -s 'config.fullSyncPeriod=["86400"]' \
    -s 'config.changedSyncPeriod=["3600"]' \
    -s 'config.cachePolicy=["DEFAULT"]'
  LDAP_ID="$("$KCADM" get components -r "$REALM" -q name="$PROVIDER" --fields id --format csv --noquotes)"
fi

if [ -z "$("$KCADM" get components -r "$REALM" -q parent="$LDAP_ID" -q name=role-groups --fields id --format csv --noquotes)" ]; then
  log "Creating role-ldap-mapper (LDAP groups -> realm roles)"
  "$KCADM" create components -r "$REALM" \
    -s name=role-groups -s providerId=role-ldap-mapper \
    -s providerType=org.keycloak.storage.ldap.mappers.LDAPStorageMapper \
    -s parentId="$LDAP_ID" \
    -s 'config."roles.dn"=["ou=groups,dc=university,dc=local"]' \
    -s 'config."role.name.ldap.attribute"=["cn"]' \
    -s 'config."role.object.classes"=["groupOfNames"]' \
    -s 'config."membership.ldap.attribute"=["member"]' \
    -s 'config."membership.attribute.type"=["DN"]' \
    -s 'config."membership.user.ldap.attribute"=["uid"]' \
    -s 'config.mode=["READ_ONLY"]' \
    -s 'config."user.roles.retrieve.strategy"=["LOAD_ROLES_BY_MEMBER_ATTRIBUTE"]' \
    -s 'config."use.realm.roles.mapping"=["true"]'
fi

# Keycloak's default "first name" mapper reads cn (full name); use givenName instead.
FN_ID="$("$KCADM" get components -r "$REALM" -q parent="$LDAP_ID" -q name="first name" --fields id --format csv --noquotes)"
if [ -n "$FN_ID" ]; then
  "$KCADM" update "components/$FN_ID" -r "$REALM" -s 'config."ldap.attribute"=["givenName"]'
fi

log "Testing connection and running a full sync"
"$KCADM" create testLDAPConnection -r "$REALM" -s action=testAuthentication \
  -s connectionUrl="$LDAP_URL" -s bindDn="$LDAP_BIND_DN" -s bindCredential="$LDAP_BIND_PASS" \
  -s useTruststoreSpi=always -s authType=simple -s startTls=false
"$KCADM" create "user-storage/$LDAP_ID/sync?action=triggerFullSync" -r "$REALM"
log "Done - realm users (federationLink = imported from LDAP):"
"$KCADM" get users -r "$REALM" --fields username,firstName,lastName,federationLink
