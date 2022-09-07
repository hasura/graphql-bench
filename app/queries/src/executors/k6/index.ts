import * as fs from 'fs-extra'
import * as path from 'path'
import * as cp from 'child_process'
import * as hdr from '../../PreciseHdrHistogram'
import readline from 'readline'

import {
  BenchmarkTool,
  Benchmark,
  CustomBenchmark,
  FixedRequestNumberBenchmark,
  MaxRequestsInDurationBenchmark,
  MultiStageBenchmark,
  RequestsPerSecondBenchmark,
  HistBucket,
} from '../base/types'

import {
  K6Options,
  RampingArrivalRateExecutor,
  ConstantArrivalRateExecutor,
  PerVUIterationsExecutor,
  ConstantVUExecutor,
  K6Metric,
  K6Point,
  K6Summary,
} from './types'

import { BenchmarkExecutor, makeBenchmarkMetrics } from '../base'

import execa from 'execa'
import { lookpath } from 'lookpath'

interface RunK6Metadata {
  queryName: string
  outputFile: string
}

export class K6Executor extends BenchmarkExecutor {
  public tool = BenchmarkTool.K6

  private k6BinaryPath = path.join(__dirname, 'k6', 'k6')
  private reportPath = path.join(this.baseReportPath, 'k6')

  public runCustomBench(bench: CustomBenchmark) {
    // Need to set the url, headers, query, and variables ENV or it won't work
    if (bench.options.k6?.scenarios) {
      for (let scenario in bench.options.k6?.scenarios) {
        bench.options.k6.scenarios[scenario].env = this._makeScenarioEnv(bench)
      }
    }

    const queryName = this._makeBenchmarkName(bench)
    const metadata = {
      queryName,
      outputFile: `${queryName}.json`,
    }

    return this._runK6(metadata, bench.options.k6 as K6Options)
  }

  public runMultiStageBench(bench: MultiStageBenchmark) {
    const scenario: RampingArrivalRateExecutor = {
      executor: 'ramping-arrival-rate',
      startRate: bench.initial_rps,
      timeUnit: '1s',
      preAllocatedVUs: bench.connections || 10,
      stages: bench.stages,
      env: this._makeScenarioEnv(bench),
    }

    const queryName = this._makeBenchmarkName(bench)
    const metadata = {
      queryName,
      outputFile: `${queryName}.json`,
    }

    return this._runK6(metadata, {
      scenarios: {
        [bench.name]: scenario,
      },
    })
  }

  public runRequestsPerSecondBench(bench: RequestsPerSecondBenchmark) {
    const scenario: ConstantArrivalRateExecutor = {
      executor: 'constant-arrival-rate',
      rate: bench.rps,
      timeUnit: '1s',
      duration: bench.duration,
      preAllocatedVUs: bench.connections || 10,
      env: this._makeScenarioEnv(bench),
    }

    const queryName = this._makeBenchmarkName(bench)
    const metadata = {
      queryName,
      outputFile: `${queryName}.json`,
    }

    return this._runK6(metadata, {
      scenarios: {
        [bench.name]: scenario,
      },
    })
  }

  public runFixedRequestNumberBench(bench: FixedRequestNumberBenchmark) {
    const scenario: PerVUIterationsExecutor = {
      executor: 'per-vu-iterations',
      iterations: bench.requests / (bench.connections || 10),
      vus: bench.connections || 10,
      env: this._makeScenarioEnv(bench),
    }

    const queryName = this._makeBenchmarkName(bench)
    const metadata = {
      queryName,
      outputFile: `${queryName}.json`,
    }

    return this._runK6(metadata, {
      scenarios: {
        [bench.name]: scenario,
      },
    })
  }

  public runMaxRequestsInDurationBench(bench: MaxRequestsInDurationBenchmark) {
    const scenario: ConstantVUExecutor = {
      executor: 'constant-vus',
      duration: bench.duration,
      vus: bench.connections || 10,
      env: this._makeScenarioEnv(bench),
    }

    const queryName = this._makeBenchmarkName(bench)
    const metadata = {
      queryName,
      outputFile: `${queryName}.json`,
    }

    return this._runK6(metadata, {
      scenarios: {
        [bench.name]: scenario,
      },
    })
  }

  /**
   * Must return non-nested JSON for k6, hence the need to stringify headers and variables
   */
  private _makeScenarioEnv(bench: Benchmark) {
    return {
      url: this.config.url,
      query: bench.query,
      headers: JSON.stringify(this.config.headers),
      variables: JSON.stringify(bench.variables),
    }
  }

  private async getBinaryPath() {
    const defaultPath = await lookpath('k6')
    if (defaultPath) return defaultPath
    const localK6Binary = path.join(this.localBinaryFolder, 'k6/k6')
    const localBinaryExists = await fs.pathExists(localK6Binary)
    if (localBinaryExists) return localK6Binary
    throw new Error(
      'Could not find K6 binary either globally in $PATH or in local ./bin/k6 folder'
    )
  }

