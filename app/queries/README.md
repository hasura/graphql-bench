# Example `config.yaml`:

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

# Custom benchmark config options:

Each tool has it's own set of unique config options. See below for the full spec and examples.
```yaml
url: 'http://localhost:8085/v1/graphql'
headers:
  X-Hasura-Admin-Secret: my-secret
queries:
  - name: SearchAlbumsWithArtist
    execution_strategy: CUSTOM
    tools: [k6, autocannon] # add the tools that will be added in options
    options:
      k6:
        # /** Discard response bodies. CAREFUL! This causes graphql errors to be ignored */
        # discardResponseBodies?: boolean;

        # /** Third party collector configuration. */
        # ext?: { [name: string]: CollectorOptions };

        # /** Static hostname mapping. */
        # hosts?: { [name: string]: string };

        # /** Log all HTTP requests and responses. */
        # httpDebug?: string;

        # /** Disable TLS verification. Insecure. */
        # insecureSkipTLSVerify?: boolean;

        # /** Maximum HTTP redirects to follow. */
        # maxRedirects?: number;

        # /** Minimum test iteration duration. */
        # minIterationDuration?: string;

        # /** Disable keepalive connections. */
        # noConnectionReuse?: boolean;

        # /** Disable usage reports. */
        # noUsageReport?: boolean;

        # /** Disable cross-VU TCP connection reuse. */
        # noVUConnectionReuse?: boolean;

        # /** Maximum requests per second across all VUs. */
        # rps?: number;

        # /** Setup function timeout. */
        # setupTimeout?: string;

        # /** Define stats for trend metrics. */
        # summaryTrendStats?: string[];

        # /** Which system tags to include in collected metrics. */
        # systemTags?: string[];

        # /** Tags to set test wide across all metrics. */
        # tags?: { [name: string]: string };

        # /** Teardown function timeout. */
        # teardownTimeout?: string;

        # /** Threshold specifications. Defines pass and fail conditions. */
        # thresholds?: { [name: string]: Threshold[] };

        # /** Throw error on failed HTTP request. */
        # throw?: boolean;

        # /** TLS client certificates. */
        # tlsAuth?: Certificate[];

        # /** Allowed TLS cipher suites. */
        # tlsCipherSuites?: CipherSuite[];

        # /** Allowed TLS version. Use `http.SSL_*` `http.TLS_*` constants. */
        # tlsVersion?: string | { min: string; max: string };

        # /** User agent string to include in HTTP requests. */
        # userAgent?: string;

        # scenarios
        scenarios:
           main: {
              executor: 'constant-arrival-rate',
              rate: 200, timeUnit: '1s', # 200 requests per second, i.e. 1.5 RPS
              duration: '30s',
              preAllocatedVUs: 10, # the size of the VU (i.e. worker) pool for this scenario
          }
      autocannon:
        # /**
        #   * The number of concurrent connections.
        #   * @default 10
        #   */
        # connections?: number;

        # /**
        #   * The number of seconds to run the autocannon.
        #   * Can be a [timestring](https://www.npmjs.com/package/timestring).
        #   * @default 10
        #   */
        # duration?: number | string;

        # /**
        #   * A `Number` stating the amount of requests to make before ending the test.
        #   * This overrides duration and takes precedence, so the test won't end
        #   * until the amount of requests needed to be completed are completed.
        #   */
        # amount?: number;

        # /**
        #   * The number of seconds to wait for a response before timeout.
        #   * @default 10
        #   */
        # timeout?: number;

        # /**
        #   *  The number of [pipelined requests](https://en.wikipedia.org/wiki/HTTP_pipelining) for each connection.
        #   * Will cause the `Client` API to throw when greater than 1
        #   * @default 1
        #   */
        # pipelining?: number;

        # /**
        #   * The threshold of the number of errors when making the requests to the server before this instance bail's out.
        #   * This instance will take all existing results so far and aggregate them into the results.
        #   * If none passed here, the instance will ignore errors and never bail out.
        #   */
        # bailout?: number;

        # /**
        #   * The http method to use.
        #   * @default 'GET'
        #   */
        # method?: Request['method'];

        # /**
        #   * A `String` to be added to the results for identification.
        #   */
        # title?: string;

        # /**
        #   * An `Object` containing the headers of the request.
        #   * @default {}
        #   */
        # headers?: Request['headers'];

        # /**
        #   * A `Number` stating the max requests to make per connection.
        #   * `amount` takes precedence if both are set.
        #   */
        # maxConnectionRequests?: number;

        # /**
        #   * A `Number` stating the max requests to make overall.
        #   * Can't be less than `connections`.
        #   */
        # maxOverallRequests?: number;

        # /**
        #   * A `Number` stating the rate of requests to make per second from each individual connection.
        #   * No rate limiting by default.
        #   */
        # connectionRate?: number;

        # /**
        #   * A `Number` stating the rate of requests to make per second from all connections.
        #   * `connectionRate` takes precedence if both are set.
        #   * No rate limiting by default.
        #   */
        # overallRate?: number;

        # /**
        #   * A `Number` which makes the individual connections disconnect and reconnect to the server
        #   * whenever it has sent that number of requests.
        #   */
        # reconnectRate?: number;

        # /**
        #   * An `Array` of `Objects` which represents the sequence of requests to make while benchmarking.
        #   * Can be used in conjunction with the `body`, `headers` and `method` params above.
        #   *
        #   * The `Objects` in this array can have `body`, `headers`, `method`, or `path` attributes, which overwrite those that are passed in this `opts` object.
        #   * Therefore, the ones in this (`opts`) object take precedence and should be viewed as defaults.
        #   */
        # requests?: Request[];

        # /**
        #   * A `Boolean` which enables the replacement of `[<id>]` tags within the request body with a randomly generated ID,
        #   * allowing for unique fields to be sent with requests.
        #   * @default false
        #   */
        # idReplacement?: boolean;

        # /**
        #   * A `Boolean` which allows you to setup an instance of autocannon that restarts indefinitely after emiting results with the `done` event.
        #   * Useful for efficiently restarting your instance. To stop running forever, you must cause a `SIGINT` or call the `.stop()` function on your instance.
        #   * @default false
        #   */
        # forever?: boolean;

        # /**
        #   * A `String` identifying the server name for the SNI (Server Name Indication) TLS extension.
        #   */
        # servername?: string;

        # /**
        #   * A `Boolean` which allows you to disable tracking non 2xx code responses in latency and bytes per second calculations.
        #   * @default false
        #   */
        # excludeErrorStats?: boolean;
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
```
