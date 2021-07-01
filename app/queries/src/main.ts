import { AutocannonExecutor } from './executors/autocannon/index'
import { K6Executor } from './executors/k6/index'
import { Wrk2Executor } from './executors/wrk2/index'
import fetch from 'node-fetch'
import { RequestInfo } from 'node-fetch'

// Helper http client:
async function http(
  request: RequestInfo
): Promise<any> {
  const response = await fetch(request);
  const body = await response.json();
  return body;
}

import {
  GlobalConfig,
  BenchmarkTool,
  BenchmarkMetrics,
} from './executors/base/types'

export class BenchmarkRunner {
  constructor(public config: GlobalConfig) {}

  public async runBenchmarks(only_query?: string) {
    let results: BenchmarkMetrics[] = []

    for (let query of this.config.queries) {
      // Maybe run just a single requested benchmark from the config:
      if (only_query && query.name != only_query) continue

      for (let tool of query.tools) {
        // Get RTS stats before benchmarks:
        let bare_url = this.config.url.match("http.*//[^\/]*")[0] 
        let allocated_bytes_before
        let live_bytes_before
        let mem_in_use_bytes_before
        if (this.config.extended_hasura_checks) {
          const stats = await http(bare_url+'/dev/rts_stats')
          allocated_bytes_before  = stats.allocated_bytes
          live_bytes_before       = stats.gc.gcdetails_live_bytes
          mem_in_use_bytes_before = stats.gc.gcdetails_mem_in_use_bytes
        }

        switch (tool) {
          case BenchmarkTool.AUTOCANNON: {
            const executor = new AutocannonExecutor(this.config)
            var metrics = await executor.runBenchmark(query)
            break
          }
          case BenchmarkTool.K6: {
            const executor = new K6Executor(this.config)
            var metrics = await executor.runBenchmark(query)
            break
          }
          case BenchmarkTool.WRK2: {
            const executor = new Wrk2Executor(this.config)
            var metrics = await executor.runBenchmark(query)
            break
          }
        }

        // Get RTS stats after:
        if (this.config.extended_hasura_checks) {
          const stats = await http(bare_url+'/dev/rts_stats')
          let allocated_bytes_after  = stats.allocated_bytes
          let live_bytes_after       = stats.gc.gcdetails_live_bytes
          let mem_in_use_bytes_after = stats.gc.gcdetails_mem_in_use_bytes

          metrics.extended_hasura_checks = { 
            'bytes_allocated_per_request': 
              (allocated_bytes_after - allocated_bytes_before) / metrics.requests.count,
            live_bytes_before,
            live_bytes_after,
            mem_in_use_bytes_before,
            mem_in_use_bytes_after,
          }
        }

        results.push(metrics)
      }
    }

    return results
  }
}
