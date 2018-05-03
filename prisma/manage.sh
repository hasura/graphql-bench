#!/usr/bin/env sh

set -e

SCRIPT_DIR=$(dirname "$0")

usage() {
    echo "Usage: $0 (init|start|nuke)"
}

init() {
    mkdir -p /tmp/prisma
    npm install prisma --prefix=/tmp/prisma
    PRISMA=/tmp/prisma/node_modules/prisma/dist/index.js
    docker-compose -f "$SCRIPT_DIR/docker-compose.yml" up -d
    # Needs a better way
    echo "waiting for the containers to be up and running"
    sleep 30
    (cd "$SCRIPT_DIR"; "$PRISMA" deploy)
    (cd "$SCRIPT_DIR"; "$PRISMA" import --data chinook.zip)
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
        docker-compose -f "$SCRIPT_DIR/docker-compose.yml" up -d
        exit
        ;;
    stop)
        docker-compose -f "$SCRIPT_DIR/docker-compose.yml" stop
        exit
        ;;
    nuke)
        docker-compose -f "$SCRIPT_DIR/docker-compose.yml" stop
        docker-compose -f "$SCRIPT_DIR/docker-compose.yml" rm -f
        exit
        ;;
    *)
        echo "unexpected option: $1"
        usage
        exit 1
        ;;
esac
