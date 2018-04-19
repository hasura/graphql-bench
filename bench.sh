#!/usr/bin/env sh

set -e

N_CPUS=$(nproc --all)

run_wrk2() {
    local PROGRAM_URL=$1
    local PROGRAM_DIR=$2
    local QUERY_NAME=$3
    local RPS=$4
    local OPEN_CONNS=$5
    local DURATION=$6
    local BENCH_STATS_FILE=$7

    set +e
    env \
        LUA_PATH="/usr/share/lua/5.1/?.lua;$(pwd)/?.lua" \
        LUA_CPATH="/usr/lib/lua/5.1/?.so;/usr/lib/x86_64-linux-gnu/lua/5.1/?.so" \
        wrk2 -R "$RPS" \
        -c "$OPEN_CONNS" \
        -d "$DURATION" \
        -t "$N_CPUS" \
        -s "$PROGRAM_DIR/bench.lua" \
        --timeout 1s \
        "$PROGRAM_URL"\
        "$PROGRAM_DIR/queries.graphql" \
        "$QUERY_NAME" 2> "$BENCH_STATS_FILE"
    # this is needed because wrk's error is written to stderr
    rc=$?;
    set -e
    if [ $rc -ne 0 ]; then
        cat "$BENCH_STATS_FILE";
        rm "$BENCH_STATS_FILE";
        exit $rc;
    fi

}

bench_query() {
    local QUERY_PARAMS="$1"
    local QUERY_NAME="$(echo "$QUERY_PARAMS" | jq -rc '.query')"
    local RPS_ARRAY="$(echo "$QUERY_PARAMS" | jq -rc '.rps | @tsv')"
    local TIMEOUT="$(echo "$QUERY_PARAMS" | jq -rc '.timeout')"
    local DURATION="$(echo "$QUERY_PARAMS" | jq -rc '.duration')"
    local OPEN_CONNS="$(echo "$QUERY_PARAMS" | jq -rc '.open_connections')"
    local WARMUP_DURATION="$(echo "$QUERY_PARAMS" | jq -rc '.warmup_duration')"

    for CANDIDATE in $(echo "$QUERY_PARAMS" | jq -rc '.candidates[]'); do
        local PROGRAM_DIR="$(echo $CANDIDATE | jq -rc '.dir')"
        local PROGRAM_URL="$(echo $CANDIDATE | jq -rc '.url')"
        for RPS in $RPS_ARRAY;do

            local BENCH_NAME="$QUERY_NAME $PROGRAM_DIR $PROGRAM_URL "$RPS"Req/s "$DURATION"s $OPEN_CONNS"
            local BENCH_STATS_FILE="stats/$QUERY_NAME-$PROGRAM_DIR-$RPS-$OPEN_CONNS.json"

            if [ "$WARMUP_DURATION" != "null" ]; then
                echo "W: $BENCH_NAME"
                echo "-----------------"
                run_wrk2 "$PROGRAM_URL" "$PROGRAM_DIR" "$QUERY_NAME" \
                             "$RPS" "$OPEN_CONNS" "$WARMUP_DURATION" "$BENCH_STATS_FILE.warmup"
                rm "$BENCH_STATS_FILE.warmup"
            fi

            echo "B: $BENCH_NAME"
            echo "-----------------"
            run_wrk2 "$PROGRAM_URL" "$PROGRAM_DIR" "$QUERY_NAME" \
                     "$RPS" "$OPEN_CONNS" "$DURATION" "$BENCH_STATS_FILE"

        done
    done

}

usage() {
    echo "Usage: $0 [query-name]"
}

init() {
    mkdir -p stats
    local BENCH_CONF=""
    if [ -e bench.yaml ]; then
        BENCH_CONF="$(yaml2json bench.yaml | jq -c '.')"
    elif [ -e bench.json ]; then
        BENCH_CONF="$(cat bench.json | jq -c '.')"
    else
        echo "needs bench.yaml/bench.json to continue"
    fi

    local QUERY_NAME="$1"

    if [ -n "$QUERY_NAME" ]; then
        local QUERY_PARAMS="$(echo $BENCH_CONF | jq --arg QUERY_NAME "$QUERY_NAME" -rc '.[] | select(.query == $QUERY_NAME)')"
        if [ -n "$QUERY_PARAMS" ]; then
            bench_query "$QUERY_PARAMS"
        else
            echo "The query $QUERY_NAME is not found in bench.yaml/json"
            exit 1
        fi

    else
        for QUERY_PARAMS in $(echo "$BENCH_CONF" | jq -rc '.[]'); do
            bench_query "$QUERY_PARAMS"
        done
    fi

}

if [ "$#" -gt 1 ]; then
    usage
    exit 1
else
    init "$1"
fi

# mkdir -p stats
# bench_program raven "http://$SERVER_IP:7080"
# # bench_program postgraphile "http://$SERVER_IP:5000"
# bench_program prisma "http://$SERVER_IP:4466"
