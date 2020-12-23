#!/bin/bash

PGUSER=postgres
PGPASS=postgrespassword
PGADDRESS=localhost:5430
SEEDFILE=chinook_pg_serial_pk_proper_naming.sql

psql postgres://$PGUSER:$PGPASS@$PGADDRESS/postgres <$SEEDFILE
