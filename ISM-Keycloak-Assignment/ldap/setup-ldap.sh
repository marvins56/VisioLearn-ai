#!/usr/bin/env bash
# Loads the demo institutional directory into a local OpenLDAP (slapd) server.
#   sudo apt install slapd ldap-utils     (domain: university.local)
#   LDAP_ADMIN_PASS=... ./setup-ldap.sh
set -euo pipefail
cd "$(dirname "$0")"
LDAP_URL="${LDAP_URL:-ldap://127.0.0.1:389}"
BIND_DN="${BIND_DN:-cn=admin,dc=university,dc=local}"
LDAP_ADMIN_PASS="${LDAP_ADMIN_PASS:-LdapAdmin#2026}"
DEMO_PASSWORD="${DEMO_PASSWORD:-Passw0rd#2026}"

ldapadd -c -x -H "$LDAP_URL" -D "$BIND_DN" -w "$LDAP_ADMIN_PASS" -f university-directory.ldif || true
for u in lecturer02 student02; do   # server hashes the password ({SSHA})
  ldappasswd -x -H "$LDAP_URL" -D "$BIND_DN" -w "$LDAP_ADMIN_PASS" -s "$DEMO_PASSWORD" "uid=$u,ou=people,dc=university,dc=local"
done
ldapsearch -x -H "$LDAP_URL" -D "$BIND_DN" -w "$LDAP_ADMIN_PASS" -b dc=university,dc=local -LLL dn