  /**
   * Internal method for calling the actual benchmark run, dispatched from the more specific benchmark functions
   */
  private async _runK6(metadata: RunK6Metadata, config: K6Options) {
    const { queryName, outputFile } = metadata

    // If "debug" true, log all HTTP responses
    if (this.config.debug) config.httpDebug = 'full'

    // Write the K6 configuration JSON to a temp file, to pass as CLI flag
    const tmpDir = path.join(__dirname, 'tmp')
    const tmpConfig = path.join(tmpDir, `${queryName}_config.json`)
    await fs.outputJSON(tmpConfig, config)

    // outPath is where the JSON report stats will go, scriptFile points K6 to the JS script for the load test
    const outPath = path.join(this.reportPath, outputFile)
    const scriptFile = path.join(this.localBinaryFolder, 'k6/loadScript.js')
    const rawStatsFilePath = path.join(tmpDir, 'k6_raw_stats.json')

    // Make sure the directory exists, or K6 will fail when writing
    await fs.ensureFile(outPath)

    // Invoke 'k6 run <scriptFile path> --config <tmpConfig path> --summary-export <outPath>'
    const baseOpts: string[] = []
    baseOpts.push('run', scriptFile)
    baseOpts.push('--config', tmpConfig)
    baseOpts.push('--out', 'json=' + rawStatsFilePath)
    baseOpts.push('--summary-export', outPath)

    const k6Binary = await this.getBinaryPath()

    const benchmarkStart = new Date()
    await execa(k6Binary, baseOpts, { stdio: 'inherit' })
    const benchmarkEnd = new Date()

    // Create a line-reader to read each line of the JSONL format K6 logs
    // Note: we use the crlfDelay option to recognize all instances of CR LF
    // ('\r\n') in input.txt as a single line break
    const fileStream = fs.createReadStream(rawStatsFilePath)
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    })

    // We'll build an hdr histogram of HTTP Request durations
    const hdrHistogram = hdr.build()
    // ...and record raw durations for processing:
    var reqDurations: number[] = []

    for await (const line of rl) {
      const stat: K6Metric | K6Point = JSON.parse(line)
      // filter for just service time of successful queries:
      if (stat.type != 'Point') continue
      if (stat.metric != 'http_req_duration') continue
      if (Number(stat.data.tags.status) < 200) continue
      hdrHistogram.recordValue(stat.data.value)

      reqDurations.push(stat.data.value)
    }

    // Remove the temp config file with the K6 run parameters, and logging stats
    await fs.remove(tmpConfig)
    await fs.remove(rawStatsFilePath)

    // Return the JSON output stats produced by K6 for bench
    const jsonStats: K6Summary = fs.readJSONSync(outPath)
    const metrics = makeBenchmarkMetrics({
      name: metadata.queryName,
      histogram: hdrHistogram,
      basicHistogram: histogram(200, reqDurations),
      time: {
        start: benchmarkStart.toISOString(),
        end: benchmarkEnd.toISOString(),
      },
      requests: {
        count: jsonStats.metrics.http_reqs.count,
        average: jsonStats.metrics.http_reqs.rate,
      },
      response: {
        totalBytes: jsonStats.metrics.data_received.count,
        bytesPerSecond: jsonStats.metrics.data_received.rate,
      },
      geoMean: geoMean(reqDurations)
    })

    return metrics
  }
}

// geometric mean, with exponent distributed over product so we don't overflow 
function geoMean(xs: number[]): number {
    return xs.map(x => Math.pow(x, 1/xs.length)).reduce((acc, x) => acc * x)
}

// NOTE: To save space and aid readability we’ll filter out any buckets with a
// count of 0 that follow a bucket with a count of 0. This can still be graphed
// fine without extra accommodations using a stepped line plot, as we plan
function histogram(numBuckets: number, xs: number[]): HistBucket[] {
    if (numBuckets < 1 || xs.length < 2) { throw "We need at least one bucket and xs.length > 1" }
    
    var xsSorted = new Float64Array(xs) // so sort works properly
    xsSorted.sort()
    
    const bucketWidth = (xsSorted[xsSorted.length - 1] - xsSorted[0]) / numBuckets
     
    var buckets = []
    for (let gte = xsSorted[0] ; true ; gte+=bucketWidth) {
        // Last bucket; add remaining and stop
        if (buckets.length === (numBuckets-1)) {
            buckets.push({gte, count: xsSorted.length})
            break
        }
        var count = 0
        var ixNext
        // this should always consume as least one value:
        xsSorted.some((x, ix) => {
            if (x < (gte+bucketWidth)) {
                 count++
                 return false // i.e. keep looping
            } else {
                 ixNext = ix
                 return true
            }
        })
        if (ixNext === undefined) {throw "Bugs in histogram!"}
        xsSorted = xsSorted.slice(ixNext)
        buckets.push({gte, count})
    }
    // having at most one 0 bucket in a row, i.e. `{gte: n, count: 0}` means
    // "This and all higher buckets are empty"
    var bucketsSparse = []
    var inAZeroSpan = false
    buckets.forEach( b => {
        if (inAZeroSpan && b.count === 0) {
            // drop this bucket
        } else if (!inAZeroSpan && b.count === 0) {
            // include this zero buckets but not subsequent zero buckets
            bucketsSparse.push(b)
            inAZeroSpan = true
        } else {
            inAZeroSpan = false
            bucketsSparse.push(b)
        }
    })

    return bucketsSparse
}
