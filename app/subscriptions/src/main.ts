import {
  argumentGenerator,
  GQL,
  SubscriptionBenchConfig,
  yamlConfigToSocketManagerParams,
  COLORS,
} from './utils'
import Reattempt from 'reattempt/dist/decorator'
import WebSocket from 'ws'
import WebSocketAsPromised from 'websocket-as-promised'
import { Events, knexConnection } from './schema'
import { observable, observe } from '@nx-js/observer-util'
import logUpdate from 'log-update'

const DEBUG = process.env.DEBUG

/**
 * =================
 * Program Contents
 * =================
 *  - SocketManager:
 *     Holds config for the benchmark parameters and controls spawning/orchestrating Socket connections.
 *     Also performs DB insert at the end.
 *
 * - Connection:
 *    An individual Websocket, maintains an internal record of received events.
 *    Message handlers are registered here, these push to events.
 *
 * - main():
 *    Reads from config file, instantiates a SocketManager based on params in file.
 *    Spawns more sockets at configured number per second until target reached.
 *    Listens for ctrl + c to kill, which invokes exit()
 *
 * - exit():
 *    Teardown handler. Awaits closing all socket connections, writing data to DB, and destroying DB connection.
 */

/**
 * Global Stat Observables
 */

const STATS_OBSERVABLE = observable({
  DATA_EVENT_COUNT: 0,
  ERROR_EVENT_COUNT: 0,
  CONNECTED_SOCKETS: new Set(),
})

function updateEventStatsStdout() {
  logUpdate(
    COLORS.FG_CYAN +
      `Socket count: ${STATS_OBSERVABLE.CONNECTED_SOCKETS.size} | ` +
      COLORS.RESET +
      COLORS.FG_GREEN +
      `Data Events Received: ${STATS_OBSERVABLE.DATA_EVENT_COUNT} | ` +
      COLORS.RESET +
      COLORS.FG_RED +
      `Error Events Received: ${STATS_OBSERVABLE.ERROR_EVENT_COUNT} ` +
      COLORS.RESET
  )
}

/**
 * =====================
 * SOCKET MANAGER CLASS
 * =====================
 */

export interface SockerManagerConfig {
  label: string
  endpoint: string
  variables: object
  headers?: Record<string, string>
  maxConnections: number
  insertPayloadData: boolean
  connectionsPerSecond: number
  pgConnectionString: string
  subscriptionString: string
}

export class SocketManager {
  private nextSocketId = 1
  public connections: { [id: number]: Connection } = {}
  public config: SockerManagerConfig
  public queryArgGenerator: Iterator<any>

  constructor(config: SockerManagerConfig) {
    this.config = config
    this.queryArgGenerator = argumentGenerator(config.variables)
  }

  public closeSockets() {
    return Promise.all(
      Object.values(this.connections).map((conn) => {
        conn.socket.sendPacked({ type: GQL.CONNECTION_TERMINATE })
        conn.socket.close()
      })
    )
  }

  public get allEvents() {
    return Object.values(this.connections).flatMap((conn) => conn.events)
  }

  public async insertEvents() {
    return Events.query()
      .allowInsert('[connection_id, event_number, event_data, event_time]')
      .insertGraph(this.allEvents)
  }

  public async spawnConnection() {
    const socketId = this.nextSocketId++
    const socketManagerConfig = this.config
    const queryVariables = this.queryArgGenerator.next().value
    try {
      const connection = new Connection({
        id: socketId,
        queryVariables,
        socketManagerConfig,
      })
      connection.startSubscription()
      this.connections[socketId] = connection
      return connection
    } catch (err) {
      console.log('Caught error when calling spawnConnection()', err)
      throw err
    }
  }
}

/**
 * =======================
 * SOCKET CONNECTION CLASS
 * =======================
 */

export type FormatedError = Error & {
  originalError?: any
}

interface ConnectionParams {
  id: number
  socketManagerConfig: SockerManagerConfig
  queryVariables: object
}

class Connection {
  public eventNumber = 1
  public events: Array<any> = []
  public socket: WebSocketAsPromised
  public isReconnecting: boolean = false

  constructor(public props: ConnectionParams) {
    this.socket = this.makeSocket()
    this.configureMessageHandlers()
  }

  private makeSocket() {
    const { endpoint, headers } = this.props.socketManagerConfig
    return new WebSocketAsPromised(endpoint, {
      createWebSocket: (url) => new WebSocket(url, 'graphql-ws', { headers }),
      extractMessageData: (event) => event,
      packMessage: (data) => JSON.stringify(data),
      unpackMessage: (data) => JSON.parse(data as string),
    } as any)
  }

  // TODO: Make the retry configurable through config.yaml
  @Reattempt({ times: 60, delay: 1000 })
  public async startSubscription() {
    const socket = this.socket
    const { id, queryVariables } = this.props
    const { headers, subscriptionString } = this.props.socketManagerConfig

    if (DEBUG) console.log('Socket ID', id, 'attempting to start subscription')

    await socket.open()
    socket.sendPacked({
      type: GQL.CONNECTION_INIT,
      payload: { headers },
    })
    socket.sendPacked({
      id: String(id),
      type: GQL.START,
      payload: {
        query: subscriptionString,
        variables: queryVariables,
      },
    })
  }

