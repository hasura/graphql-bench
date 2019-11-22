FROM debian:stretch-slim as wrk2-builder
MAINTAINER vamshi@hasura.io

RUN apt-get update
RUN apt-get install -y lua-json wget unzip build-essential libssl-dev zlib1g-dev
RUN wget -O /tmp/wrk2.zip 'https://github.com/giltene/wrk2/archive/master.zip'
RUN unzip /tmp/wrk2.zip -d /tmp/
RUN make -C /tmp/wrk2-master

FROM python:3.7-slim
RUN apt-get update \
 && apt-get install -y lua-json libssl1.1 jq \
 && apt-get clean

COPY --from=wrk2-builder /tmp/wrk2-master/wrk /usr/bin/wrk2

COPY requirements.txt /graphql-bench/requirements.txt
RUN pip install --no-cache-dir -r /graphql-bench/requirements.txt

COPY bench.py /graphql-bench/bench.py
COPY plot.py /graphql-bench/plot.py
COPY bench-lib.lua /graphql-bench/bench-lib.lua
COPY bench.lua /graphql-bench/bench.lua

RUN mkdir -p /graphql-bench/ws
WORKDIR /graphql-bench/ws/

ENTRYPOINT ["python3", "-u", "/graphql-bench/bench.py"]
