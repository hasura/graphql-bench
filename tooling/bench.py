#!/usr/bin/env python3

import yaml
import json

import subprocess

import argparse
import multiprocessing

import sys
import os

from plot import run_dash_server

cpuCount = multiprocessing.cpu_count()
fileLoc = os.path.dirname(os.path.abspath(__file__))

def eprint(msg, indent):
    print((' ' * 2 * indent) + msg, file=sys.stderr)

def runWrk2(programDir, programUrl, queryName, rps, openConns, duration):
    p = subprocess.run(
        ["wrk2",
         "-R", str(rps),
         "-c", str(openConns),
         "-d", str(duration),
         "-t", str(cpuCount),
         "-s", os.path.join(programDir, "bench.lua"),
         "--timeout", "1s",
         programUrl,
         os.path.join(programDir, "queries.graphql"),
         queryName
        ],
        env = dict(
            os.environ,
            LUA_PATH="/usr/share/lua/5.1/?.lua;" + os.path.join(fileLoc, "?.lua") + ';;',
            LUA_CPATH="/usr/lib/lua/5.1/?.so;/usr/lib/x86_64-linux-gnu/lua/5.1/?.so;;"
        ),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        encoding='utf-8'
    )
    if p.returncode != 0:
        for l in p.stderr.splitlines():
            eprint(l, 3)
        return None
    else:
        for l in p.stdout.splitlines():
            eprint(l, 3)
        return json.loads(p.stderr)

def benchCandidate(programDir, programUrl, queryName, rpsList, openConns, duration):
    results = {}
    for rps in rpsList:
        eprint("+" * 20, 3)
        eprint("{rps}Req/s Duration:{duration}s open connections:{openConns}".format(
            rps=rps,
            duration=duration,
            openConns=openConns
        ), 3)
        res = runWrk2(programDir, programUrl, queryName, rps, openConns, duration)
        results[rps] = res
    return results

def benchQuery(benchParams):

    queryName = benchParams["query"]

    eprint("=" * 20, 0)
    eprint("query: {}".format(queryName), 0)

    rpsList = benchParams["rps"]
    timeout = benchParams["timeout"]
    duration = benchParams["duration"]
    openConns = benchParams["open_connections"]
    warmupDuration = benchParams.get("warmup_duration", None)

    results = {}

    for candidate in benchParams["candidates"]:

        programDir = candidate["dir"]
        programUrl = candidate["url"]

        eprint("-" * 20, 1)
        eprint("candidate: {} at {}".format(programDir, programUrl), 1)

        if warmupDuration:
            eprint("Warmup:", 2)
            benchCandidate(programDir, programUrl, queryName, rpsList, openConns, warmupDuration)

        eprint("Benchmark:", 2)
        candidateRes = benchCandidate(programDir, programUrl, queryName,
                                      rpsList, openConns, duration)
        results[programDir] = candidateRes

    return {
        "query": queryName,
        "results": results
    }

def bench(args):
    querySpecs = yaml.load(args.spec)
    query = args.query
    if query:
        querySpecs = list(filter(lambda qs: qs['query'] == query, querySpecs))
        if not querySpecs:
            print("No such query exists in the spec: {}".format(query))
            sys.exit(1)
    results = []
    for querySpec in querySpecs:
        results.append(benchQuery(querySpec))
    return results

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--spec', nargs='?', type=argparse.FileType('r'),
        default=sys.stdin)
    parser.add_argument('--query', nargs='?', type=str)
    args = parser.parse_args()
    results = bench(args)
    run_dash_server(results)
