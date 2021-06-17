#!/bin/bash
VERSION=v0.36.0 # use the latest release version from https://github.com/google/cadvisor/releases

echo "Starting cAdvisor..."
echo "Visit localhost:8090 to view Docker container statistics"

docker run \
  --volume=/:/rootfs:ro \
  --volume=/var/run:/var/run:ro \
  --volume=/sys:/sys:ro \
  --volume=/var/lib/docker/:/var/lib/docker:ro \
  --volume=/dev/disk/:/dev/disk:ro \
  --publish=8090:8080 \
  --detach=true \
  --name=cadvisor \
  --privileged \
  --device=/dev/kmsg \
  gcr.io/cadvisor/cadvisor:$VERSION
