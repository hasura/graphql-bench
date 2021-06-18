#!/bin/bash
PGUSER=postgres
PGPASS=postgrespassword
PGADDRESS=localhost:5430

echo -n "Waiting for postgres to come up"
until ( psql postgres://$PGUSER:$PGPASS@$PGADDRESS/postgres -c '\l' ) &>/dev/null; do
echo -n '.' && sleep 0.2
done
echo " Ok"
