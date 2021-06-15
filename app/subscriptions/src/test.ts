import { SubscriptionBenchConfig } from './utils'
import { main as runSubscriptionBenchmark } from './main'
const testConfig: SubscriptionBenchConfig = {
  url: 'http://localhost:8085/v1/graphql',
  db_connection_string:
    'postgres://postgres:postgrespassword@localhost:5430/postgres',
  headers: {},
  config: {
    label: 'SearchAlbumsWithArtist',
    max_connections: 1,
    connections_per_second: 1,
    insert_payload_data: false,
    query: `
      subscription AlbumByIDSubscription($artistIds: [Int!]!) {
        Album(where: {ArtistId: { _in: $artistIds}}) {
          AlbumId
          ArtistId
          Title
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
main().catch(err => console.log("Got err in main:", err))
