/**
 * ========================
 * WRK2
 * ========================
 */

import {
  RunWrk2Metadata,
  Wrk2BinaryArgs,
  WrkStatsToBenchmarkMetricParams,
} from './types'

import {
  BenchmarkTool,
  CustomBenchmark,
  FixedRequestNumberBenchmark,
  MaxRequestsInDurationBenchmark,
  MultiStageBenchmark,
  RequestsPerSecondBenchmark,
  BenchmarkMetrics,
} from '../base/types'

import { parseHdrHistogramText, BenchmarkExecutor } from '../base'

import path from 'path'
import fs from 'fs-extra'
import execa from 'execa'
import { lookpath } from 'lookpath'

export class Wrk2Executor extends BenchmarkExecutor {
  public tool = BenchmarkTool.WRK2
  private reportPath = path.join(this.baseReportPath, 'wrk2')

  private _wrk2OutputToBenchmarkMetric(
    params: WrkStatsToBenchmarkMetricParams
  ): BenchmarkMetrics {
    const { name, stats, start, end, hdrHistogramStdout } = params
    const findPercentile = (stats, number) =>
      stats.latency_distribution.find((it) => it.percentile == number)
    return {
      name,
      requests: {
        average: stats.requests_per_second,
        count: stats.requests,
      },
      response: {
        totalBytes: stats.bytes,
        bytesPerSecond: stats.bytes_transfer_per_second,
      },
      time: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      histogram: {
        parsedStats: parseHdrHistogramText(hdrHistogramStdout),
        json: {
          totalCount: stats.requests,
          max: stats.latency_aggregate.max,
          mean: stats.latency_aggregate.mean,
          min: stats.latency_aggregate.min,
          stdDeviation: stats.latency_aggregate.stdev,
          p50: findPercentile(stats, 50).latency_in_milliseconds,
          p75: findPercentile(stats, 75).latency_in_milliseconds,
          p90: findPercentile(stats, 90).latency_in_milliseconds,
          p97_5: findPercentile(stats, 97.5).latency_in_milliseconds,
          p99: findPercentile(stats, 99).latency_in_milliseconds,
          p99_9: findPercentile(stats, 99.9).latency_in_milliseconds,
          p99_99: findPercentile(stats, 99.9).latency_in_milliseconds,
          p99_999: findPercentile(stats, 99.999).latency_in_milliseconds,
        },
      },
    }
  }

  /**
   * Returns the HDR Histogram text produced by wrk from it's stdout
   */
  private _getHdrHistogramFromWrkStdout(stdout: string) {
    const startStr = '       Value   Percentile   TotalCount 1/(1-Percentile)'
    const endStr = '----------------------------------------------------------'
    const start = stdout.indexOf(startStr)
    const end = stdout.indexOf(endStr)
    const hdrHistogram = stdout.substring(start, end)
    return hdrHistogram
  }

  public runCustomBench(bench: CustomBenchmark): never {
    throw new Error('Work in progress')
  }

  public runFixedRequestNumberBench(bench: FixedRequestNumberBenchmark): never {
    throw new Error('Fixed request benchmark not possible with wrk2')
  }

  public runMultiStageBench(bench: MultiStageBenchmark): never {
    throw new Error('Multi stage benchmark not possible with wrk2')
  }

  public async runMaxRequestsInDurationBench(
    bench: MaxRequestsInDurationBenchmark
  ) {
    const queryName = this._makeBenchmarkName(bench)
    const metadata = {
      queryName,
      outputFile: `${queryName}.json`,
    }

    return this._runWrk2(metadata, {
      url: this.config.url,
      options: {
        script: './graphql-bench.lua',
        latency: true,
        duration: bench.duration,
        // Ludicrous rate that should never be possible to try to emulate max rate, since wrk2 doesn't support this natively
        rate: 1000000,
      },
      config: {
        query: bench.query,
        variables: bench.variables,
        headers: this.config.headers,
      },
    })
  }

  public async runRequestsPerSecondBench(bench: RequestsPerSecondBenchmark) {
    const queryName = this._makeBenchmarkName(bench)
    console.log('Wrk2, runRequestsPerSecondBench:')
    console.log('Bench:', bench)
    console.log('queryName:', queryName)
    const metadata = {
      queryName,
      outputFile: `${queryName}.json`,
    }
    return this._runWrk2(metadata, {
      url: this.config.url,
      options: {
        script: path.join(this.localBinaryFolder, '/wrk/graphql-bench.lua'),
        latency: true,
        duration: bench.duration,
        rate: bench.rps,
      },
      config: {
        query: bench.query,
        variables: bench.variables,
        headers: this.config.headers,
      },
    })
  }

  /**
   * Makes the `spawn` CLI input argument array for "wrk (options) (url) -- (args)"
   */
  private _makeWrk2CmdArgs(params: Wrk2BinaryArgs) {
    let args = []
    for (let [key, val] of Object.entries(params.options)) {
      // If it's a boolean value, it's a flag and we should just pass the flag itself
      if (typeof val == 'boolean' && val == true) args.push('--' + key)
      // Else pass the flag and the value
      else args.push('--' + key, val)
    }
    args.push(params.url, '--', JSON.stringify(params.config))
    return args
  }

  private async getBinaryPath() {
    const defaultPath = await lookpath('wrk')
    if (defaultPath) return defaultPath
    const localWrkBinary = path.join(this.localBinaryFolder, 'wrk/wrk')
    const localBinaryExists = await fs.pathExists(localWrkBinary)
    if (localBinaryExists) return localWrkBinary
    throw new Error(
      'Could not find wrk binary either globally in $PATH or in local ./bin/wrk folder'
    )
  }

  private async _runWrk2(metadata: RunWrk2Metadata, config: Wrk2BinaryArgs) {
    const wrkPath = await this.getBinaryPath()
    const start = new Date()
    const wrk = execa(wrkPath, this._makeWrk2CmdArgs(config), {
      env: {
        // This is a bit hairy. We need the "graphql-bench.lua" script to be able to call require("json").
        // By default, Lua files can "require" any other file in the same directory the program was run from. The "module context" is "./".
        // The way that Lua modules work is that it tries to substitute the name of the require()'d module with any "?" character in each pattern in LUA_PATH.
        // (Patterns are separated by semicolons)
        // So what we need to do is call wrk and set up LUA_PATH with a pattern that when "?" is filled in with "json" it points to the "json.lua" file.
        // To do this, we need to point it to the absolute path of:
        //  ./app/queries/bin/wrk/json.lua
        // So, to accomplish this we set LUA_PATH to:
        //  ./app/queries/bin/wrk/?.lua
        LUA_PATH: path.join(this.localBinaryFolder, 'wrk', '?.lua;;'),
      },
    })
    wrk.stdout.pipe(process.stdout)
    const output = await wrk
    const end = new Date()

    const stats = JSON.parse(output.stderr)
    // Also emits these same stats to stderr, so could make script not write stat file and just read from there
    // const stats: Wrk2StatsOutputJson = await fs.readJSON('/tmp/wrk2-stats.json')
    if (!stats) throw new Error('Failed reading stats output from wrk stderr')

    // Write wrk2 results object to report file in folder
    const outfile = path.join(this.reportPath, metadata.outputFile)
    fs.outputJSONSync(outfile, stats, { spaces: 2 })

    const hdrHistogramStdout = this._getHdrHistogramFromWrkStdout(output.stdout)
    const metrics = this._wrk2OutputToBenchmarkMetric({
      name: metadata.queryName,
      start,
      end,
      stats,
      hdrHistogramStdout,
    })

    return metrics
  }
}
