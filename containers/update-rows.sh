#!/bin/bash

# SCRIPT_DIR points to the absolute path of this file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# backend can be psql or mssql
backend="${1:-psql}"
update_rows_file=$SCRIPT_DIR/${backend}-update-rows.sh

sleep_interval_ms=1000
test_duration_seconds=30
float_sleep_interval=$(awk -v interval=$sleep_interval_ms 'BEGIN { print interval/1000 }')
total_iters=$(( sleep_interval_ms * test_duration_seconds / 1000 ))
echo "Starting at: $(date)"

# run the backend-specific `update_rows` query
source "$update_rows_file"

for i in $(seq $total_iters)
do
  update_rows
  echo "Triggered $i/$total_iters times"
  sleep "$float_sleep_interval"
done
echo "Finished at: $(date)"
