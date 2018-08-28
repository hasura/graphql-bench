#!/usr/bin/env python3

import dash
from dash.dependencies import Input, Output
import dash_core_components as dcc
import dash_html_components as html
import datetime

import json
import itertools

import sys
import argparse

def compute_xs(program_rps_map):
    l = list(set(itertools.chain(*[d.keys() for d in program_rps_map.values()])))
    l.sort(key=lambda rps: int(rps))
    return l

def compute_ys(xs, rps_map, f):
    ys = []
    for x in xs:
        stat = rps_map.get(x)
        y = f(stat) if stat else None
        ys.append(y)
    return ys

def get_data(program_rps_map, fn):
    xs = compute_xs(program_rps_map)
    ys = []
    for program, rps_map in program_rps_map.items():
        dataRow = {
            "x" : xs,
            "y": compute_ys(xs, rps_map, fn),
            "type": "bar",
            "name": program
        }
        ys.append(dataRow)
    return ys

def get_ymetric_fn(yMetric):
    if yMetric == "P95":
        yMetricFn = lambda x: x['latency']['dist']['95']
    elif yMetric == "P98":
        yMetricFn = lambda x: x['latency']['dist']['98']
    elif yMetric == "P99":
        yMetricFn = lambda x: x['latency']['dist']['99']
    elif yMetric == "MIN":
        yMetricFn = lambda x: x['latency']['min']
    elif yMetric == "MAX":
        yMetricFn = lambda x: x['latency']['max']
    else:
        yMetricFn = lambda x: x['latency']['mean']
    return lambda x: None if round(yMetricFn(x)/1000, 2) > 1000 else round(yMetricFn(x)/1000, 2)

def run_dash_server(bench_results):

    with open("/graphql-bench/ws/bench_results.json","w+") as resultFile:
        json.dump(bench_results,resultFile)

    app = dash.Dash()

    app.layout = html.Div(children=[

        html.Label('Benchmark'),
        dcc.Dropdown(
            id='benchmark-index',
            options=[{'label':r['benchmark'], 'value': i} for i, r in enumerate(bench_results)],
            value='0'
        ),

        html.Label('Response time metric'),
        dcc.Dropdown(
            id='response-time-metric',
            options=[
                {'label': 'P95', 'value': 'P95'},
                {'label': 'P98', 'value': 'P98'},
                {'label': 'P99', 'value': 'P99'},
                {'label': 'Min', 'value': 'MIN'},
                {'label': 'Max', 'value': 'MAX'},
                {'label': 'Average', 'value': 'AVG'}
            ],
            value='P95'
        ),

        dcc.Graph(id='response-time-vs-rps')
    ])

    @app.callback(
        Output('response-time-vs-rps', 'figure'),
        [
            Input('benchmark-index', 'value'),
            Input('response-time-metric', 'value')
        ]
    )
    def updateGraph(benchMarkIndex, yMetric):
        benchMarkIndex=int(benchMarkIndex)
        figure={
            'data': get_data(bench_results[benchMarkIndex]['results'],get_ymetric_fn(yMetric)),
            'layout': {
                'yaxis' : {
                    'title': "Response time ({}) in ms".format(yMetric)
                },
                'xaxis' : {
                    'title': "Requests/sec"
                },
                'title' : 'Response time vs Requests/sec for {}'.format(bench_results[benchMarkIndex]['benchmark'])
            }
        }
        return figure

    app.run_server(host="0.0.0.0", debug=False)

if __name__ == '__main__':

    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--results', nargs='?', type=argparse.FileType('r'),
        default=sys.stdin)
    args = parser.parse_args()
    bench_results = json.load(args.results)
    print(bench_results)

    print("=" * 20)
    print("starting dash server for graphs")

    run_dash_server(bench_results)
