import { SubscriptionBenchConfig } from './utils'
import { main as runSubscriptionBenchmark } from './main'

const testConfig: SubscriptionBenchConfig = {
  url: 'http://localhost:8085/v1/graphql',
  db_connection_string:
    'postgres://postgres:postgrespassword@localhost:5430/postgres',
  headers: {
    'X-Hasura-Admin-Secret': 'my-secret',
  },
  config: {
    label: 'SearchAlbumsWithArtist',
    max_connections: 20,
    connections_per_second: 10,
    insert_payload_data: true,
    query: `
      subscription AlbumByIDSubscription($artistIds: [Int!]!) {
        albums(where: {artist_id: { _in: $artistIds}}) {
          id
          title
          updated_at
        }
      }
    `,
    variables: {
      artistIds: [1, 2, 3, 4],
    },
  },
}

async function main() {
  await runSubscriptionBenchmark(testConfig)
}

main().catch((err) => {
  console.log('Error running subscription benchmark test')
})
