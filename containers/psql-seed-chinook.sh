#!/bin/bash

PGUSER=postgres
PGPASS=postgrespassword
PGADDRESS=localhost:5430
# SCRIPT_DIR points to the absolute path of this file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEEDFILE=$SCRIPT_DIR/chinook_pg_serial_pk_proper_naming.sql
METADATA_URL=http://localhost:8085/v1/metadata
PG_URL=postgres://$PGUSER:$PGPASS@$PGADDRESS/postgres

./psql-wait.sh

echo ""
echo "Seeding DB"
psql $PG_URL <$SEEDFILE

echo ""
echo "Tracking tables"
curl "$METADATA_URL" --data-binary "@$SCRIPT_DIR/psql_track_chinook_tables.json"

echo ""
echo "Tracking foreign-key relationships"
curl "$METADATA_URL" --data-binary "@$SCRIPT_DIR/psql_track_chinook_relationships.json"
