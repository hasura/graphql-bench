import * as knex from 'knex'
import { config } from './src/utils'

const connectionString =
  process.env.PG_CONNECTION_STRING || config.db_connection_string

const database = {
  client: 'pg',
  connection: connectionString,
  migrations: {
    directory: './src/migrations',
  },
} as knex.Config

export = database
