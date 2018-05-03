FROM ubuntu:17.10 as wrk2-builder
MAINTAINER vamshi@hasura.io

RUN apt-get update
RUN apt-get install -y lua-json wget unzip build-essential libssl-dev
RUN wget -O /tmp/wrk2.zip 'https://github.com/giltene/wrk2/archive/master.zip'
RUN unzip /tmp/wrk2.zip -d /tmp/
RUN make -C /tmp/wrk2-master

FROM python:3.6
RUN apt-get update \
 && apt-get install -y lua-json libssl1.0.0 jq \
 && apt-get clean

COPY --from=wrk2-builder /tmp/wrk2-master/wrk /usr/bin/wrk2

COPY requirements.txt /graphql-bench/requirements.txt
RUN pip install -r /graphql-bench/requirements.txt

COPY bench.py /graphql-bench/bench.py
COPY plot.py /graphql-bench/plot.py
COPY graphql-bench.lua /graphql-bench/graphql-bench.lua

RUN mkdir -p /graphql-bench/ws
WORKDIR /graphql-bench/ws/

ENTRYPOINT ["python3", "-u", "/graphql-bench/bench.py"]
