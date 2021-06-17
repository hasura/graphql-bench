#!/bin/bash

PGUSER=postgres
PGPASS=postgrespassword
PGADDRESS=localhost:5430
# SCRIPT_DIR points to the absolute path of this file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEEDFILE=$SCRIPT_DIR/chinook_pg_serial_pk_proper_naming.sql

psql postgres://$PGUSER:$PGPASS@$PGADDRESS/postgres <$SEEDFILE
