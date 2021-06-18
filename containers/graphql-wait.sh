#!/usr/bin/env bash
echo -n "Waiting for graphql-engine"
until curl -s "http://localhost:8085/v1/query" &>/dev/null; do
    echo -n '.' && sleep 0.2
done

echo ""
echo " Ok"
