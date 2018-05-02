#!/usr/bin/env sh

set -e

usage() {
    echo "Usage: $0 (init|start|nuke)"
}

init() {
    mkdir -p /tmp/prisma
    npm install prisma --prefix=/tmp/prisma
    PRISMA=/tmp/prisma/node_modules/prisma/dist/index.js
    docker-compose up -d
    # Needs a better way
    echo "waiting for the containers to be up and running"
    sleep 30
    "$PRISMA" deploy
    "$PRISMA" import --data chinook.zip
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
        docker-compose up -d
        exit
        ;;
    stop)
        docker-compose stop
        exit
        ;;
    nuke)
        docker-compose stop
        docker-compose rm -f
        exit
        ;;
    *)
        echo "unexpected option: $1"
        usage
        exit 1
        ;;
esac
