/**
 * Type for the invocation of wrk2 CLI:
 * "Usage: wrk <options> <url>"
 */
export interface Wrk2BinaryArgs {
  url: string
  options: Wrk2Options
  config: {
    query: string
    variables?: Record<string, any>
    headers?: Record<string, any>
  }
}

/**
 * Numeric <N> arguments may include a SI unit (1k, 1M, 1G)
 * Time <T> arguments may include a time unit (2s, 2m, 2h)
 */
export interface Wrk2Options {
  /**
   * -c, --connections <N>  Connections to keep open
   * @default 10
   */
  connections?: string | number
  /**
   * -d, --duration    <T>  Duration of test
   * @default '10s'
   */
  duration?: string | number
  /**
   * -t, --threads     <N>  Number of threads to use
   * @default 2
   */
  threads?: string | number
  /**
   * Path to Lua script on disk
   * -s, --script      <S>  Load Lua script file
   */
  script?: string
  /**
   * -H, --header      <H>  Add header to request
   */
  header?: string
  /**
   * -L  --latency          Print latency statistics
   */
  latency?: boolean
  /**
   * -U  --u_latency        Print uncorrected latency statistics
   */
  u_latency?: boolean
  /**
   *     --timeout     <T>  Socket/request timeout
   */
  timeout?: string | number
  /**
   * -B, --batch_latency    Measure latency of whole batches of pipelined ops (as opposed to each op)
   */
  batch_latency?: boolean
  /**
   * -v, --version          Print version details
   */
  version?: boolean
  /**
   * -R, --rate        <T>  work rate (throughput) in requests/sec (total)
   */
  rate: string | number
}

/**
 * Output type
 */
export interface Wrk2StatsOutputJson {
  duration_in_milliseconds: number
  requests: number
  bytes_transfer_per_second: number
  latency_aggregate: LatencyAggregate
  latency_distribution: LatencyDistribution[]
  bytes: number
  requests_per_second: number
}

export interface LatencyAggregate {
  min: number
  max: number
  mean: number
  stdev: number
}

export interface LatencyDistribution {
  percentile: 50 | 75 | 90 | 95 | 97.5 | 99 | 99.9 | 99.99 | 99.999 | 100
  latency_in_milliseconds: number
}

export interface WrkStatsToBenchmarkMetricParams {
  name: string
  stats: Wrk2StatsOutputJson
  start: Date
  end: Date
  hdrHistogramStdout: string
}

export interface RunWrk2Metadata {
  queryName: string
  outputFile?: string
}
