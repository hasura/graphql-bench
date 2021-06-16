#!/bin/bash

MSSQLUSER=sa
MSSQLPASS=testPassword123
MSSQLADDRESS=localhost,1433
# SCRIPT_DIR points to the absolute path of this file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEEDFILE=$SCRIPT_DIR/Chinook_SqlServer.sql
METADATA_URL=http://localhost:8085/v1/metadata
MSSQL_DB_URL="DRIVER={ODBC Driver 17 for SQL Server};SERVER=msserver;Uid=SA;Pwd=testPassword123"
MSSQL_CMD="sqlcmd -S $MSSQLADDRESS -U $MSSQLUSER -P $MSSQLPASS"

function mssql_wait {
  echo -n "Waiting for mssql to come up"
  until ( sqlcmd -S $MSSQLADDRESS -U $MSSQLUSER -P $MSSQLPASS -Q 'SELECT 1' ) &>/dev/null; do
    echo -n '.' && sleep 0.2
  done
  echo " Ok"
}

mssql_wait
echo ""
echo "export metadata"
echo ""
echo "export metadata"
curl $METADATA_URL --data-raw '{"type":"export_metadata","args":{}}'

echo "get_inconsistent_metadata"
curl $METADATA_URL --data-raw '{"type":"get_inconsistent_metadata","args":{}}'

echo ""
echo MSSQL_DB_URL
echo "$MSSQL_DB_URL"

echo ""
echo "Adding SQL Server source"
curl "$METADATA_URL" \
  --data-raw '{"type":"mssql_add_source","args":{"name":"mssql","configuration":{"connection_info":{"connection_string":"'"$MSSQL_DB_URL"'"}}}}'
#
# echo "Adding SQL Server source"
# curl "$METADATA_URL" \
#   --data-raw '{"type":"mssql_add_source","args":{"name":"mssql","configuration":{"connection_info":{"connection_string":"DRIVER={ODBC Driver 17 for SQL Server};SERVER=localhost,1430;Uid=sa;Pwd=hasuraMSSQL1;"}}}}'
# #
# curl 'http://localhost:8181/v1/metadata' --data-raw '{"type":"mssql_add_source","args":{"name":"mssql","configuration":{"connection_info":{"connection_string":"DRIVER={ODBC Driver 17 for SQL Server};SERVER=localhost,1430;Uid=sa;Pwd=hasuraMSSQL1;","pool_settings":{}}}}}'

curl $METADATA_URL --data-raw '{"type":"export_metadata","args":{}}'

# # # Seed DB
# sqlcmd -S $MSSQLADDRESS -U $MSSQLUSER -P $MSSQLPASS -i "$SEEDFILE"

# # Track tables
# echo $SCRIPT_DIR
# curl "$METADATA_URL" \
#   --data-binary "@$SCRIPT_DIR/mssql_track_chinook_tables.json"
