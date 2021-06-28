import * as path from 'path'
import * as fs from 'fs-extra'
import * as yaml from 'js-yaml'

import { Command, flags } from '@oclif/command'
import { BenchmarkRunner } from '../../../queries/src/main'
import type { GlobalConfig } from '../../../queries/src/executors/base/types'

export default class Query extends Command {
  static description = 'benchmark queries or mutations'

  static examples = [
    `$ graphql-bench query --config ./config.query.yaml --outfile results.json`,
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    config: flags.string({
      char: 'c',
      required: true,
      multiple: false,
      description: 'Filepath to YAML config file for query benchmarks',
      parse: (filepath) => {
        const pathToFile = path.join(process.cwd(), filepath)
        const configFile = fs.readFileSync(pathToFile, 'utf-8')
        return yaml.load(configFile)
      },
    }),
    outfile: flags.string({
      char: 'o',
      required: false,
      multiple: false,
      description: 'Filepath to output JSON file containing benchmark stats',
    }),
    url: flags.string({
      required: false,
      multiple: false,
      description: 'URL to direct graphql queries; may override \'url\' from the YAML config, which is optional if this flag is passed',
    }),
    query: flags.string({
      required: false,
      multiple: false,
      description: 'A specific named query to run from the config; if omitted, all queries will be run',
    }),
  }

  async run() {
    const { flags } = this.parse(Query)

    // Oclif, can't figure out how to generically type flags =/
    const config = (flags.config as unknown) as GlobalConfig
    if (flags.url) {
      // config.url may be omitted, else will be overridden:
      config.url = flags.url
    }
    const executor = new BenchmarkRunner(config)
    const results = await executor.runBenchmarks(flags.query)

    if (flags.outfile) {
      const pathToOutfile = path.join(process.cwd(), flags.outfile)
      fs.outputJSONSync(pathToOutfile, results, {
        spaces: 2,
      })
    }
  }
}
