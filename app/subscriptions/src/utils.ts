import { SockerManagerConfig } from './main'
import yaml from 'js-yaml'
import fs from 'fs'
import path from 'path'

export const configFilePath =
  process.env.CONFIG_FILE_PATH || path.join(__dirname, './config.yaml')
export const configFile = fs.readFileSync(configFilePath, 'utf-8')
export const config: SubscriptionBenchConfig = yaml.load(configFile)

export const GQL = {
  START: 'start',
  STOP: 'stop',
  DATA: 'data',
  ERROR: 'error',
  COMPLETE: 'complete',
  CONNECTION_INIT: 'connection_init',
  CONNECTION_ACK: 'connection_ack',
  CONNECTION_ERROR: 'connection_error',
  CONNECTION_KEEP_ALIVE: 'ka',
  CONNECTION_TERMINATE: 'connection_terminate',
}

function* makeRangeIterator(start, end) {
  let originalStart = start
  while (true) {
    yield start++
    if (start > end) start = originalStart
  }
}

const isRangeVariable = (obj) => obj.start != null && obj.end != null
export function* argumentGenerator(args) {
  // Clone holds the original args, and the iterator values
  let internal = Object.assign({}, args)
  // genKeys holds name of generator keys in the object
  let genKeys = []
  // Iterate the keys and find "range" variables with "start"/"end" set
  for (let key in args) {
    const val = args[key]
    if (isRangeVariable(val)) {
      internal[key] = makeRangeIterator(val.start, val.end)
      genKeys.push(key)
    }
  }
  // Each iteration, for each "range" key, set the value to
  // the internal clone's next tick, then yield the whole object
  while (true) {
    genKeys.forEach((key) => (args[key] = internal[key].next().value))
    yield args
  }
}

export interface SubscriptionBenchConfig {
  url: string
  headers: Record<string, string>
  config: QueryConfig
  db_connection_string: string
}

export interface QueryConfig {
  label: string
  // TODO: Make the benchmark stop after optional duration?
  duration?: string
  insert_payload_data: boolean
  max_connections: number
  connections_per_second: number
  query: string
  variables: Record<string, Range | number | string | object | any[]>
}

export interface Range {
  start: number
  end: number
}

export const yamlConfigToSocketManagerParams = (
  options: SubscriptionBenchConfig
): SockerManagerConfig => ({
  label: options.config.label,
  endpoint: options.url,
  variables: options.config.variables,
  headers: options.headers,
  maxConnections: options.config.max_connections,
  connectionsPerSecond: options.config.connections_per_second,
  pgConnectionString: options.db_connection_string,
  subscriptionString: options.config.query,
  insertPayloadData: options.config.insert_payload_data ?? true,
})

export const COLORS = {
  FG_GREEN: '\x1b[32m',
  FG_YELLOW: '\x1b[33m',
  FG_CYAN: '\x1b[36m',
  FG_RED: '\x1b[31m',
  RESET: '\x1b[0m',
  BLINK: '\x1b[5m',
}
