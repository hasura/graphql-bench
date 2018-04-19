#!/usr/bin/env sh

set -e

usage() {
    echo "Usage: $0 (init|start|nuke)"
}

init() {
    mkdir -p /tmp/prisma
    npm install prisma --prefix=/tmp/prisma
    PRISMA=/tmp/prisma/node_modules/prisma/dist/index.js
    "$PRISMA" local nuke
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
        docker stop prisma-db && docker rm prisma-db
        docker stop local_prisma-database_1 && docker rm local_prisma-database_1
        exit
        ;;
    *)
        echo "unexpected option: $1"
        usage
        exit 1
        ;;
esac
