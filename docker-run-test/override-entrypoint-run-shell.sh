#!/bin/bash

# This is a quick sample script as a demo for how to override Docker containers with an ENTRYPOINT command to get into an interactive shell
docker run -it --entrypoint "/bin/sh" graphql-bench-test:latest
