/**
 * ========================
 * AUTOCANNON
 * ========================
 */

import { makeBenchmarkMetrics, BenchmarkExecutor } from "../base";

import {
  BenchmarkMetrics,
  Benchmark,
  BenchmarkTool,
  CustomBenchmark,
  FixedRequestNumberBenchmark,
  MaxRequestsInDurationBenchmark,
  MultiStageBenchmark,
  RequestsPerSecondBenchmark,
} from "../base/types";

import { RunAutocannonMetadata } from "./types";

import autocannon, { Client, Request } from "autocannon";
import { Options as AutocannonOptions } from "autocannon";

import fs from "fs-extra";
import path from "path";
import * as hdr from "hdr-histogram-js";
import { Utils } from "../base/utils";

export class AutocannonExecutor extends BenchmarkExecutor {
  public tool = BenchmarkTool.AUTOCANNON;
  private reportPath = path.join(this.baseReportPath, "autocannon");

  private benchMarkConfig: Benchmark;
  private fileVariables: any[];
  private fileVariablesCurrentIndex = 0;

  private _makeSharedFields(bench: Benchmark): AutocannonOptions {
    return {
      url: this.config.url,
      connections: bench.connections || 10,
      /**
       * Sets the request body in each client. No. of clients created = no. of connections.
       * For each client iterate over the variables (one row) read from the CSV file and set it in the request, thus each client queries with different variables.
       * Suggested number of rows in CSV  = Number of connections. 
       * @param client Autocannon client
       */
      setupClient: (client) => {
        // If debug, log each response body
        if (this.config.debug) {
          client.on("body", console.log);
        }
        if (this.fileVariablesCurrentIndex >= this.fileVariables.length) {
          this.fileVariablesCurrentIndex = 0;
        }
        let req: Request = {
          headers: this.config.headers,
          method: "POST",
          body: JSON.stringify({
            query: this.benchMarkConfig.query,
            variables: { ...this.benchMarkConfig.variables, ...this.fileVariables[this.fileVariablesCurrentIndex] },
          }),
        };
        client.setRequest(req);
        this.fileVariablesCurrentIndex++;
      }
    };
  }

  

  private _generateAutocannonMetadata(bench: Benchmark): RunAutocannonMetadata {
    const queryName = this._makeBenchmarkName(bench)
    return {
      queryName,
      outputFile: `${queryName}.json`
    }
  }

  private async _generateAutoCannonOptions(bench: Benchmark): Promise<autocannon.Options> {
    this.benchMarkConfig = bench;
    this.fileVariables = await Utils.readVariablesFromFile(bench);

    return this._makeSharedFields(bench)
  }

  public async runCustomBench(bench: CustomBenchmark) {
    const baseOpts = await this._generateAutocannonMetadata(bench);
    const metadata = this._generateAutocannonMetadata(bench)
    return this._runAutocannon(metadata, {
      ...baseOpts,
      ...bench.options.autocannon,
    });
  }

  public runMultiStageBench(bench: MultiStageBenchmark): never {
    throw new Error("Not Implemented");
  }

  public async runRequestsPerSecondBench(bench: RequestsPerSecondBenchmark) {

    const baseOpts = await this._generateAutoCannonOptions(bench)
    const metadata = this._generateAutocannonMetadata(bench);
    return this._runAutocannon(metadata, {
      ...baseOpts,
      duration: bench.duration,
      overallRate: bench.rps,
    })
  }

  public async runFixedRequestNumberBench(bench: FixedRequestNumberBenchmark) {
    const baseOpts = await this._generateAutoCannonOptions(bench)
    const metadata = this._generateAutocannonMetadata(bench);
    return this._runAutocannon(metadata, {
      ...baseOpts,
      amount: bench.requests,
    });
  }

  public async runMaxRequestsInDurationBench(bench: MaxRequestsInDurationBenchmark) {
    const baseOpts = await this._generateAutoCannonOptions(bench)
    const metadata = this._generateAutocannonMetadata(bench);
    return this._runAutocannon(metadata, {
      ...baseOpts,
      duration: bench.duration,
    });
  }

  // TODO: use worker threads, that means any function input to autocannon ned to go to separate js files which are "require"able
  private async _runAutocannon(
    metadata: RunAutocannonMetadata,
    config: AutocannonOptions
  ) {
    const { queryName, outputFile } = metadata;

    const instance = autocannon(config, (err, results) => {
      if (err) throw err;
    });

    const histogram = hdr.build();
    instance.on("response", (client, statusCode, resBytes, responseTime) => {
      histogram.recordValue(responseTime);
    });

    autocannon.track(instance, {
      outputStream: this.config.writeStream || process.stdout,
      renderProgressBar: true,
      renderLatencyTable: true,
      renderResultsTable: true,
    });

    // Wrap this in a Promise to force waiting for Autocannon run to finish
    return new Promise<BenchmarkMetrics>((resolve) => {
      instance.on("done", (results) => {
        // Write Autocannon results object to output file
        const outfile = path.join(this.reportPath, outputFile);
        fs.outputJSONSync(outfile, results);
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
        });
        resolve(metrics);
      });
    });
  }
}
