import dash
from dash.dependencies import Input, Output
import dash_core_components as dcc
import dash_html_components as html

import os
import json
import itertools
from collections import defaultdict

def get_query_stat_map():
    # a default dict to 3 levels
    query_stat_map = defaultdict(lambda: defaultdict(lambda: defaultdict(dict)))
    filenames = os.listdir('stats')
    for fn in filenames:
        parts = fn.split('-')
        with open(os.path.join('stats', fn)) as fp:
            query_stat_map[parts[0]][parts[1]][parts[2]] = json.load(fp)
    return query_stat_map

query_stat_map = get_query_stat_map()
query_names = list(query_stat_map.keys())
query_names.sort()

app = dash.Dash()

app.layout = html.Div(children=[
    # html.H1(children='Hello Dash'),

    # html.Div(children='''
    #     Dash: A web application framework for Python.
    # '''),

    html.Label('Query'),
    dcc.Dropdown(
        id='query-name',
        options=[{'label':k, 'value': k} for k in query_names],
        value=query_names[0]
    ),

    html.Label('Response time metric'),
    dcc.Dropdown(
        id='response-time-metric',
        options=[
            {'label': 'P95', 'value': 'P95'},
            {'label': 'P98', 'value': 'P98'},
            {'label': 'P99', 'value': 'P99'},
            {'label': 'Average', 'value': 'AVG'}
        ],
        value='P95'
    ),

    dcc.Graph(id='response-time-vs-rps')
])

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
    else:
        yMetricFn = lambda x: x['latency']['mean']
    return lambda x: None if round(yMetricFn(x)/1000, 2) > 1000 else round(yMetricFn(x)/1000, 2)

@app.callback(
    Output('response-time-vs-rps', 'figure'),
    [
        Input('query-name', 'value'),
        Input('response-time-metric', 'value')
    ]
)
def updateGraph(queryName, yMetric):
    figure={
        'data': get_data(query_stat_map[queryName],get_ymetric_fn(yMetric)),
        'layout': {
            'yaxis' : {
                'title': "Response time ({}) in ms".format(yMetric)
            },
            'xaxis' : {
                'title': "Requests/sec"
            },
            'title' : 'Response time vs Requests/sec for {}'.format(queryName)
        }
    }
    return figure

if __name__ == '__main__':
    app.run_server(debug=True)
