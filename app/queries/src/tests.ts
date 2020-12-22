import { BenchmarkRunner } from './main'

import {
  GlobalConfig,
  BenchmarkTool,
  MaxRequestsInDurationBenchmark,
  FixedRequestNumberBenchmark,
  RequestsPerSecondBenchmark,
  MultiStageBenchmark,
  CustomBenchmark,
} from './executors/base/types'

/**
 * Declare some queries
 */

const queries = {
  searchAlbumsWithArtist: `
    query SearchAlbumsWithArtist {
      albums(where: {title: {_like: "%Rock%"}}) {
        id
        title
        artist {
          name
          id
        }
      }
    }`,
  albumsArtistTracksGenreAll: `
    query AlbumsArtistTracksGenreAll {
      albums {
        id
        title
        artist {
          id
          name
        }
        tracks {
          id
          name
          genre {
            name
          }
        }
      }
    }`,
}

const rpsBench: RequestsPerSecondBenchmark = {
  tools: [BenchmarkTool.AUTOCANNON, BenchmarkTool.K6, BenchmarkTool.WRK2],
  name: 'AlbumsArtistTrackGenreAll',
  execution_strategy: 'REQUESTS_PER_SECOND',
  duration: '3s',
  rps: 500,
  query: queries.albumsArtistTracksGenreAll,
}

// wrk2 can't handle a fixed request number benchmark
const fixedReqBench: FixedRequestNumberBenchmark = {
  tools: [BenchmarkTool.AUTOCANNON, BenchmarkTool.K6],
  name: 'AlbumsArtistTrackGenreAll',
  execution_strategy: 'FIXED_REQUEST_NUMBER',
  requests: 1000,
  query: queries.albumsArtistTracksGenreAll,
}

const maxReqInDurationBench: MaxRequestsInDurationBenchmark = {
  tools: [BenchmarkTool.AUTOCANNON, BenchmarkTool.K6, BenchmarkTool.WRK2],
  name: 'AlbumsArtistTrackGenreAll',
  execution_strategy: 'MAX_REQUESTS_IN_DURATION',
  duration: '10s',
  query: queries.albumsArtistTracksGenreAll,
}

const multiStageBench: MultiStageBenchmark = {
  tools: [BenchmarkTool.K6],
  name: 'SearchAlbumsWithArtist',
  execution_strategy: 'MULTI_STAGE',
  query: queries.searchAlbumsWithArtist,
  initial_rps: 0,
  stages: [
    {
      duration: '5s',
      target: 100,
    },
    {
      duration: '5s',
      target: 1000,
    },
    {
      duration: '3s',
      target: 300,
    },
    {
      duration: '5s',
      target: 0,
    },
  ],
}

/**
 * Set up the global benchmark config
 */

const tests: GlobalConfig = {
  url: 'http://localhost:8085/v1/graphql',
  headers: { 'X-Hasura-Admin-Secret': 'my-secret' },
  queries: [rpsBench, fixedReqBench, maxReqInDurationBench, multiStageBench],
}

async function main() {
  const runner = new BenchmarkRunner(tests)
  const results = await runner.runBenchmarks()
  console.log('Test results:', results)
}

main().catch((err) => {
  console.log('Error running tests')
})
