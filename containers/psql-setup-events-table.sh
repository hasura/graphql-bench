#!/bin/bash
PGUSER=postgres
PGPASS=postgrespassword
PGADDRESS=localhost:5430
# SCRIPT_DIR points to the absolute path of this file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVENTS_TABLE=$SCRIPT_DIR/setup_events_table.sql

function pg_wait {
  echo -n "Waiting for postgres to come up"
  until ( psql postgres://$PGUSER:$PGPASS@$PGADDRESS/postgres -c '\l' ) &>/dev/null; do
    echo -n '.' && sleep 0.2
  done
  echo " Ok"
}

pg_wait
psql postgres://$PGUSER:$PGPASS@$PGADDRESS/postgres <$EVENTS_TABLE
