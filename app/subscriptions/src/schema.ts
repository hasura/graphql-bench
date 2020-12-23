import Knex = require('knex')
import { Model } from 'objection'
export const connection = require('../knexfile')
export const knexConnection = Knex(connection)
Model.knex(knexConnection)

export class Events extends Model {
  label: string
  connection_id: number
  operation_id: number
  event_number: number
  event_data: any
  event_time: string
  is_error: boolean
  latency?: number

  static tableName = 'events'

  static get idColumn() {
    return ['label', 'connection_id', 'operation_id', 'event_number']
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'label',
        'connection_id',
        'operation_id',
        'event_number',
        'event_data',
        'event_time',
        'is_error',
      ],
      properties: {
        label: { type: 'string' },
        connection_id: { type: 'integer' },
        operation_id: { type: 'integer' },
        event_number: { type: 'integer' },
        event_data: { type: 'json' },
        event_time: { type: 'string' },
        is_error: { type: 'boolean' },
        latency: { type: ['integer', 'null'] },
      },
    }
  }
}
