#!/usr/bin/env sh

set -e


usage() {
    echo "Usage: $0 (init|start|nuke|bench)"
}

init() {
    N_CPUS=$(nproc --all)
    GRAPHILE_CONTAINERS=$(docker ps -a | grep 'postgraphile' | awk '{print $1}')
    echo "Stopping graphile containers: $GRAPHILE_CONTAINERS"
    docker stop "$GRAPHILE_CONTAINERS"
    echo "Removing graphile containers: $GRAPHILE_CONTAINERS"
    docker rm "$GRAPHILE_CONTAINERS"
    docker build -t "hasura/postgraphile:latest" .
    docker run --name postgraphile-chinook -p 5000:5000 -d hasura/postgraphile:latest postgraphile -c 'postgres://admin@172.17.0.1:7432/chinook' --host 0.0.0.0 --max-pool-size 100 --cluster-workers "$N_CPUS"
}

bench_query ()
{
    wrk -c 24 -d 60 -t 8 -s bench.lua --timeout 300s 'http://127.0.0.1:5000' $1 2> stats/$1.json
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
        docker start postgres-chinook
        docker start postgraphile-chinook
        exit
        ;;
    nuke)
        docker rm postgraphile-chinook
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
