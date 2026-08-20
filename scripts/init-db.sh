#!/bin/bash
# Erstellt die keycloak-Datenbank beim ersten Start
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE DATABASE keycloak;
  GRANT ALL PRIVILEGES ON DATABASE keycloak TO $POSTGRES_USER;
EOSQL
echo "Datenbank 'keycloak' erstellt."
