#!/bin/bash
PGUSER=postgres
PGPASS=postgrespassword
PGADDRESS=localhost:5430
# SCRIPT_DIR points to the absolute path of this file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVENTS_TABLE=$SCRIPT_DIR/setup_events_table.sql

psql postgres://$PGUSER:$PGPASS@$PGADDRESS/postgres <$EVENTS_TABLE
