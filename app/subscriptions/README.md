# subscription-benchmark

This is a load generator for GraphQL subscriptions.

### Configuration:

```yaml
# Hasura Endpoint
url: http://localhost:8085/v1/graphql
# Postgres Connection string (can also set ENV variable PG_CONNECTION_STRING)
db_connection_string: postgres://postgres:postgrespassword@localhost:5430/postgres
# (Optional) Headers Object
headers:
  X-Hasura-Admin-Secret: my-secret
# Subscription Config
config:
  # Label for the subscription events in database (MUST BE CHANGED AFTER EVERY RUN)
  label: SearchAlbumsWithArtist01
  # Whether to insert the payload data for subscriptions into the "event_data" column in DB
  insert_payload_data: true
  # Maximum number of websocket connections
  max_connections: 100
  # Number of sockets to spawn per second until max reached
  connections_per_second: 10
  # Subscription query string
  query: |
    subscription AlbumByIDSubscription($artistIds: [Int!]!) {
      albums(where: {artist_id: { _in: $artistIds}}) {
        id
        title
        updated_at
      }
    }
  # Optional variables
  variables:
    # Can be an array
    artistIds: [1, 2, 3, 4]
    # Or a string
    some_value: a_string
    # A number
    some_number: 10
    # Or a range object with start & end
    some_range: { start: 1, end: 10 }
    another_range: { start: 50, end: 100 }
    # Also an object
    some_object:
      a_key: a_value
```

**Note about ranges:** Ranges work through generators/iterators. Making a range 1-10 will take the `next()` value of each range variable on every iteration, and mix it in with normal variables as an object. If you have multiple ranges, they each advance by one increment every subscription. When the range reaches the end, it loops back around.

Example with ranges:

```yaml
artistIds: [1, 2, 3]
some_number: 10
some_range: { start: 1, end: 10 }
another_range: { start: 50, end: 100 }
```

The first subscription will get variables like this:

```json
{
  "artistIds": [1, 2, 3],
  "some_number": 10,
  "some_range": 1,
  "another_range": 50
}
```

The next one will get `some_range: 2` and `another_range: 51`, and so on. When they reach the end of their range value, it repeats starting from the beginning again.

### Setup:

- Install the dependencies with Yarn or NPM
  - `yarn install`
  - `npm install`
- Create the `events` table using knex migrate with Yarn or NPM
  - `yarn knex:migrate:latest`
  - `npm run knex:migrate:latest`
- Confirm that an `events` table has been created inside of your database
- Run the benchmark tool
  ```bash
  # With Yarn
  yarn start
  # With NPM
  npm run start
  ```
- Create events by making changes in the subscribed table
- As you create changes, you should notice the number of data events increasing in `stdout` output:
  ![](example-stdout-output.png)
- Stop the benchmark with `ctrl + c`
- The script should say it has inserted the event data:

  ```
  ❯ Executing Teardown Process
  ❯ Starting to close socket connections
  ❯ Sockets closed, attempting to insert event data
  ❯ Inserted total of 10 events for label SearchAlbumsWithArtistUpdated
  ❯ Trying to close DB connection pool
  ❯ Database connection destroyed
  ❯ Now exiting the process
  ```

  Latency data can be calculated by subscribing to the `updated_at` field in your query, and then calculating the difference between `event_time` and the record's `updated_at` time.

  Make note that the 0th index of returned data may not be the the most recently updated, so simply doing `data[0].updated_at` may be incorrect.

### Benchmark Table:

```js
exports.up = function (knex, Promise) {
  return knex.schema.createTable('events', (table) => {
    table.string('label').notNullable() // unqiue label to identify benchmark
    table.integer('connection_id').notNullable() // connection_id represents the nth connection
    table.integer('operation_id').notNullable()
    table.integer('event_number').notNullable() // event_number represents the nth event that was receieved by the client
    table.jsonb('event_data').notNullable() // event_data stores the data that was received this can be used to validate
    table.timestamp('event_time', { useTz: true }).notNullable() // event_time stores the time at which the event was receieved by the client.
    table.boolean('is_error').notNullable() // is_error represents whether the event was error or not.
    table.integer('latency') // latency is not populated by the benchmark tool, but this can be populated by calculating `event_time-event_triggerd_time`

    table.unique(['label', 'connection_id', 'operation_id', 'event_number'])
  })
}
```
