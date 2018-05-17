FROM python:3.6
MAINTAINER vamshi@hasura.io

COPY requirements.txt /app/requirements.txt

WORKDIR /app

RUN pip install -r requirements.txt

COPY src /app/src
