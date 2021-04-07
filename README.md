# GraphQL Bench

- [GraphQL Bench](#graphql-bench)
  - [Introduction](#introduction)
  - [Usage](#usage)
    - [CLI](#cli)
      - [Commands Overview](#commands-overview)
      - [Queries/Mutations](#queriesmutations)
        - [Config](#config)
        - [Run with Docker](#run-with-docker)
        - [Run Locally](#run-locally)
        - [Usage Guide](#usage-guide)
      - [Subscriptions](#subscriptions)
        - [Config](#config-1)
        - [Note: Required Table](#note-required-table)
        - [Run with Docker](#run-with-docker-1)
        - [Run Locally](#run-locally-1)
        - [Usage Guide](#usage-guide-1)
    - [Programmatic API](#programmatic-api)
      - [Queries/Mutations](#queriesmutations-1)
      - [Subscriptions](#subscriptions-1)

## Introduction

GraphQL Bench is a versatile tool for benchmarking and load-testing GraphQL Services.
It can be run as a CLI application (local or Docker), and also provides a programmatic API.
Both HTTP (Queries/Mutations) and Websocket (Subscriptions) tests are supported.

HTTP tests can be configured to run with your choice of:
- Autocannon
- K6
- wrk2

Each benchmark tool will produce live output you can monitor while running your tests:

| Autocannon                                 | K6                                 |
| ------------------------------------------ | ---------------------------------- |
| ![](./readme_images/autocannon-output.png) | ![](./readme_images/k6-output.png) |

The output is standardized internally across tools using `HDRHistograms` and can be viewed in a web app:

![](./app/hasura-bench-report.gif)

## Usage

### CLI

#### Commands Overview
```sh
❯ graphql-bench --help

USAGE
  $ graphql-bench [COMMAND]

COMMANDS
  help          display help for graphql-bench
  query         benchmark queries or mutations
  subscription  benchmark subscriptions
```
```sh
❯ graphql-bench query --help
benchmark queries or mutations

USAGE
  $ graphql-bench query

OPTIONS
  -c, --config=config    (required) Filepath to YAML config file for query benchmarks
  -h, --help             show CLI help
  -o, --outfile=outfile  Filepath to output JSON file containing benchmark stats

EXAMPLE
  $ graphql-bench query --config ./config.query.yaml --outfile results.json
```
```sh
❯ graphql-bench subscription --help
benchmark subscriptions

USAGE
  $ graphql-bench subscription

OPTIONS
  -c, --config=config  (required) Filepath to YAML config file for subscription benchmarks
  -h, --help           show CLI help

EXAMPLE
  $ graphql-bench subscription --config ./config.subscription.yaml
```

---

#### Queries/Mutations

When running locally, add executable permission to the 
* run binary at `app/cli/bin` by running `chmod +x run`
* k6 binary at `app/queries/bin/k6/` by running `chmod +x k6`
* wrk binary at `app/queries/bin/wrk/` by running `chmod +x wrk`
##### Config

The Query/Mutation CLI bench expects a YAML config of the following format:

```yaml
url: 'http://localhost:8085/v1/graphql'
headers:
  X-Hasura-Admin-Secret: my-secret
queries:
    # Name: Unique name for the query
  - name: SearchAlbumsWithArtist
    # Tools: List of benchmarking tools to run: ['autocannon', 'k6', 'wrk2']
    tools: [autocannon, k6]
    # Execution Strategy: the type of the benchmark to run. Options are: 
    # REQUESTS_PER_SECOND: Fixed duration, fixed rps. Example parameters:
    #   duration: 10s
    #   rps: 500
    # FIXED_REQUEST_NUMBER: Complete requests as fast as possible, no duration. Example parameters:
    #   requests: 10000
    # MAX_REQUESTS_IN_DURATION: Make as many requests as possible in duration. Example parameters:
    #   duration: 10s
    # MULTI_STAGE: (K6 only currently) Several stages of REQUESTS_PER_SECOND benchmark. Example parameters:
    #   initial_rps: 0
    #   stages:
    #     - duration: 5s
    #       target: 100
    #     - duration: 10s
    #       target: 1000
    # CUSTOM: Pass completely custom options to each tool (see full API spec for all supported options, very large)
    execution_strategy: REQUESTS_PER_SECOND
    rps: 2000
    duration: 10s
    connections: 50
    query: |
      query SearchAlbumsWithArtist {
        albums(where: {title: {_like: "%Rock%"}}) {
          id
          title
          artist {
            name
            id
          }
        }
      }
  - name: AlbumByPK
    tools: [autocannon, k6]
    execution_strategy: FIXED_REQUEST_NUMBER
    requests: 10000
    query: |
      query AlbumByPK {
        albums_by_pk(id: 1) {
          id
          title
        }
      }
  - name: AlbumByPKMultiStage
    tools: [k6]
    execution_strategy: MULTI_STAGE
    initial_rps: 0
    stages:
      - duration: 5s
        target: 100
      - duration: 5s
        target: 1000
    query: |
      query AlbumByPK {
        albums_by_pk(id: 1) {
          id
          title
        }
      }
```

##### Run with Docker

*Note: to be updated when image published to Dockerhub*

The `Makefile` contains steps to automate building/tagging/running the image. You can run `make build_local_docker_image` and then `make run_docker_query_bench`.

The configuration used by these `make` commands lives in `/docker-run-test/config.(query|subscription).yaml`, so edit those files to change the run parameters.

To manually execute, run the following (where the current directory contains the file `config.query.yaml`):

```sh
docker run --net=host -v "$PWD":/app/tmp -it \
  graphql-bench-local query \
  --config="./tmp/config.query.yaml" \
  --outfile="./tmp/report.json"
```

##### Run Locally

```sh
cd cli
yarn install
./bin/run query  --config="<query YAML config file path here>" --outfile="report.json"
```

##### Usage Guide

- Watch the tool-specific output during the benchmark to view live metrics
- Save the output to a file, IE `report.json` 
- Inspect `report.json` to view detailed statistics and histograms
- Upload the `report.json` to the web viewer app for visual metrics

---

#### Subscriptions

##### Config

The Subscription CLI bench expects a YAML config of the following format:

```yaml
url: 'http://localhost:8085/v1/graphql'
db_connection_string: postgres://postgres:postgrespassword@localhost:5430/postgres
headers:
  X-Hasura-Admin-Secret: my-secret
config:
  # Label must be unique per-run, it identifiers the run in the DB
  label: SearchAlbumsWithArtistUpdated
  # Total number of websocket connections to open
  max_connections: 20
  # New connections to make per second until target reached
  connections_per_second: 10
  # Whether or not to insert the subscription payload data into the DB at the end
  insert_payload_data: true
  # The subscription to run
  query: |
    subscription AlbumByIDSubscription($artistIds: [Int!]!) {
      albums(where: {artist_id: { _in: $artistIds}}) {
        id
        title
        updated_at
      }
    }
  # Optional variables (if subscription uses variables)
  variables:
    some_value: a_string
    # Ranges will loop repeatedly from "start" to "end" and increment by one for each new subscription
    some_range: { start: 1, end: 10 }
    another_range: { start: 50, end: 100 }
    some_number: 10
    artistIds: [1, 2, 3, 4]
    some_object:
      a_key: a_value
```

##### Note: Required Table

For the Subscriptions test to record data in the DB, it requires a table `events` present with the following schema:

```sql
CREATE TABLE public.events (
  -- unique label to identify benchmark
  label text NOT NULL
  -- connection_id represents the n'th connection
  connection_id int NOT NULL
  operation_id int NOT NULL
  -- event_number represents the nth event that was received by the client
  event_number int NOT NULL
  -- event_data stores the payload that was received
  event_data jsonb NOT NULL
  -- event_time stores the time at which the event was received by the client
  event_time timestamptz NOT NULL
  -- is_error represents whether the event was error or not
  is_error boolean NOT NULL
  --  latency is not populated by the benchmark tool, but this can be populated by calculating event_time - <event_triggered_time>
  latency int
)
```

##### Run with Docker

*Note: to be updated when image published to Dockerhub*

The `Makefile` contains steps to automate building/tagging/running the image. You can run `make build_local_docker_image` and then `make run_docker_subscription_bench`.

The configuration used by this `make` commands lives in `/docker-run-test/config.(query|subscription).yaml`, so edit those files to change the run parameters.

To manually execute, run the following (where the current directory contains the file `config.query.yaml`):

```sh
docker run --net=host -v "$PWD":/app/tmp -it \
  graphql-bench-local subscription \
  --config="./tmp/config.subscription.yaml" \
```

##### Run Locally

```sh
cd cli
yarn install
./bin/run subscription --config="<subscription YAML config file path here>"
```

##### Usage Guide

- Create events by making changes in the subscribed table
- As you create changes, you should notice the number of data events increasing in `stdout` output:
  ![](./subscriptions/example-stdout-output.png)
- Stop the benchmark with `ctrl + c`
- The script should say it has inserted the event data:

  ```
  ❯ Executing Teardown Process
  ❯ Starting to close socket connections
  ❯ Sockets closed, attempting to insert event data
  ❯ Inserted total of 10 events for label SearchAlbumsWithArtistUpdated
  ❯ Trying to close DB connection pool
  ❯ Database connection destroyed
  ❯ Now exiting the process
  ```

---

### Programmatic API

*Note: A good reference/usage demo exists at `/queries/src/tests.ts` and `/subscriptions/src/tests.ts`.*


#### Queries/Mutations

The easiest way of interacting with this library is to use the exported `BenchmarkRunner` class.

It exposes a single method, `.runBenchmarks()` which takes a `GlobalConfig` object defining the benchmarks to be run. Here's an example of running a `REQUESTS_PER_SECOND` benchmark for a query using all of `autocannon`, `k6`, and `wrk2`:

```ts
import { BenchmarkRunner } from './main'
import {
  GlobalConfig,
  BenchmarkTool,
  MaxRequestsInDurationBenchmark,
  FixedRequestNumberBenchmark,
  RequestsPerSecondBenchmark,
  MultiStageBenchmark,
  CustomBenchmark,
} from './executors/base/types'

const queries = {
  searchAlbumsWithArtist: `
    query SearchAlbumsWithArtist {
      albums(where: {title: {_like: "%Rock%"}}) {
        id
        title
        artist {
          name
          id
        }
      }
    }`,
}

const rpsBench: RequestsPerSecondBenchmark = {
  tools: [BenchmarkTool.AUTOCANNON, BenchmarkTool.K6, BenchmarkTool.WRK2],
  name: 'AlbumsArtistTrackGenreAll',
  execution_strategy: 'REQUESTS_PER_SECOND',
  duration: '3s',
  rps: 500,
  query: queries.albumsArtistTracksGenreAll,
}

const tests: GlobalConfig = {
  url: 'http://localhost:8085/v1/graphql',
  headers: { 'X-Hasura-Admin-Secret': 'my-secret' },
  queries: [rpsBench],
}

async function main() {
  const runner = new BenchmarkRunner(tests)
  const results = await runner.runBenchmarks()
  console.log('Test results:', results)
}

main()
```

#### Subscriptions

The `main` exported method from the Subscriptions repo is what runs the benchmarks. Here's an example of programmatically running a subscription test:

```ts
import { SubscriptionBenchConfig } from './utils'
import { main as runSubscriptionBenchmark } from './main'

const testConfig: SubscriptionBenchConfig = {
  url: 'http://localhost:8085/v1/graphql',
  db_connection_string:
    'postgres://postgres:postgrespassword@localhost:5430/postgres',
  headers: {
    'X-Hasura-Admin-Secret': 'my-secret',
  },
  config: {
    label: 'SearchAlbumsWithArtist',
    max_connections: 20,
    connections_per_second: 10,
    insert_payload_data: true,
    query: `
      subscription AlbumByIDSubscription($artistIds: [Int!]!) {
        albums(where: {artist_id: { _in: $artistIds}}) {
          id
          title
          updated_at
        }
      }
    `,
    variables: {
      artistIds: [1, 2, 3, 4],
    },
  },
}

async function main() {
  await runSubscriptionBenchmark(testConfig)
}

main()
```
