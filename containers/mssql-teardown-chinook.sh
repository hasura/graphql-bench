#!/bin/bash

# SCRIPT_DIR points to the absolute path of this file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
METADATA_URL=http://localhost:8085/v1/metadata

echo ""
echo "Untracking tables"
curl "$METADATA_URL" --data-binary "@$SCRIPT_DIR/mssql_untrack_chinook_tables.json"
echo ""
