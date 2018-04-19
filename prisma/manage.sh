#!/usr/bin/env sh

set -e

WRK_RPS_ARGS=""
if [ -v WRK_RPS ]; then
    WRK_RPS_ARGS="-R $WRK_RPS"
fi

usage() {
    echo "Usage: $0 (init|start|nuke|bench)"
}

init() {
    mkdir -p /tmp/prisma
    npm install prisma --prefix=/tmp/prisma
    PRISMA=/tmp/prisma/node_modules/prisma/dist/index.js
    "$PRISMA" local nuke
    # local nuke also starts prisma again
    # "$PRISMA" local start
    "$PRISMA" deploy
    "$PRISMA" import --data chinook.zip
}

bench_query ()
{
    echo "$WRK_RPS_ARGS"
    wrk2 -c 24 -d 300 -t 8 -s bench.lua --timeout 300s "$WRK_RPS_ARGS" 'http://127.0.0.1:4466' "$1" 2> stats/"$1".json
}

bench() {
    mkdir -p stats
    bench_query albums_tracks_genre_some
    bench_query albums_tracks_genre_all
    bench_query tracks_media_some
    bench_query tracks_media_all
}

if [ "$#" -ne 1 ]; then
    usage
    exit 1
fi

case $1 in
    init)
        init
        exit
        ;;
    start)
        docker start prisma-db
        docker start local_prisma-database_1
        exit
        ;;
    stop)
        docker stop local_prisma-database_1
        docker stop prisma-db
        exit
        ;;
    nuke)
        docker stop prisma-db && docker stop prisma-db
        docker stop local_prisma-database_1 && docker stop local_prisma-database_1
        exit
        ;;
    bench)
        bench
        exit
        ;;
    *)
        echo "unexpected option: $1"
        usage
        exit 1
        ;;
esac
