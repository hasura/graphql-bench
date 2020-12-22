FROM node:14-alpine AS base
# Store ENV vars for where the place the k6 and wrk2 binaries in the custom built container
ENV k6_binary_path="/usr/bin/k6"
ENV wrk_binary_path="/usr/bin/wrk"

# Temporary layer which builds wrk2 binary, only used to copy out the binary in final layer for small image
FROM base AS wrk-builder
RUN apk add --update alpine-sdk libgcc openssl-dev zlib-dev \
  && apk add --no-cache git \
  && git clone https://github.com/giltene/wrk2.git \
  && cd wrk2 \
  && make \
  && cp wrk ${wrk_binary_path} \
  && cd .. \
  && rm -rf wrk2 \
  && apk del git alpine-sdk

# Final layer, copy both wrk2 and k6 binaries and the Node app source code
FROM base AS node-builder
WORKDIR /app
ENV LUA_PATH="/app/queries/bin/wrk/?.lua;;"
COPY --from=loadimpact/k6:0.27.0 /usr/bin/k6 ${k6_binary_path}
COPY --from=wrk-builder ${wrk_binary_path} ${wrk_binary_path}
COPY . .
RUN yarn install

ENTRYPOINT ["./cli/bin/run"]
