/**
 * ========================
 * AUTOCANNON
 * ========================
 */

import { makeBenchmarkMetrics, BenchmarkExecutor } from '../base'

import {
  BenchmarkMetrics,
  Benchmark,
  BenchmarkTool,
  CustomBenchmark,
  FixedRequestNumberBenchmark,
  MaxRequestsInDurationBenchmark,
  MultiStageBenchmark,
  RequestsPerSecondBenchmark,
} from '../base/types'

import { RunAutocannonMetadata } from './types'

import autocannon from 'autocannon'
import { Options as AutocannonOptions } from 'autocannon'

import fs from 'fs-extra'
import path from 'path'
import * as hdr from 'hdr-histogram-js'

export class AutocannonExecutor extends BenchmarkExecutor {
  public tool = BenchmarkTool.AUTOCANNON
  private reportPath = path.join(this.baseReportPath, 'autocannon')

  private _makeSharedFields(bench: Benchmark): AutocannonOptions {
    return {
      url: this.config.url,
      headers: this.config.headers,
      method: 'POST',
      connections: bench.connections || 10,
      body: JSON.stringify({
        query: bench.query,
        variables: bench.variables,
      }),
    }
  }

  public runCustomBench(bench: CustomBenchmark) {
    const baseOpts = this._makeSharedFields(bench)
    const queryName = this._makeBenchmarkName(bench)
    const metadata = {
      queryName,
      outputFile: `${queryName}.json`,
    }
    return this._runAutocannon(metadata, {
      ...baseOpts,
      ...bench.options.autocannon,
    })
  }

  public runMultiStageBench(bench: MultiStageBenchmark): never {
    throw new Error('Not Implemented')
  }

  public runRequestsPerSecondBench(bench: RequestsPerSecondBenchmark) {
    const baseOpts = this._makeSharedFields(bench)
    const queryName = this._makeBenchmarkName(bench)
    const metadata = {
      queryName,
      outputFile: `${queryName}.json`,
    }
    return this._runAutocannon(metadata, {
      ...baseOpts,
      duration: bench.duration,
      overallRate: bench.rps,
    })
  }

  public runFixedRequestNumberBench(bench: FixedRequestNumberBenchmark) {
    const baseOpts = this._makeSharedFields(bench)
    const queryName = this._makeBenchmarkName(bench)
    const metadata = {
      queryName,
      outputFile: `${queryName}.json`,
    }
    return this._runAutocannon(metadata, {
      ...baseOpts,
      amount: bench.requests,
    })
  }

  public runMaxRequestsInDurationBench(bench: MaxRequestsInDurationBenchmark) {
    const baseOpts = this._makeSharedFields(bench)
    const queryName = this._makeBenchmarkName(bench)
    const metadata = {
      queryName,
      outputFile: `${queryName}.json`,
    }
    return this._runAutocannon(metadata, {
      ...baseOpts,
      duration: bench.duration,
    })
  }

  private async _runAutocannon(
    metadata: RunAutocannonMetadata,
    config: AutocannonOptions
  ) {
    const { queryName, outputFile } = metadata
    // If debug, log each response body
    if (this.config.debug)
      config.setupClient = (client) => client.on('body', console.log)

    const instance = autocannon(config, (err, results) => {
      if (err) throw err
    })

    const histogram = hdr.build()
    instance.on('response', (client, statusCode, resBytes, responseTime) => {
      histogram.recordValue(responseTime)
    })

    autocannon.track(instance, {
      outputStream: this.config.writeStream || process.stdout,
      renderProgressBar: true,
      renderLatencyTable: true,
      renderResultsTable: true,
    })

    // Wrap this in a Promise to force waiting for Autocannon run to finish
    return new Promise<BenchmarkMetrics>((resolve) => {
      instance.on('done', (results) => {
        // Write Autocannon results object to output file
        const outfile = path.join(this.reportPath, outputFile)
        fs.outputJSONSync(outfile, results)
        // Build and return Metrics object
        const metrics = makeBenchmarkMetrics({
          name: metadata.queryName,
          histogram,
          response: {
            totalBytes: results.throughput.total,
            bytesPerSecond: results.throughput.average,
          },
          time: {
            start: results.start,
            end: results.finish,
          },
          requests: {
            count: results.requests.total,
            average: results.requests.average,
          },
        })
        resolve(metrics)
      })
    })
  }
}
