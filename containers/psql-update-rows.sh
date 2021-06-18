#!/bin/bash

PGUSER=postgres
PGPASS=postgrespassword
PGADDRESS=localhost:5430

update_rows() {
  psql postgres://$PGUSER:$PGPASS@$PGADDRESS/postgres \
    -c "UPDATE albums SET Title = CONCAT(gen_random_uuid(), now()) WHERE 1=1;"
}
