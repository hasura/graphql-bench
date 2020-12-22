import fs from 'fs-extra'
import path from 'path'
import yaml from 'js-yaml'

import {
  HDRHistogramParsedStats,
  BenchmarkMetrics,
  BenchmarkMetricParams,
  Benchmark,
  BenchmarkTool,
  CustomBenchmark,
  FixedRequestNumberBenchmark,
  GlobalConfig,
  MaxRequestsInDurationBenchmark,
  MultiStageBenchmark,
  RequestsPerSecondBenchmark,
} from './types'

export function parseHdrHistogramText(text: string): HDRHistogramParsedStats[] {
  let results: HDRHistogramParsedStats[] = []
  const lines = text.split('\n')
  for (let line of lines) {
    let entries = line.trim().split(/\s+/)
    let valid = entries.length == 4 && entries.every(Number)
    if (!valid) continue
    let [value, percentile, totalCount, ofOnePercentile] = entries
    results.push({ value, percentile, totalCount, ofOnePercentile })
  }
  return results
}

export function makeBenchmarkMetrics(
  params: BenchmarkMetricParams
): BenchmarkMetrics {
  const { name, histogram, time, requests, response } = params
  return {
    name,
    time,
    requests,
    response,
    histogram: {
      json: {
        ...histogram.toJSON(),
        mean: histogram.mean,
        stdDeviation: histogram.stdDeviation,
      },
      text: histogram.outputPercentileDistribution(),
      parsedStats: parseHdrHistogramText(
        histogram.outputPercentileDistribution()
      ),
    },
  }
}

/**
 * ========================
 * BASE CLASS
 * ========================
 */

/**
 * An abstract class which specific benchmark executors must implement
 * Provides shared functionality, common configuration options, and abstract function definitions
 */
export abstract class BenchmarkExecutor {
  // Each benchmark executor must mark their tool, used to check whether they're enabled for a query in "runBenchmarks"
  public abstract tool: BenchmarkTool
  public config: GlobalConfig

  /** Path to the configuration file to load */
  private configPath = path.join(__dirname, '../../config.yaml')
  /** Path to the reports directory */
  public baseReportPath = path.join(__dirname, '../../../reports')

  public localBinaryFolder = path.join(__dirname, '../../../bin')

  constructor(config?: GlobalConfig, configFilePath?: string) {
    this.config = config || this.readConfigFile(configFilePath)
  }

  // Returns "${queryName}-{toolName}" for marking benchmark result metrics
  // protected _getBrandedBenchmarkQueryName(queryName: string) {
  //   return `${queryName}-${this.tool}`
  // }

  protected _makeBenchmarkName(benchmark: Benchmark) {
    const baseName = `${benchmark.name}-${this.tool}`
    switch (benchmark.execution_strategy) {
      case 'CUSTOM':
        return `${baseName}-custom`
      case 'FIXED_REQUEST_NUMBER':
        return `${baseName}-${benchmark.requests}-fixed-requests`
      case 'REQUESTS_PER_SECOND':
        return `${baseName}-${benchmark.rps}rps`
      case 'MAX_REQUESTS_IN_DURATION':
        return `${baseName}-${benchmark.duration}-max-requests`
      case 'MULTI_STAGE':
        return `${baseName}-multistage`
    }
  }

  public readConfigFile(pathTo?: string): GlobalConfig {
    const configFile = fs.readFileSync(pathTo || this.configPath, 'utf-8')
    return yaml.load(configFile)
  }

  public async runBenchmark(benchmark: Benchmark) {
    switch (benchmark.execution_strategy) {
      case 'CUSTOM':
        return this.runCustomBench(benchmark)
      case 'REQUESTS_PER_SECOND':
        return this.runRequestsPerSecondBench(benchmark)
      case 'FIXED_REQUEST_NUMBER':
        return this.runFixedRequestNumberBench(benchmark)
      case 'MAX_REQUESTS_IN_DURATION':
        return this.runMaxRequestsInDurationBench(benchmark)
      // Catch and discard "NOT IMPLEMENTED" error, only available in k6
      case 'MULTI_STAGE': {
        try {
          return this.runMultiStageBench(benchmark)
        } catch (error) {
          break
        }
      }
    }
  }

  abstract runCustomBench(bench: CustomBenchmark): Promise<BenchmarkMetrics>
  abstract runMultiStageBench(
    bench: MultiStageBenchmark
  ): Promise<BenchmarkMetrics> | never
  abstract runRequestsPerSecondBench(
    bench: RequestsPerSecondBenchmark
  ): Promise<BenchmarkMetrics>
  abstract runFixedRequestNumberBench(
    bench: FixedRequestNumberBenchmark
  ): Promise<BenchmarkMetrics>
  abstract runMaxRequestsInDurationBench(
    bench: MaxRequestsInDurationBenchmark
  ): Promise<BenchmarkMetrics>
}
