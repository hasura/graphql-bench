#!/bin/bash
MSSQLUSER=sa
MSSQLPASS=testPassword123
MSSQLADDRESS=localhost,1433

update_rows() {
  sqlcmd -S $MSSQLADDRESS -U $MSSQLUSER -P $MSSQLPASS  \
    -Q "UPDATE [dbo].[Album] SET Title = CONCAT(NewID(), GETUTCDATE()) WHERE 1=1;"
}

sleep_interval_ms=1000
test_duration_seconds=30
float_sleep_interval=$(awk -v interval=$sleep_interval_ms 'BEGIN { print interval/1000 }')
total_iters=$(( 1000/sleep_interval_ms * test_duration_seconds ))
echo "Starting at: $(date)"
for i in $(seq $total_iters)
do
  update_rows
  echo "Triggered $i/$total_iters times"
  sleep "$float_sleep_interval"
done
echo "Finished at: $(date)"
