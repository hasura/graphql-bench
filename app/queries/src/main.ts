import { AutocannonExecutor } from './executors/autocannon/index'
import { K6Executor } from './executors/k6/index'
import { Wrk2Executor } from './executors/wrk2/index'

import {
  GlobalConfig,
  BenchmarkTool,
  BenchmarkMetrics,
} from './executors/base/types'

export class BenchmarkRunner {
  constructor(public config: GlobalConfig) {}

  public async runBenchmarks() {
    let results: BenchmarkMetrics[] = []

    for (let query of this.config.queries) {
      for (let tool of query.tools) {
        switch (tool) {
          case BenchmarkTool.AUTOCANNON: {
            const executor = new AutocannonExecutor(this.config)
            const metrics = await executor.runBenchmark(query)
            results.push(metrics)
            break
          }
          case BenchmarkTool.K6: {
            const executor = new K6Executor(this.config)
            const metrics = await executor.runBenchmark(query)
            results.push(metrics)
            break
          }
          case BenchmarkTool.WRK2: {
            const executor = new Wrk2Executor(this.config)
            const metrics = await executor.runBenchmark(query)
            results.push(metrics)
            break
          }
        }
      }
    }

    return results
  }
}