  private makeEventRow({ payload, err }) {
    const { label, insertPayloadData } = this.props.socketManagerConfig
    return {
      label,
      is_error: err,
      operation_id: 1,
      connection_id: this.props.id,
      event_number: this.eventNumber++,
      event_data: insertPayloadData ? payload : { data: null },
      event_time: new Date().toISOString(),
    }
  }

  private configureMessageHandlers() {
    // On socket close:
    this.socket.onClose.addListener(() => {
      // Print debug message if enabled
      if (DEBUG) console.log('Socket ID', this.props.id, 'closed')
      // Remove socket ID from Observable ES6 Set of connected sockets
      STATS_OBSERVABLE.CONNECTED_SOCKETS.delete(this.props.id)
      // If the socket is not currently trying to reconnect, begin trying
      if (!this.isReconnecting) this.startSubscription()
      // Set reconnecting state to true
      this.isReconnecting = true
    })

    // On socket open:
    this.socket.onOpen.addListener(() => {
      // Print debug message if enabled
      if (DEBUG) console.log('Socket ID', this.props.id, 'connected')
      // Add the socket ID to ES6 Set of connected sockets
      STATS_OBSERVABLE.CONNECTED_SOCKETS.add(this.props.id)
      // Set reconnecting state to false
      this.isReconnecting = false
    })

    // If debug mode enabled, also set up generalized data logger
    if (DEBUG) {
      this.socket.onSend.addListener((data) => console.log('sent', data))
    }

    this.socket.onUnpackedMessage.addListener((data) => {
      switch (data.type) {
        case GQL.DATA:
          const event = this.makeEventRow({ payload: data.payload, err: false })
          if (DEBUG) console.log('CALLED GQL.DATA CASE, GOT EVENT ROW', event)
          STATS_OBSERVABLE.DATA_EVENT_COUNT++
          this.events.push(event)
          break
        case GQL.ERROR:
          const error = this.makeEventRow({ payload: data.payload, err: true })
          if (DEBUG) console.log('CALLED GQL.ERROR CASE, GOT ERROR ROW', data)
          STATS_OBSERVABLE.ERROR_EVENT_COUNT++
          this.events.push(error)
          break
      }
    })
  }
}

/**
 * =====================
 *     UTILS & MISC
 * =====================
 */

async function assertDatabaseConnection() {
  return knexConnection.raw('select 1+1 as result').catch((err: any) => {
    console.log('Failed to establish connection to database! Exiting...')
    console.log(err)
    process.exit(1)
  })
}

function prettyPrintConfig(options) {
  console.table({
    url: options.url,
    db_connection_string: options.db_connection_string,
  })
  console.table({ headers: options.headers })
  console.table({ config: options.config }, [
    'label',
    'max_connections',
    'connections_per_second',
  ])
  console.table({ variables: options.config.variables })
}

/**
 * =====================
 *   MAIN PROGRAM CODE
 * =====================
 */

export async function main(opts?: SubscriptionBenchConfig) {
  const options: SubscriptionBenchConfig = opts || require('./utils').config

  /**
   * Any time values change in these stats, run the below function
   * currently just updates the terminal output text with new data
   *
   * NOTE: This only works because updateEventStatsStdout() references
   * variables from the observable function, so the Proxy knows to fire
   */

  observe(() => {
    updateEventStatsStdout()
  })

  /**
   * Logging
   */

  const database =
    process.env.PG_CONNECTION_STRING || options.db_connection_string
  console.log('Asserting database connectivity, trying to conect to:')
  console.log(COLORS.FG_CYAN, database, COLORS.RESET)

  await assertDatabaseConnection()
  prettyPrintConfig(options)

  console.log(
    'Connected, starting subscriptions benchmark for a total of',
    options.config.max_connections,
    'sockets at a connection rate of',
    options.config.connections_per_second,
    'sockets per second'
  )

  /**
   * Execution
   */

  const socketManagerParams = yamlConfigToSocketManagerParams(options)
  const socketManager = new SocketManager(socketManagerParams)

  const MAX_CONNECTIONS = options.config.max_connections
  const SPAWN_RATE = 1000 / options.config.connections_per_second

  let socketSpawned = 0
  const spawnFn = () => {
    socketSpawned++
    return socketManager.spawnConnection().then((socket) => {
      if (socketSpawned >= MAX_CONNECTIONS) clearInterval(spawnInterval)
    })
  }

  const spawnInterval = setInterval(spawnFn, SPAWN_RATE)
  process.on('SIGINT', () => exit(socketManager))
}

/**
 * =====================
 * EXIT TEARDOWN PROCESS
 * =====================
 */

async function exit(socketManager: SocketManager) {
  console.log('\nExecuting Teardown Process')
  try {
    console.log('Starting to close socket connections')
    await socketManager.closeSockets()
  } catch (error) {
    console.log('Error while closing socket connections:', error)
  }

  try {
    console.log('Sockets closed, attempting to insert event data')
    const events = await socketManager.insertEvents()
    console.log(
      `Inserted total of ${events.length} events for label ${socketManager.config.label}`
    )
  } catch (error) {
    console.log('Error while inserting events:', error)
  }

  try {
    console.log('Trying to close DB connection pool')
    await knexConnection.destroy()
    console.log('Database connection destroyed')
  } catch (error) {
    console.log('Error while destroying database connection:', error)
  }

  console.log('Now exiting the process')
  process.exit(1)
}
