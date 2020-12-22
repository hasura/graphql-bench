import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  return knex.schema.createTable('events', (table: Knex.TableBuilder) => {
    table.string('label').notNullable()
    table.integer('connection_id').notNullable()
    table.integer('operation_id').notNullable()
    table.integer('event_number').notNullable()
    table.jsonb('event_data').notNullable()
    table.timestamp('event_time', { useTz: true }).notNullable()
    table.boolean('is_error').notNullable()
    table.integer('latency')
    table.unique(['label', 'connection_id', 'operation_id', 'event_number'])
  })
}

export async function down(knex: Knex): Promise<any> {
  return knex.schema.dropTable('events')
}
