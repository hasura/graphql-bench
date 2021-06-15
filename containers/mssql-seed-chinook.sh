#!/bin/bash

MSSQLUSER=sa
MSSQLPASS=hasuraMSSQL1
MSSQLADDRESS=localhost,1434
# SCRIPT_DIR points to the absolute path of this file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEEDFILE=$SCRIPT_DIR/Chinook_SqlServer.sql

sqlcmd -S $MSSQLADDRESS -U $MSSQLUSER -P $MSSQLPASS -i "$SEEDFILE"
