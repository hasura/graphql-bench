import type * as stream from 'stream'

import type Histogram from 'hdr-histogram-js/src/Histogram'
import type { HistogramSummary } from 'hdr-histogram-js/src/Histogram'

import type { K6Options } from '../k6/types'
import type { Stage as K6Stage } from 'k6/options'
import type { Options as AutocannonOptions } from 'autocannon'

/**
 * ========================
 * MAIN TYPES
 * ========================
 */

/**
 * The type of the query benchmark test being run
 */
export type ExecutionStrategy =
  | 'REQUESTS_PER_SECOND'
  | 'FIXED_REQUEST_NUMBER'
  | 'MAX_REQUESTS_IN_DURATION'
  | 'MULTI_STAGE'
  | 'CUSTOM'

/**
 * Shared configuration between all benchmark runs
 */
export interface GlobalConfig {
  url: string
  headers?: Record<string, any>
  queries: Benchmark[]
  /** When true, will log all HTTP responses */
  debug?: boolean
  /**
   * Optional writable stream, can be used to stream results from process to HTML responses
   * @example
   * app.get('/path', (req, res) => {
   *   var child = spawn('ls', ['-al'])
   *   child.stdout.pipe(res)
   * })
   */
  writeStream?: stream.Writable
}

export enum BenchmarkTool {
  AUTOCANNON = 'autocannon',
  K6 = 'k6',
  WRK2 = 'wrk2',
}

/**
 * Unused base class with shared attributes that specific types of benchmark configs extend
 */
interface _BenchmarkRunConfig {
  name: string
  tools: BenchmarkTool[]
  execution_strategy: ExecutionStrategy
  query: string
  variables?: Record<string, any>
  connections?: number
  variable_file?: VariableFile
}

export interface VariableFile {
  file_path: string
}

/**
 * Config for a benchmark with requests per second for a duration
 */
export interface RequestsPerSecondBenchmark extends _BenchmarkRunConfig {
  execution_strategy: 'REQUESTS_PER_SECOND'
  rps: number
  duration: string
}

/**
 * Config for a benchmark that makes a fixed number of requests with no other constraints
 */
export interface FixedRequestNumberBenchmark extends _BenchmarkRunConfig {
  execution_strategy: 'FIXED_REQUEST_NUMBER'
  requests: number
}

/**
 * Config for a benchmark that makes the maximum number of requests in a duration
 */
export interface MaxRequestsInDurationBenchmark extends _BenchmarkRunConfig {
  execution_strategy: 'MAX_REQUESTS_IN_DURATION'
  duration: string
}

/**
 * Config for a benchmark with multiple stages of requests per seconds and durations
 */
export interface MultiStageBenchmark extends _BenchmarkRunConfig {
  execution_strategy: 'MULTI_STAGE'
  initial_rps: number
  stages: K6Stage[]
}

/**
 * Config for a benchmark with fully custom attributes
 */
export interface CustomBenchmark extends _BenchmarkRunConfig {
  execution_strategy: 'CUSTOM'
  options: {
    k6?: K6Options
    autocannon?: AutocannonOptions
  }
}

/**
 * Supertype that represents the union of all possible benchmark configs
 */
export type Benchmark =
  | RequestsPerSecondBenchmark
  | FixedRequestNumberBenchmark
  | MaxRequestsInDurationBenchmark
  | MultiStageBenchmark
  | CustomBenchmark

/**
 * ========================
 * UTILITY TYPES
 * ========================
 */

export interface HDRHistogramParsedStats {
  value: string
  percentile: string
  totalCount: string
  ofOnePercentile: string
}

export interface HistogramSummaryWithMeanAndStdDev extends HistogramSummary {
  mean: number
  stdDeviation: number
}

export interface BenchmarkMetrics {
  name: string
  time: {
    start: string | Date
    end: string | Date
  }
  requests: {
    count: number
    average: number
  }
  response: {
    totalBytes: number
    bytesPerSecond: number
  }
  histogram: {
    json: HistogramSummaryWithMeanAndStdDev
    text: string
    parsedStats: HDRHistogramParsedStats[]
  }
}

export interface BenchmarkMetricParams {
  name: string
  histogram: Histogram
  time: {
    start: Date | string
    end: Date | string
  }
  requests: {
    count: number
    average: number
  }
  response: {
    totalBytes: number
    bytesPerSecond: number
  }
}
