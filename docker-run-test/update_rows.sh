#!/bin/bash
setup_db() {
  sqlcmd \
    -S 127.0.0.1,21433 \
    -U sa \
    -P hasuraMSSQL1 \
    -i Chinook_SqlServer.sql
}

update_rows() {
  sqlcmd \
    -S 127.0.0.1,21433 \
    -U sa \
    -P hasuraMSSQL1 \
    -Q "UPDATE [Chinook].[dbo].[Album] SET Title = CONCAT(NewID(), GETUTCDATE()) WHERE 1=1;"
}
sleep_interval_ms=1000
test_duration_seconds=60
float_sleep_interval=$(awk -v interval=$sleep_interval_ms 'BEGIN { print interval/1000 }')
total_iters=$(( 1000/sleep_interval_ms * test_duration_seconds ))
# setup_db
echo "Starting at: $(date)"
for i in $(seq $total_iters)
do
  update_rows
  echo "Triggered $i/$total_iters times"
  sleep "$float_sleep_interval"
done
echo "Finished at: $(date)"
