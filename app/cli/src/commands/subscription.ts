import * as path from 'path'
import * as fs from 'fs-extra'
import * as yaml from 'js-yaml'

import { Command, flags } from '@oclif/command'
import { main as runSubscriptionBenchmark } from '../../../subscriptions/src/main'
import { SubscriptionBenchConfig } from '../../../subscriptions/src/utils'

export default class Subscription extends Command {
  static description = 'benchmark subscriptions'

  static examples = [
    `$ graphql-bench subscription --config ./config.subscription.yaml`,
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    config: flags.string({
      char: 'c',
      required: true,
      multiple: false,
      description: 'Filepath to YAML config file for subscription benchmarks',
      parse: (filepath) => {
        const pathToFile = path.join(process.cwd(), filepath)
        const configFile = fs.readFileSync(pathToFile, 'utf-8')
        return yaml.load(configFile)
      },
    }),
  }

  async run() {
    const { flags } = this.parse(Subscription)

    await runSubscriptionBenchmark(
      (flags.config as unknown) as SubscriptionBenchConfig
    )
  }
}
