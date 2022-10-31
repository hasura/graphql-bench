// Reload when user edits fragment to select different benchmark results:
function locationHashChanged() {
  window.location.reload(); 
}
window.onhashchange = locationHashChanged;

// @ts-nocheck
const { ref, reactive, computed, watch, watchEffect, onMounted } = Vue

var num = -1
const colorList = [
  '#F44336',
  '#673AB7',
  '#03A9F4',
  '#4CAF50',
  '#FFEB3B',
  '#BF360C',
  '#795548',
  '#E91E63',
  '#3F51B5',
  '#00BCD4',
  '#CDDC39',
  '#FF9800',
  '#9E9E9E',
  '#9C27B0',
  '#009688',
]

// This is lame, but chart.js doesn't automatically color
const getColor = () => {
  num = (num + 1) % colorList.length
  return colorList[num]
}
const resetColors = () => { num = -1 }

// For the Latency Percentiles Graph:
const hist_points = ['min', 'p50', 'p75', 'p90', 'p99', 'p99_9', 'max']
const hist_labels = ['min',  '50%', '75%', '90%', '99%', '99.9%','max']

const benchmarkEntryToTableValue = (item) => {
  return {
    name: item.name,
    timeStart: item.time.start,
    timeEnd: item.time.end,
    requestCount: item.requests.count,
    requestAverage: item.requests.average,
    totalResponseBytes: item.response.totalBytes,
    responseBytesPerSecond: item.response.bytesPerSecond,
    latencyMean: item.histogram.json.mean,
    latencyMax: item.histogram.json.max,
    latencyStdDeviation: item.histogram.json.stdDeviation,
  }
}

const hasuraBenchmarksURL = `https://hasura-benchmark-results.s3.us-east-2.amazonaws.com`

// async fetch all URLs in the list
const fetchAllJSON = (urlsIds) => {
  // Turn any shorthand identifiers like 'mono-pr-1866/chinook' into full URLs
  // pointing to our report S3 bucket
  const urls = urlsIds.map( (u) => {
    if (u.startsWith("mono-pr-")) {
      return `${hasuraBenchmarksURL}/${u}.json`
    } else if (u.startsWith("http")) {
      return u
    } else {
      throw `Identifiers in the URL hash need to be either a full URL, or like 'mono-pr-1234/chinook', not ${u}`
    }

  })
  return Promise.all( urls.map( (url) => 
    fetch(url, {mode:'cors'})
      .then(response => response.json())
  ))
}

// twiddle and filter data, and combine multiple reports into a single multiBenchData:
const prepareMultiBenchData = (jsons, names) => {
  const jsonsByName = jsons.map( (report, ix) => {
    let benchmarksObj = {}
    report.forEach( (b) => benchmarksObj[b.name] = {
      ...b.histogram.json,
      ...b.extended_hasura_checks,
      // assume reports here are in the same order:
      name: names[ix],
    })
    return benchmarksObj
  })
  // transpose the reports, so we get one array item per benchmark
  let multiData = {}
  jsonsByName.forEach( (report) =>  {
    for (const [benchName, benchData] of Object.entries(report)) {
      if (!(benchName in multiData)) {
        multiData[benchName] = []
      }
      multiData[benchName].push(benchData)
    }
  })
  return multiData
}

const Main = {
  template: /* html */ `
    <div>
      <Navbar />
      <!-- Pads the main body content (nav is absolute) -->
      <div class="container mx-auto mt-24 bg-white shadow-lg md:mt-18"></div>
      <!-- <MainContent /> -->
      <div id="main-content" class="container m-auto">

      <section v-if="benchData.length == 0 && Object.keys(multiBenchData).length === 0">
        <!-- File upload -->
        <label style="margin: auto;" class="w-64 flex flex-col items-center px-4 py-6 bg-white text-blue-400 rounded-lg shadow-lg tracking-wide uppercase border border-blue-400 cursor-pointer hover:bg-blue-400  hover:text-white">
          <svg class="w-8 h-8" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M16.88 9.1A4 4 0 0 1 16 17H5a5 5 0 0 1-1-9.9V7a3 3 0 0 1 4.52-2.59A4.98 4.98 0 0 1 17 8c0 .38-.04.74-.12 1.1zM11 11h3l-4-4-4 4h3v3h2v-3z" />
          </svg>
          <span class="mt-2 text-base leading-normal">Select one or more JSON reports</span>
          <input type='file' class="hidden" @change="handleFileUpload" multiple/>
        </label>
      </section>

      <!-- Visualize a single benchmark set: -->
      <section v-if="benchData && benchData.length > 0">
        <h1 class="py-4 mb-10 text-3xl border-b">
          Latency
        </h1>
        <LatencyLineChart :bench-data="benchData" />

        <h2 class="py-4 mb-10 text-3xl border-b">
          Histograms with medians
        </h2>
        <div>
        Below we have a separate histogram thought for each of the queries seen
        above. We also overlay some other useful information:
        <ul>
        <li>
        Markers for median and geometric mean; these can be toggle back and forth by clicking on the graph. 
        </li>
        <li>
        Rather than just including the median for the entire data set, we also show medians for the first half quarter and eighth; this can allow you to see e.g. whether performance skewed over time
        </li>
        <li>
        Finally, the dashed stepped line Is a histogram of just the first half of the samples, scaled up 2x;  This is helpful for detecting skew, and validating the distribution
        </li>
        </ul>
        </div>

        <section >
            <div v-for="benchDataEntry in benchData" style="padding: 10px">
              <LatencyBasicHistogram v-if="'basicHistogram' in benchDataEntry" :bench-data-entry="benchDataEntry" />
            </div>
        </section>

        <h1 class="py-4 mb-10 text-3xl border-b">
          Other Metrics
        </h1>
        <div class="flex flex-row m-5">
          <AggregateScatterPlot title="Response Time Scatterplot" :bench-data="benchData" :height="350" :width="700" />
          <MeanBarChart title="Mean Latencies" :bench-data="benchData" :height="350" :width="300" />
        </div>
        <div class="flex flex-row m-5" v-if="benchData && benchData.length > 0 && benchData[0].extended_hasura_checks">
          <MemoryStats title="Memory and Allocation Stats (bytes)" :bench-data="benchData" :height="350" />
        </div>
        <DataTable :bench-data="benchData" />
      </section>

      <!-- Visualize several benchmark reports, showing regressions -->
      <section v-if="multiBenchData && Object.keys(multiBenchData).length !== 0">
        <h1 class="py-4 mb-10 text-3xl border-b">
          Latency Percentiles Across Reports, For Each Benchmark
        </h1>
        <span class="py-4 mb-10 text-1xl">
          <strong>NOTE</strong>: If the benchmark runs we're visualizing were passed in the URL
          hash in e.g. reverse chronological order then they will be colored
          here in that order, with most recent runs dark red fading into light
          blue, and then dark blue for the oldest report. The charts below can
          be <strong>zoomed</strong> with the mouse wheel.
        </span>
        
        <div v-for="(benchData, benchName) in multiBenchData" style="padding: 10px">
          <MultiLatencyLineChart :bench-data="benchData" :bench-name="benchName"/>
        </div>

        <h1 class="py-4 mb-10 text-3xl border-b">
          Memory Usage and Allocation Metrics
        </h1>
        <div v-for="(benchData, benchName) in multiBenchData" style="padding: 10px">
          <h2 class="py-4 mb-10 text-2xl border-b">
            {{benchName.replace('-k6-custom','')}}
          </h2>
          <!-- Skip if this report doesn't have extended_hasura_checks -->
          <div class="flex" v-if="('bytes_allocated_per_request' in benchData[0])">
            <MemoryMultiBarChart :bench-data="benchData" :title="'Bytes allocated per request'" :metric="'bytes_allocated_per_request'" />
            <MemoryMultiBarChart :bench-data="benchData" :title="'\\'mem_in_use\\', after bench run'" :metric="'mem_in_use_bytes_after'" />
            <MemoryMultiBarChart :bench-data="benchData" :title="'\\'live_bytes\\', after bench run'" :metric="'live_bytes_after'" />
          </div>
        </div>
      </section>
      </div>
    </div>
  `,
  setup() {
    // Data from a single JSON report.
    //
    // (Set this to false briefly to hide the file picker while we potentially
    // fetch json asynchronously):
    let benchData = ref(false)
    
    // Data aggregated from two or more JSON reports, which we'll present as a
    // regression report
    let multiBenchData = ref({})
    // NOTE: we only ever have EITHER `benchData` OR `multiBenchData` defined.
    //       Morally it's an enum/sum type.

    // We optionally take a comma-separated list of json report URLs to plot in
    // the URL fragment, and bypass asking for a local file. The remote must
    // have CORS configured properly.
    // NOTE: comma is techniquely valid in URL so using comma as the separator
    //       is not robust, but this seems unlikely to happen in practice
    if (window.location.hash){
      var urlsIds = window.location.hash.substring(1).split(',')
      fetchAllJSON(urlsIds)
        .then(jsons => {
          // We're generating single run report:
          if (jsons.length == 1) {
            benchData.value = jsons[0]

          // We're generating a regression report from multiBenchData:
          } else {
            multiBenchData.value = prepareMultiBenchData(jsons, urlsIds)
          }
        })
    } else {
      // Report data will come from file-picker
      benchData.value = []
    }

    const handleFileUpload = async (event) => {
      // We're generating a regression report from multiBenchData:
      if (event.target.files.length > 1) {
        let files = Array.from(event.target.files)
        const filesText = await Promise.all(files.map((f) => f.text()))
        const filesJson = filesText.map(JSON.parse)
        multiBenchData.value = prepareMultiBenchData(filesJson, files.map((f) => f.name))
      // We're generating single run report:
      } else {
        const file = event.target.files[0]
        const content = await file.text()
        benchData.value = JSON.parse(content)
      }
    }

    return { benchData, handleFileUpload, multiBenchData }
  },
}

const app = Vue.createApp(Main)

app.component('HasuraIcon', {
  template: /* html */ `
    <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTA2IiBoZWlnaHQ9IjQwIiB2aWV3Qm94PSIwIDAgMTA2IDQwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cGF0aCBkPSJNNDUuNDgxMSAyMi41MTE1SDQzLjUzNDhDNDMuMjQxMSAyMi41MTE1IDQzLjAwNzIgMjIuMjc3NSA0My4wMDcyIDIxLjk4MzhWMTUuODUxNEM0My4wMDcyIDE1LjU1NzcgNDIuNzczMiAxNS4zMjM3IDQyLjQ3OTUgMTUuMzIzN0g0MC43NjcyQzQwLjQ3MzUgMTUuMzIzNyA0MC4yMzk2IDE1LjU1NzcgNDAuMjM5NiAxNS44NTE0VjMxLjQyNjRDNDAuMjM5NiAzMS43MjAxIDQwLjQ3MzUgMzEuOTU0MSA0MC43NjcyIDMxLjk1NDFINDIuNDc5NUM0Mi43NzMyIDMxLjk1NDEgNDMuMDA3MiAzMS43MjAxIDQzLjAwNzIgMzEuNDI2NFYyNS4zNjg2QzQzLjAwNzIgMjUuMDc1IDQzLjI0MTEgMjQuODQxIDQzLjUzNDggMjQuODQxSDQ1LjQ4MTFDNDUuNzc0NyAyNC44NDEgNDYuMDA4NyAyNS4wNzUgNDYuMDA4NyAyNS4zNjg2VjMxLjQyNjRDNDYuMDA4NyAzMS43MjAxIDQ2LjI0MjYgMzEuOTU0MSA0Ni41MzYzIDMxLjk1NDFINDguMjQ4NkM0OC41NDIzIDMxLjk1NDEgNDguNzc2MyAzMS43MjAxIDQ4Ljc3NjMgMzEuNDI2NFYxNS44NTE0QzQ4Ljc3NjMgMTUuNTU3NyA0OC41NDIzIDE1LjMyMzcgNDguMjQ4NiAxNS4zMjM3SDQ2LjUzNjNDNDYuMjQyNiAxNS4zMjM3IDQ2LjAwODcgMTUuNTU3NyA0Ni4wMDg3IDE1Ljg1MTRWMjEuOTgzOEM0Ni4wMDg3IDIyLjI3NzUgNDUuNzY5OCAyMi41MTE1IDQ1LjQ4MTEgMjIuNTExNVoiIGZpbGw9IiNGOEY4RjgiLz4KPHBhdGggZD0iTTU0LjExMjMgMTUuNzU2NUw1MS4zNDk3IDMxLjMzMTZDNTEuMjkgMzEuNjU1MiA1MS41Mzg5IDMxLjk1MzggNTEuODY3NCAzMS45NTM4SDUzLjU2NDhDNTMuODIzNiAzMS45NTM4IDU0LjA0NzYgMzEuNzY0NyA1NC4wODc0IDMxLjUxMDhMNTQuNTQwNCAyOC42NTM2QzU0LjU4MDIgMjguMzk0OCA1NC44MDQyIDI4LjIxMDYgNTUuMDYzMSAyOC4yMTA2SDU3LjIwODRDNTcuNDY3MyAyOC4yMTA2IDU3LjY4NjMgMjguMzk0OCA1Ny43MzExIDI4LjY0ODdMNTguMjIzOSAzMS41MjA4QzU4LjI2ODcgMzEuNzc0NiA1OC40ODc3IDMxLjk1ODggNTguNzQ2NSAzMS45NTg4SDYwLjQ2ODhDNjAuODAyMyAzMS45NTg4IDYxLjA1MTIgMzEuNjU1MiA2MC45ODY1IDMxLjMzMTZMNTguMDI0OCAxNS43NTY1QzU3Ljk3NSAxNS41MDc3IDU3Ljc2MSAxNS4zMjg1IDU3LjUwNzEgMTUuMzI4NUg1NC42MzVDNTQuMzc2MiAxNS4zMjM1IDU0LjE1NzEgMTUuNTA3NyA1NC4xMTIzIDE1Ljc1NjVaTTU2LjY0MSAyNS44NzYxSDU1LjU4NTdDNTUuMjYyMiAyNS44NzYxIDU1LjAxMzMgMjUuNTg3NCA1NS4wNjMxIDI1LjI2MzlMNTUuNTY1OCAxOS41NDk1QzU1LjY2MDQgMTguOTU3MiA1Ni41MDY2IDE4Ljk1MjIgNTYuNjA2MSAxOS41Mzk2TDU3LjE1ODcgMjUuMjUzOUM1Ny4yMTg0IDI1LjU3NzUgNTYuOTY5NSAyNS44NzYxIDU2LjY0MSAyNS44NzYxWiIgZmlsbD0iI0Y4RjhGOCIvPgo8cGF0aCBkPSJNNjguNDQzIDIyLjMwNzNINjYuNTU2NUM2Ni4xOTMxIDIyLjMwNzMgNjUuOTk5IDIyLjEzOCA2NS45OTkgMjEuNzc5NlYxOC4xODU4QzY1Ljk5OSAxNy44Mjc0IDY2LjE5MzEgMTcuNjU4MiA2Ni41NTY1IDE3LjY1ODJINjcuNjQxNkM2OC4wMDUgMTcuNjU4MiA2OC4xOTkxIDE3LjgyNzQgNjguMTk5MSAxOC4xODU4VjE5Ljg5MzFDNjguMTk5MSAyMC4xODY4IDY4LjQzMyAyMC40MjA4IDY4LjcyNjcgMjAuNDIwOEg3MC40NjM5QzcwLjc1NzYgMjAuNDIwOCA3MC45OTE2IDIwLjE4NjggNzAuOTkxNiAxOS44OTMxVjE3LjgyMjRDNzAuOTkxNiAxNi4xODk3IDcwLjA4NTYgMTUuMzI4NiA2OC4zNjgzIDE1LjMyODZINjUuODM0N0M2NC4xMTc0IDE1LjMyODYgNjMuMjExNSAxNi4xODk3IDYzLjIxMTUgMTcuODIyNFYyMi4wODgzQzYzLjIxMTUgMjMuNzM1OSA2NC4xMDI1IDI0LjYxMTkgNjUuNzg0OSAyNC42MTE5SDY3LjY5NjRDNjguMDU5NyAyNC42MTE5IDY4LjIyNCAyNC43NzEyIDY4LjIyNCAyNS4xMzk2VjI5LjA5NjhDNjguMjI0IDI5LjQ2NTEgNjguMDU5NyAyOS42Mjk0IDY3LjY5NjQgMjkuNjI5NEg2Ni42MTEyQzY2LjI0NzkgMjkuNjI5NCA2Ni4wNTM3IDI5LjQ2MDIgNjYuMDUzNyAyOS4wOTY4VjI3LjM4OTVDNjYuMDUzNyAyNy4wOTU4IDY1LjgxOTggMjYuODYxOCA2NS41MjYxIDI2Ljg2MThINjMuNzg4OUM2My40OTUyIDI2Ljg2MTggNjMuMjYxMyAyNy4wOTU4IDYzLjI2MTMgMjcuMzg5NVYyOS40NjAyQzYzLjI2MTMgMzEuMDkyOCA2NC4xNjcyIDMxLjk1NCA2NS44ODQ1IDMxLjk1NEg2OC4zOTMyQzcwLjEyNTQgMzEuOTU0IDcxLjA0NjMgMzEuMDkyOCA3MS4wNDYzIDI5LjQ2MDJWMjQuODA2MUM3MS4wNDEzIDIzLjE2ODQgNzAuMTQ1NCAyMi4zMDczIDY4LjQ0MyAyMi4zMDczWiIgZmlsbD0iI0Y4RjhGOCIvPgo8cGF0aCBkPSJNNzguOTE2IDI5LjA5NjZDNzguOTE2IDI5LjQ2NSA3OC43NTY3IDI5LjYyOTMgNzguMzU4NSAyOS42MjkzSDc2Ljg4NTFDNzYuNTIxNyAyOS42MjkzIDc2LjMyNzYgMjkuNDYgNzYuMzI3NiAyOS4wOTY2VjE1Ljg1MTFDNzYuMzI3NiAxNS41NTc0IDc2LjA5MzcgMTUuMzIzNSA3NS44IDE1LjMyMzVINzQuMDYyOEM3My43NjkxIDE1LjMyMzUgNzMuNTM1MiAxNS41NTc0IDczLjUzNTIgMTUuODUxMVYyOS40NTVDNzMuNTM1MiAzMS4wODc3IDc0LjQ1MSAzMS45NDg4IDc2LjE4ODIgMzEuOTQ4OEg3OS4wNjA0QzgwLjc5MjYgMzEuOTQ4OCA4MS43MTM0IDMxLjA4NzcgODEuNzEzNCAyOS40NTVWMTUuODUxMUM4MS43MTM0IDE1LjU1NzQgODEuNDc5NSAxNS4zMjM1IDgxLjE4NTggMTUuMzIzNUg3OS40NDg2Qzc5LjE1NDkgMTUuMzIzNSA3OC45MjEgMTUuNTU3NCA3OC45MjEgMTUuODUxMVYyOS4wOTY2SDc4LjkxNloiIGZpbGw9IiNGOEY4RjgiLz4KPHBhdGggZD0iTTkyLjczNCAyMi44ODk1VjE3LjgxNzNDOTIuNzM0IDE2LjE4NDYgOTEuODI4IDE1LjMyMzUgOTAuMTEwNyAxNS4zMjM1SDg1LjExODFDODQuODI0NSAxNS4zMjM1IDg0LjU5MDUgMTUuNTU3NCA4NC41OTA1IDE1Ljg1MTFWMzEuNDI2MkM4NC41OTA1IDMxLjcxOTkgODQuODI0NSAzMS45NTM4IDg1LjExODEgMzEuOTUzOEg4Ni44MzA1Qzg3LjEyNDEgMzEuOTUzOCA4Ny4zNTgxIDMxLjcxOTkgODcuMzU4MSAzMS40MjYyVjI1LjkzNThDODcuMzU4MSAyNS42NDIyIDg3LjU5MiAyNS40MDgyIDg3Ljg4NTcgMjUuNDA4MkM4OC4xMDQ3IDI1LjQwODIgODguMzAzOCAyNS41NDc2IDg4LjM3ODUgMjUuNzUxN0w5MC41NTM3IDMxLjYwNTRDOTAuNjI4NCAzMS44MTQ0IDkwLjgyNzUgMzEuOTQ4OCA5MS4wNDY1IDMxLjk0ODhIOTIuODg4M0M5My4yNjE2IDMxLjk0ODggOTMuNTE1NCAzMS41NzU1IDkzLjM4MSAzMS4yMzIxTDkxLjI3MDUgMjUuNzk2NUM5MS4xNjYgMjUuNTMyNiA5MS4zMDA0IDI1LjI0ODkgOTEuNTU0MiAyNS4xMTk1QzkyLjMzMDggMjQuNzQ2MiA5Mi43MzQgMjMuOTg0NiA5Mi43MzQgMjIuODg5NVpNODkuOTY2NCAxOC4xODA3VjIyLjU3NTlDODkuOTY2NCAyMi45MzQzIDg5Ljc3MjIgMjMuMTAzNiA4OS40MDg5IDIzLjEwMzZIODcuODgwN0M4Ny41ODcxIDIzLjEwMzYgODcuMzUzMSAyMi44Njk2IDg3LjM1MzEgMjIuNTc1OVYxOC4xNzU3Qzg3LjM1MzEgMTcuODgyIDg3LjU4NzEgMTcuNjQ4IDg3Ljg4MDcgMTcuNjQ4SDg5LjQwODlDODkuNzcyMiAxNy42NDggODkuOTY2NCAxNy44MjIzIDg5Ljk2NjQgMTguMTgwN1oiIGZpbGw9IiNGOEY4RjgiLz4KPHBhdGggZD0iTTEwMS44OTggMTUuMzIzNUg5OS4wMjU3Qzk4Ljc3MTggMTUuMzIzNSA5OC41NTI4IDE1LjUwNzcgOTguNTA4IDE1Ljc2MTVMOTUuNzQ1NCAzMS4zMzY2Qzk1LjY4NTcgMzEuNjYwMSA5NS45MzQ2IDMxLjk1ODggOTYuMjYzMSAzMS45NTg4SDk3Ljk2MDVDOTguMjE5MyAzMS45NTg4IDk4LjQ0MzMgMzEuNzY5NiA5OC40ODMxIDMxLjUxNThMOTguOTM2MSAyOC42NTg2Qzk4Ljk3NTkgMjguMzk5OCA5OS4xOTk5IDI4LjIxNTYgOTkuNDU4OCAyOC4yMTU2SDEwMS42MDRDMTAxLjg2MyAyOC4yMTU2IDEwMi4wODIgMjguMzk5OCAxMDIuMTI3IDI4LjY1MzZMMTAyLjYyIDMxLjUyNTdDMTAyLjY2NCAzMS43Nzk2IDEwMi44ODMgMzEuOTYzOCAxMDMuMTQyIDMxLjk2MzhIMTA0Ljg2NEMxMDUuMTk4IDMxLjk2MzggMTA1LjQ0NyAzMS42NjAxIDEwNS4zODIgMzEuMzM2NkwxMDIuNDIgMTUuNzYxNUMxMDIuMzY2IDE1LjUwMjcgMTAyLjE1MiAxNS4zMjM1IDEwMS44OTggMTUuMzIzNVpNMTAxLjAzMiAyNS44NzYxSDk5Ljk3NjRDOTkuNjUyOSAyNS44NzYxIDk5LjQwNCAyNS41ODc0IDk5LjQ1MzggMjUuMjYzOUw5OS45NTY1IDIwLjA1MjNDMTAwLjA1MSAxOS40NTk5IDEwMC44OTcgMTkuNDU0OSAxMDAuOTk3IDIwLjA0MjNMMTAxLjU0OSAyNS4yNTM5QzEwMS42MDkgMjUuNTc3NCAxMDEuMzYgMjUuODc2MSAxMDEuMDMyIDI1Ljg3NjFaIiBmaWxsPSIjRjhGOEY4Ii8+CjxwYXRoIGQ9Ik0zMy4xNzU2IDEzLjc5NjNDMzQuMjc1OSAxMS4xMzA3IDM0LjMwNSA1LjY3MDcxIDMyLjgzOTMgMS40MzE0NkMzMi40NjE1IDAuNjcxNjM3IDMxLjMxOTcgMC45MDQxNTMgMzEuMjY1NyAxLjc1MTE3TDMxLjI0OTEgMi4wMzM1MUMzMC45OTE2IDYuMDE1MzQgMjkuNTI2IDguMjE1OTMgMjcuMzY2OSA5LjI3MDU1QzI3LjAxNCA5LjQ0NDkzIDI2LjQ0NTIgOS4zOTkyNiAyNi4xMDg4IDkuMTg3NTFDMjMuNTM0NiA3LjU2NDA1IDIwLjQ4NjkgNi42MjU2OSAxNy4yMTkzIDYuNjI1NjlDMTMuOTQzMyA2LjYyNTY5IDEwLjg5MTUgNy41NjgyIDguMzEzMTIgOS4xOTk5NkM3Ljk4NTExIDkuNDA3NTcgNy41NzQwNSA5LjQ1NzM5IDcuMjA4NjcgOS4zMjAzN0M0Ljk5OTc4IDguNDk0MTEgMy40NTUyMSA2LjEwMjUzIDMuMTkzNjMgMi4wMzc2NkwzLjE3NzAyIDEuNzUxMTdDMy4xMjMwNSAwLjkwNDE1MyAxLjk4MTIzIDAuNjcxNjM3IDEuNjAzMzkgMS40MzE0NkMwLjEzNzcxOCA1LjY3OTAyIDAuMTY2NzgyIDExLjE0NzMgMS4yNzEyMyAxMy44MDg3QzEuODIzNDUgMTUuMTQxNiAxLjg1MjUyIDE2LjY0MDUgMS4zOTE2NCAxOC4wMTA2QzAuODA2MTk5IDE5Ljc1NDUgMC41MDMwOTkgMjEuNjMxMiAwLjUzMjE2NCAyMy41Nzg1QzAuNjczMzM0IDMyLjM4OTIgOC4xODQ0IDM5Ljg3OTUgMTYuOTk1MSAzOS45OTU4QzI2LjMxNjQgNDAuMTIwMyAzMy45MTA1IDMyLjYwMSAzMy45MTA1IDIzLjMwODdDMzMuOTEwNSAyMS40NTI3IDMzLjYwNzQgMTkuNjY3MyAzMy4wNDY5IDE3Ljk5ODJDMzIuNTg2IDE2LjYzMjEgMzIuNjI3NiAxNS4xMzMzIDMzLjE3NTYgMTMuNzk2M1pNMTYuOTc4NSAzNi4wMDE1QzEwLjE4OTggMzUuODc2OSA0LjY1NTE2IDMwLjMzODEgNC41MjY0NCAyMy41NDk1QzQuMzkzNTggMTYuMzQ5OCAxMC4yNTYzIDEwLjQ4MjkgMTcuNDYwMSAxMC42MTU4QzI0LjI0ODcgMTAuNzQwNCAyOS43ODM0IDE2LjI3OTIgMjkuOTEyMSAyMy4wNjc4QzMwLjA0NSAzMC4yNjc1IDI0LjE4MjMgMzYuMTM0NCAxNi45Nzg1IDM2LjAwMTVaIiBmaWxsPSIjRjhGOEY4Ii8+CjxwYXRoIGQ9Ik0xOS4xODMyIDIxLjk0N0wxNi4yMTAzIDE3LjMyNThDMTUuNzMyOCAxNi41Nzg0IDE0LjczMjIgMTYuMzYyNSAxMy45ODkgMTYuODQ0MUMxMy41MjM5IDE3LjE0MzEgMTMuMjQ1OCAxNy42NDk2IDEzLjI0OTkgMTguMjMwOUMxMy4yNDk5IDE4LjUzODIgMTMuMzYyIDE4Ljg0MTMgMTMuNTI4MSAxOS4wOTg3TDE1LjU1ODUgMjIuMjU4NEMxNS43MDc5IDIyLjQ5MDkgMTUuNjgzIDIyLjc5NCAxNS40OTYyIDIyLjk5NzVMMTIuMzU3MiAyNi40NTYxQzExLjc2MzUgMjcuMTEyMiAxMS44MDkxIDI4LjEyOTQgMTIuNDY5MyAyOC43MjczQzEyLjc3MjQgMjkuMDAxMyAxMy4xNjY5IDI5LjE1MDggMTMuNTc3OSAyOS4xNDI1QzE0LjAxOCAyOS4xMzQyIDE0LjQ0MTYgMjguOTQzMiAxNC43NDA1IDI4LjYxNTJMMTcuMDY1NyAyNS44NzlDMTcuMjQ0MiAyNS42NjcyIDE3LjU3MjIgMjUuNjgzOCAxNy43MyAyNS45MTIyTDE5LjM3ODMgMjguMjg3MkMxOS40OTQ2IDI4LjQ2OTkgMTkuNjM5OSAyOC42NDAxIDE5LjgxODUgMjguNzY0N0MyMC4zODczIDI5LjE2NzQgMjEuMDg5IDI5LjE1NSAyMS42MTYzIDI4LjgyMjhDMjIuMDg1NSAyOC41MjggMjIuMzY3OCAyOC4wMjE1IDIyLjM2NzggMjcuNDQ0M0MyMi4zNjc4IDI3LjEzNzEgMjIuMjY0IDI2LjgzNCAyMi4wOTc5IDI2LjU3MjRMMTkuMTgzMiAyMS45NDdaIiBmaWxsPSIjRjhGOEY4Ii8+Cjwvc3ZnPgo=" alt="Logo">
  `,
})

app.component('Navbar', {
  template: /* html */ `
    <nav
      class="fixed top-0 z-10 flex flex-wrap items-center justify-between w-full p-6 bg-gray-800 shadow-xl"
    >
      <div class="flex items-center flex-shrink-0 mr-6 text-white">
        <a
          class="text-white no-underline hover:text-white hover:no-underline"
          href="https://hasura.io"
        >
        <HasuraIcon />

        </a>

      </div>

      <div class="block lg:hidden">
        <button
          id="nav-toggle"
          class="flex items-center px-3 py-2 text-gray-500 border border-gray-600 rounded hover:text-white hover:border-white"
        >
          <svg
            class="w-3 h-3 fill-current"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <title>Menu</title>
            <path d="M0 3h20v2H0V3zm0 6h20v2H0V9zm0 6h20v2H0v-2z"></path>
          </svg>
        </button>
      </div>

      <div
        class="flex-grow hidden w-full pt-6 lg:flex lg:items-center lg:w-auto lg:block lg:pt-0"
        id="nav-content"
      >
        <ul class="items-center justify-end flex-1 list-reset lg:flex">

          <li class="mr-3">
            <a class="inline-block px-4 py-2 text-white text-lg no-underline" href="#"
              >GraphQL Bench Report</a
            >
          </li>
        </ul>
      </div>
    </nav>
  `,
})

app.component('DataTable', {
  props: {
    benchData: Array,
  },
  template: /* html */ `
  <component is="style">
    [type='checkbox'] {
      box-sizing: border-box;
      padding: 0;
    }

    .form-checkbox {
      -webkit-appearance: none;
      -moz-appearance: none;
      appearance: none;
      -webkit-print-color-adjust: exact;
      color-adjust: exact;
      display: inline-block;
      vertical-align: middle;
      background-origin: border-box;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
      flex-shrink: 0;
      color: currentColor;
      background-color: #fff;
      border-color: #e2e8f0;
      border-width: 1px;
      border-radius: 0.25rem;
      height: 1.2em;
      width: 1.2em;
    }

    .form-checkbox:checked {
      background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M5.707 7.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4a1 1 0 0 0-1.414-1.414L7 8.586 5.707 7.293z'/%3e%3c/svg%3e");
      border-color: transparent;
      background-color: currentColor;
      background-size: 100% 100%;
      background-position: center;
      background-repeat: no-repeat;
    }
  </component>
  <div class="container px-4 py-6 mx-auto" x-data="datatables()" x-cloak>
      <h1 class="py-4 mb-10 text-3xl border-b">Datatable</h1>

      <div
        v-show="selectedRows.length"
        class="fixed top-0 left-0 right-0 z-40 w-full bg-teal-200 shadow"
      >
        <div class="container px-4 py-4 mx-auto">
          <div class="flex md:items-center">
            <div class="flex-shrink-0 mr-4">
              <svg
                class="w-8 h-8 text-teal-600"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>
            <div class="text-lg text-teal-800">
              {{selectedRows.length}} rows are selected
          </div>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between mb-4">
        <div class="flex-1 pr-4">
          <div class="relative md:w-1/3">
            <input
              type="search"
              v-model="searchText"
              class="w-full py-2 pl-10 pr-4 font-medium text-gray-600 rounded-lg shadow focus:outline-none focus:shadow-outline"
              placeholder="Search..."
            />
            <div class="absolute top-0 left-0 inline-flex items-center p-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-6 h-6 text-gray-400"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="0" y="0" width="24" height="24" stroke="none"></rect>
                <circle cx="10" cy="10" r="7" />
                <line x1="21" y1="21" x2="15" y2="15" />
              </svg>
            </div>
          </div>
        </div>
        <div>
          <div class="flex rounded-lg shadow">
            <div class="relative">
              <button
                @click.prevent="open = !open"
                class="inline-flex items-center px-2 py-2 font-semibold text-gray-500 bg-white rounded-lg hover:text-blue-500 focus:outline-none focus:shadow-outline md:px-4"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-6 h-6 md:hidden"
                  viewBox="0 0 24 24"
                  stroke-width="2"
                  stroke="currentColor"
                  fill="none"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect
                    x="0"
                    y="0"
                    width="24"
                    height="24"
                    stroke="none"
                  ></rect>
                  <path
                    d="M5.5 5h13a1 1 0 0 1 0.5 1.5L14 12L14 19L10 16L10 12L5 6.5a1 1 0 0 1 0.5 -1.5"
                  />
                </svg>
                <span class="hidden md:block">Display</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-5 h-5 ml-1"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  stroke-width="2"
                  stroke="currentColor"
                  fill="none"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect
                    x="0"
                    y="0"
                    width="24"
                    height="24"
                    stroke="none"
                  ></rect>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              <div
                v-show="open"
                class="absolute top-0 right-0 z-40 block w-40 py-1 mt-12 -mr-1 overflow-hidden bg-white rounded-lg shadow-lg"
              >
                <template v-for="heading in headings">
                  <label
                    class="flex items-center justify-start px-4 py-2 text-truncate hover:bg-gray-100"
                  >
                    <div class="mr-3 text-teal-600">
                      <input
                        type="checkbox"
                        class="form-checkbox focus:outline-none focus:shadow-outline"
                        checked
                        @click="toggleColumn(heading.key)"
                      />
                    </div>
                    <div class="text-gray-700 select-none">
                      {{ heading.value }}
                    </div>
                  </label>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        class="relative overflow-x-auto overflow-y-auto bg-white rounded-lg shadow"
        style="height: 405px;"
      >
        <table
          class="relative w-full whitespace-no-wrap bg-white border-collapse table-auto table-striped"
        >
          <thead>
            <tr class="text-left">
              <th
                class="sticky top-0 px-3 py-2 bg-gray-100 border-b border-gray-200"
              >
                <label
                  class="inline-flex items-center justify-between px-2 py-2 text-teal-500 rounded-lg cursor-pointer hover:bg-gray-200"
                >
                  <input
                    type="checkbox"
                    class="form-checkbox focus:outline-none focus:shadow-outline"
                    @click="selectAllCheckbox($event);"
                  />
                </label>
              </th>
              <template v-for="heading in headings">
                <th
                  class="sticky top-0 px-6 py-2 text-xs font-bold tracking-wider text-gray-600 uppercase bg-gray-100 border-b border-gray-200"
                  :ref="heading.key"
                  :class="{ [heading.key]: true }"
                >
                {{ heading.value }}
              </th>
              </template>
            </tr>
          </thead>
          <tbody>
            <template v-for="benchmark in benchmarks" :key="benchmark.name">
              <tr>
                <td class="px-3 border-t border-gray-200 border-dashed">
                  <label
                    class="inline-flex items-center justify-between px-2 py-2 text-teal-500 rounded-lg cursor-pointer hover:bg-gray-200"
                  >
                    <input
                      type="checkbox"
                      class="form-checkbox rowCheckbox focus:outline-none focus:shadow-outline"
                      :name="benchmark.name"
                      @click="toggleRowSelect($event, benchmark.name)"
                    />
                  </label>
                </td>
                <td class="border-t border-gray-200 border-dashed name">
                  <span class="flex items-center px-6 py-3 text-gray-700" >
                  {{ benchmark.name }}
                </span>
                </td>
                <td class="border-t border-gray-200 border-dashed timeStart">
                  <span class="flex items-center px-6 py-3 text-gray-700" >
                  {{ new Date(benchmark.timeStart).toLocaleTimeString() }}
                </span>
                </td>
                <td class="border-t border-gray-200 border-dashed timeEnd">
                  <span class="flex items-center px-6 py-3 text-gray-700">
                  {{ new Date(benchmark.timeEnd).toLocaleTimeString() }}
                </span>
                </td>
                <td class="border-t border-gray-200 border-dashed requestCount">
                  <span class="flex items-center px-6 py-3 text-gray-700" >
                    {{ benchmark.requestCount }}
                </span>
                </td>
                <td class="border-t border-gray-200 border-dashed requestAverage">
                  <span class="flex items-center px-6 py-3 text-gray-700">
                  {{ benchmark.requestAverage.toFixed(2) }}
                </span>
                </td>
                <td class="border-t border-gray-200 border-dashed latencyMean">
                  <span class="flex items-center px-6 py-3 text-gray-700">
                    {{ benchmark.latencyMean.toFixed(2) }}
                  </span>
                </td>
                <td class="border-t border-gray-200 border-dashed latencyMax">
                  <span class="flex items-center px-6 py-3 text-gray-700">
                    {{ benchmark.latencyMax.toFixed(2) }}
                  </span>
                </td>
                <td class="border-t border-gray-200 border-dashed latencyStdDeviation">
                  <span class="flex items-center px-6 py-3 text-gray-700">
                    {{ benchmark.latencyStdDeviation.toFixed(2) }}
                  </span>
                </td>
                <td class="border-t border-gray-200 border-dashed totalResponseBytes">
                  <span class="flex items-center px-6 py-3 text-gray-700">
                    {{ benchmark.totalResponseBytes }}
                  </span>
                </td>
                <td class="border-t border-gray-200 border-dashed responseBytesPerSecond">
                  <span class="flex items-center px-6 py-3 text-gray-700">
                    {{ benchmark.responseBytesPerSecond.toFixed(2) }}
                  </span>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
  `,
  setup(props) {
    const headings = [
      {
        key: 'name',
        value: 'Name',
      },
      {
        key: 'timeStart',
        value: 'Start',
      },
      {
        key: 'timeEnd',
        value: 'End',
      },
      {
        key: 'requestCount',
        value: 'Total Req.',
      },
      {
        key: 'requestAverage',
        value: 'Avg Req/s',
      },
      {
        key: 'latencyMean',
        value: 'Latency (mean)',
      },
      {
        key: 'latencyMax',
        value: 'Latency (max)',
      },
      {
        key: 'latencyStdDeviation',
        value: 'Latency (Std. Dev)',
      },
      {
        key: 'totalResponseBytes',
        value: 'Total Res Bytes',
      },
      {
        key: 'responseBytesPerSecond',
        value: 'Avg Bytes/s',
      },
    ]

    const state = reactive({ searchText: '', open: false, selectedRows: [] })

    const benchmarks = computed(() => {
      let entries = props.benchData.map(benchmarkEntryToTableValue)
      if (!state.searchText) return entries
      return entries.filter((it) =>
        Object.values(it).some((val) =>
          String(val).toLowerCase().match(state.searchText.toLowerCase())
        )
      )
    })

    function toggleColumn(key) {
      // Note: All td must have the same class name as the headings key!
      let columns = document.querySelectorAll('.' + key)

      if (
        this.$refs[key].classList.contains('hidden') &&
        this.$refs[key].classList.contains(key)
      ) {
        columns.forEach((column) => {
          column.classList.remove('hidden')
        })
      } else {
        columns.forEach((column) => {
          column.classList.add('hidden')
        })
      }
    }

    function toggleRowSelect($event, id) {
      let rows = this.selectedRows

      if (rows.includes(id)) {
        let index = rows.indexOf(id)
        rows.splice(index, 1)
      } else {
        rows.push(id)
      }
    }

    function selectAllCheckbox($event) {
      let columns = document.querySelectorAll('.rowCheckbox')

      this.selectedRows = []

      if ($event.target.checked == true) {
        columns.forEach((column) => {
          column.checked = true
          this.selectedRows.push(parseInt(column.name))
        })
      } else {
        columns.forEach((column) => {
          column.checked = false
        })
        this.selectedRows = []
      }
    }

    return {
      ...Vue.toRefs(state),
      headings,
      benchmarks,
      toggleColumn,
      toggleRowSelect,
      selectAllCheckbox,
    }
  },
})

// Options for our hdr-histogram-style line chart, factored out for re-use:
const makeLatencyLineChartOptions = (minDataPoint, maxDataPoint, otherPlugins, enable_crosshair_zoom = true) => {
  return {
    hover: {
      intersect: false,
    },
    plugins: {
      ...otherPlugins,
      tooltip: {
        mode: 'interpolate',
        intersect: false,
      },
      crosshair: {
        line: {
          color: 'black', // crosshair line color
          width: 0.75, // crosshair line width
          //dashPattern: [15, 3, 3, 3], // crosshair line dash pattern
        },
        sync: {
          enabled: true, // enable trace line syncing with other charts
          group: 1, // chart group
          suppressTooltips: false, // suppress tooltips when showing a synced tracer
        },
        snap: {
          enabled: true,
        },
        zoom: {
          enabled: enable_crosshair_zoom, // enable zooming
          zoomboxBackgroundColor: 'rgba(66,133,244,0.2)', // background color of zoom box
          zoomboxBorderColor: '#48F', // border color of zoom box
          zoomButtonText: 'Reset Zoom', // reset zoom button text
          zoomButtonClass: 'reset-zoom', // reset zoom button class
        },
        callbacks: {
          beforeZoom: function (start, end) {
            // called before zoom, return false to prevent zoom
            return true
          },
          afterZoom: function (start, end) {
            // called after zoom
          },
        },
      },
    },
    scales: {
      x: {
          title: {
            display: true,
            text: 'Latency Percentile',
          },
          grid: {
            color: (ctx) => (ctx.index === 0 ? 'black' : 'rgba(0, 0, 0, 0.1)'),
            display: true,
            tickLength: 3,
          },
          ticks: {
            padding: 5,
            fontSize: 12,
            fontStyle: 'bold',
          },
        },
      y: {
          type: 'logarithmic',
          // This is to work around a new v3 bug: https://github.com/chartjs/Chart.js/issues/10644
          // It sometimes doesn't work, and sometimes looks like shit:
          afterBuildTicks: axis => axis.ticks.push({"value": maxDataPoint}),
          position: 'left',
          grid: {
            display: true,
            lineWidth: 1,
            tickLength: 1,
          },
          title: {
            display: true,
            text: 'Response Time (ms)',
          },
          min: minDataPoint,
          max: maxDataPoint,
          ticks: {
            maxTicksLimit: 10,
            padding: 5,
            fontSize: 12,
            fontStyle: 'bold',
            callback: (value, index, allValues) => {
              return value.toFixed(1)
            },
          },
        },
    },
  }
}

app.component('LatencyLineChart', {
  props: {
    benchData: Array,
  },
  template: /* html */ `
      <div
      class="bg-gray-200 rounded-lg shadow-xl"
      style="
        position: relative;
        width: 800px;
        height: 500px;
        padding: 50px 20px;
        margin: auto;
      "
    >
      <h1>Latency Percentiles Graph</h1>
      <hr />
      <canvas id="chart-container" ref="chartElem"></canvas>
    </div>
  `,
  setup(props) {
    // Collect these so we can properly scale our axes as tight as possible to data
    // (maybe new versions of chart.js make this less painful)
    var minDataPoint = Number.MAX_SAFE_INTEGER
    var maxDataPoint = Number.MIN_SAFE_INTEGER
    const makeDataset = (benchDataEntry) => {
      minDataPoint = Math.min(minDataPoint, benchDataEntry.histogram.json['min'])
      maxDataPoint = Math.max(maxDataPoint, benchDataEntry.histogram.json['max'])
      const label = benchDataEntry.name
      const data = hist_points.map((p) => benchDataEntry.histogram.json[p] || null)  // null, for spanGaps
      const color = getColor()
      return {
        label,
        data,
        fill: false,
        borderWidth: 1,
        pointRadius: 2.5,
        pointBackgroundColor: 'white',
        borderColor:     color,
        backgroundColor: color,
        // Smooth lines, but monotone (no misleading up/down "swooping" to fit data points)
        cubicInterpolationMode: 'monotone',
        // tension: 0.4, //... I'm not convinced this actually does anything...
        spanGaps: true,  // span missing data points, for adhoc results
      }
    }

    const chartElem = ref(null)
    onMounted(() => {
      resetColors()
      const ctx = chartElem.value.getContext('2d')
      const datasets = props.benchData.map(makeDataset)
      const myChart = new Chart(ctx, {
        responsive: true,
        maintainAspectRatio: false,
        type: 'line',
        data: {
          labels: hist_labels,
          datasets,
        },
        options: makeLatencyLineChartOptions(minDataPoint, maxDataPoint, {}),
      })
      resetColors() // for LatencyBasicHistogram's
    })

    return { chartElem }
  },
})

app.component('LatencyBasicHistogram', {
  props: {
    benchDataEntry: Object,
  },
  template: /* html */ `
      <div
      class="bg-gray-200 rounded-lg shadow-xl"
      style="
        position: relative;
        width: 800px;
        height: 700px;
        padding: 50px 20px;
        margin: auto;
      "
    >
      <h1>Latency Histogram: {{benchDataEntry.name}}</h1>
      <hr />
      <canvas height="500px" ref="chartElem"></canvas>
    </div>
  `,
  setup(props) {
    // const makeDataset = (benchDataEntry) => {
    //   const label = benchDataEntry.name
    //   // if (! ('basicHistogram' in benchDataEntry)) return []  // skip if missing // XXXXXXXXXXXXX

    //   const data = benchDataEntry.basicHistogram.map(b => {return {x: b.gte, y: b.count}})
    //   const color = getColor()
    //   return [{
    //     label,
    //     data,
    //     fill: true,
    //     stepped: true,
    //     borderWidth: 1,
    //     pointRadius: 0,
    //     borderColor:     color,
    //     backgroundColor: color+'40',
    //   }]
    // }

    const chartElem = ref(null)
    onMounted(() => {
      const ctx = chartElem.value.getContext('2d')
      const color = getColor()
      // Keep track of max Y to draw our median lines:
      var maxCount = 0
      const hist = props.benchDataEntry.basicHistogram
      const datasets =  [
          {
            label: "All samples",
            order: 3,
            data: hist.buckets.map(b => {
                maxCount = Math.max(b.count, maxCount)
                return {x: b.gte, y: b.count}
            }),
            fill: true,
            stepped: true,
            borderWidth: 1,
            pointRadius: 0,
            borderColor:     color,
            backgroundColor: color,
          },
          {
            label: "First half of samples (w/ counts scaled 2x)",
            order: 2,
            data: hist.buckets.map(b => {
                maxCount = Math.max(b.count1stHalf*2, maxCount)
                return {x: b.gte, y: b.count1stHalf*2}
            }),
            stepped: true,
            borderWidth: 1,
            pointRadius: 0,
            borderColor:     'black',
            borderDash: [5,2],
          },
          // Median markers:
          {
            label: "Median (all samples)",
            order: 1,
            data: [{x: props.benchDataEntry.histogram.json.p50, y: 0},
                   {x: props.benchDataEntry.histogram.json.p50, y: maxCount*1.20}],
            borderWidth: 1,
            pointRadius: 4,
            borderColor:     'green',
            // borderDash: [5,2],
          },
          {
            label: "Median (first 1/2 of samples)",
            order: 1,
            data: [{x: props.benchDataEntry.histogram.json.p501stHalf, y: 0},
                   {x: props.benchDataEntry.histogram.json.p501stHalf, y: maxCount*1.17}],
            borderWidth: 1,
            pointRadius: 3.5,
            borderColor:     'green',
            borderDash: [5,2],
          },
          {
            label: "Median (first 1/4 of samples)",
            order: 1,
            data: [{x: props.benchDataEntry.histogram.json.p501stQuarter, y: 0},
                   {x: props.benchDataEntry.histogram.json.p501stQuarter, y: maxCount*1.14}],
            borderWidth: 1,
            pointRadius: 3,
            borderColor:     'green',
            borderDash: [5,5],
          },
          {
            label: "Median (first 1/8 of samples)",
            order: 1,
            data: [{x: props.benchDataEntry.histogram.json.p501stEighth, y: 0},
                   {x: props.benchDataEntry.histogram.json.p501stEighth, y: maxCount*1.11}],
            borderWidth: 1,
            pointRadius: 2.5,
            borderColor:     'green',
            borderDash: [5,10],
          },
          // geometric mean markers:
          {
            label: "Geometric mean (all samples)",
            order: 1,
            hidden: true, // unhide with click
            data: [{x: props.benchDataEntry.histogram.json.geoMean, y: 0},
                   {x: props.benchDataEntry.histogram.json.geoMean, y: maxCount*1.20}],
            borderWidth: 1,
            pointRadius: 4,
            borderColor:     'red',
            // borderDash: [5,2],
          },
          {
            label: "Geometric mean (first 1/2 of samples)",
            order: 1,
            hidden: true, // unhide with click
            data: [{x: props.benchDataEntry.histogram.json.geoMean1stHalf, y: 0},
                   {x: props.benchDataEntry.histogram.json.geoMean1stHalf, y: maxCount*1.17}],
            borderWidth: 1,
            pointRadius: 3.5,
            borderColor:     'red',
            borderDash: [5,2],
          },
          {
            label: "Geometric mean (first 1/4 of samples)",
            order: 1,
            hidden: true, // unhide with click
            data: [{x: props.benchDataEntry.histogram.json.geoMean1stQuarter, y: 0},
                   {x: props.benchDataEntry.histogram.json.geoMean1stQuarter, y: maxCount*1.14}],
            borderWidth: 1,
            pointRadius: 3,
            borderColor:     'red',
            borderDash: [5,5],
          },
          {
            label: "Geometric mean (first 1/8 of samples)",
            order: 1,
            hidden: true, // unhide with click
            data: [{x: props.benchDataEntry.histogram.json.geoMean1stEighth, y: 0},
                   {x: props.benchDataEntry.histogram.json.geoMean1stEighth, y: maxCount*1.11}],
            borderWidth: 1,
            pointRadius: 2.5,
            borderColor:     'red',
            borderDash: [5,10],
          },
      ]
      const myChart = new Chart(ctx, {
        responsive: true,
        maintainAspectRatio: false,
        type: 'line',
        data: {
          // labels: hist_labels,
            // datasets: datasets.concat([{borderColor: 'red', data:[{x: 2, y: 0},{x: 2, y: 12000}]}]), // XXXXXXXXXXX
          datasets,
        },
        options: {
          onClick: (e, _,  chart) => {
              // // toggle scale:
              // const x = chart.options.scales.x
              // if (x.type === 'logarithmic') { x.type = 'linear' } else { x.type = 'logarithmic' }
              // chart.update()
              chart.data.datasets.forEach( (obj) => {
                if (obj.label.startsWith("Geometric mean") || obj.label.startsWith("Median")) {
                  if (obj.hidden) { obj.hidden = false } else { obj.hidden = true }
                }
                chart.update()
              })
          },
          scales: {
            y: {
              title: {
                text: 'Count',
                display: true,
              },
            },
            x: {
              title: {
                text: `Latency bucket (ms)...   (NOTE: ${hist.outliersRemoved} largest samples omitted)`,
                display: true,
              },
              type: 'linear',
              position: 'bottom'
            }
          }
        }
      })
    })

    return { chartElem }
  },
})

// A line chart like LatencyLineChart, but comparing the same benchmark across
// different runs, when in multiBenchData mode:
app.component('MultiLatencyLineChart', {
  props: {
    benchData: Array,
    benchName: String,
  },
  template: /* html */ `
      <div
      class="bg-gray-200 rounded-lg shadow-xl"
      style="
        position: relative;
        width: 800px;
        padding: 50px 20px;
        margin: auto;
      "
    >
      <h1>{{benchName.replace("-k6-custom","").replaceAll("_"," ")}}</h1>
      <hr />
      <canvas height="250" ref="chartElem"></canvas>
    </div>
  `,
  // ^^^ NOTE: before changing height styling above, make sure it looks good
  //           with a chart of at least 50 runs
  setup(props) {
    const chartElem = ref(null)
    onMounted(() => {
      // Collect these so we can properly scale our axes as tight as possible to data
      // (maybe new versions of chart.js make this less painful)
      var minDataPoint = Number.MAX_SAFE_INTEGER
      var maxDataPoint = Number.MIN_SAFE_INTEGER
      const makeDataset = (benchDataEntry, ix) => {
        minDataPoint = Math.min(minDataPoint, benchDataEntry['min'])
        maxDataPoint = Math.max(maxDataPoint, benchDataEntry['max'])
        const label = benchDataEntry.name
        const data = hist_points.map((p) => benchDataEntry[p] || null) // null, for spanGaps
        const color = redToBlue(ix, props.benchData.length)
        return {
          label,
          data,
          fill: false,
          borderWidth: 1.5,
          pointRadius: ((props.benchData.length > 3) ? 0 : 3),
          // This is a heatmap-style red to blue color scheme which lets us show
          // the results "fading back in time":
          borderColor:     color,
          backgroundColor: color,
          // pointBackgroundColor: 'white',
          // Smooth lines, but monotone (no misleading up/down "swooping" to fit data points)
          cubicInterpolationMode: 'monotone',
          spanGaps: true,  // span missing data points, for adhoc results
        }
      }
      // Options to allow zooming: https://www.chartjs.org/chartjs-plugin-zoom/ 
      const zoomOptions = {
        zoom: {
          pan: {
            enabled: true,
          },
          zoom: {
            pinch: {
              enabled: true,
            },
            wheel: {
              enabled: true,
            },
            mode: 'y',
          }
        }
      }

      const ctx = chartElem.value.getContext('2d')
      const datasets = props.benchData.map(makeDataset)
      const myChart = new Chart(ctx, {
        responsive: true,
        maintainAspectRatio: false,
        type: 'line',
        data: {
          labels: hist_labels,
          datasets,
        },
        // NOTE: this isn't really compatible with crosshair.zoom, so we disable that here:
        options: makeLatencyLineChartOptions(minDataPoint, maxDataPoint, zoomOptions, false),
      })
    })

    return { chartElem }
  },
})

app.component('MeanBarChart', {
  props: {
    benchData: Array,
    title: String,
    height: Number,
    width: Number,
  },
  setup(props) {
    const aggregateData = props.benchData.flatMap((it) => {
      return {
        metric: "mean",
        name: it.name,
        value: Number(it.histogram.json["mean"].toFixed(2)),
      }
    })

    onMounted(() => {
      MG.data_graphic({
        title: props.title,
        data: aggregateData,
        description: 'Mean latency, for each benchmark in this set',
        chart_type: 'bar',
        y_accessor: 'value',
        x_accessor: 'name',
        xgroup_accessor: 'metric',
        full_width: true,
        full_height: true,
        // height: props.height,
        // width: props.width,
        // Buffer = padding
        buffer: 40,
        size_accessor: 'size',
        // size_domain: [-1, 1],
        // size_range: [3, 10],
        target: '#aggregate-bar-chart',
      })
    })
  },
  template: /* html */ `
    <component is="style">
      .h-128 {
        height: 32rem;
      }
    </component>
    <div 
      id="aggregate-bar-chart"
      class="bg-gray-200 rounded-md shadow-lg p-4 mx-5 w-2/5 h-128">
    </div>
  `,
})

// return a color uniformly along a gradient for an element in a list at index
// `ix`, where the list has length `totalCount`
const redToBlue = (ix, totalCount) => {
  // This is a copy of the brewer.RdYlBu11 colorscheme:
  const redToBlue11Scheme = ["#a50026", "#d73027", "#f46d43", "#fdae61", "#fee090", "#ffffbf", "#e0f3f8", "#abd9e9", "#74add1", "#4575b4", "#313695"]
  const color = window.colorInterpolate(redToBlue11Scheme)
  return color(ix/(totalCount-1))
}
const redToBlueArray = (totalCount) => {
  return [...Array(totalCount).keys()].map((ix) => redToBlue(ix, totalCount))
}

// This one gets used to show the different memory stats as a simple bar chart,
// when in multiBenchData mode:
app.component('MemoryMultiBarChart', {
  props: {
    benchData: Array,
    title: String,
    metric: String,
  },
  setup(props) {
    var data = []
    var labels = []
    props.benchData.forEach((it) => {
      labels.push(it.name)
      data.push(Number(it[props.metric].toFixed(2)))
    })

    const chartElem = ref(null)
    onMounted(() => {
      const ctx = chartElem.value.getContext('2d')
      const myChart = new Chart(ctx, {
        responsive: true,
        maintainAspectRatio: false,
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: props.title,
            data,
            // borderColor: [],
            borderWidth: 2,
            backgroundColor: redToBlueArray(data.length),
          }],
        },
        options: {
          maintainAspectRatio: false,
          responsive: true,
          scales: {
            y: {
                position: 'left',
                beginAtZero: true,
                grid: {
                  display: true,
                  lineWidth: 1,
                  tickLength: 1,
                },
                title: {
                  display: true,
                  text: 'Memory/Allocation',
                },
                ticks: {
                  maxTicksLimit: 10,
                  padding: 5,
                  fontSize: 12,
                  fontStyle: 'bold',
                  callback: (value, index, allValues) => {
                    // Bytes to megabytes:
                    return (value/1_000_000).toFixed(1)+" MB"
                  },
                },
              },
          },
        },
      })
    })
    return { chartElem }
  },
  template: /* html */ `
      <div
      style="
        height: 400px;
      "
      class="bg-gray-200 rounded-lg shadow-xl flex1 bg-gray-200 rounded-md shadow-lg p-4 mx-5 w-2/5 h-128"
    >
      <canvas ref="chartElem"></canvas>
    </div>
  `,
})


app.component('AggregateScatterPlot', {
  props: {
    benchData: Array,
    title: String,
    height: Number,
    width: Number,
  },
  setup(props) {
    function makeScatterplotData(benchData) {
      let lastCount = 0
      let res = []
      let stats = benchData.histogram.parsedStats
      for (let stat of stats) {
        let amount = stat.totalCount - lastCount
        let value = Math.round(stat.value)
        res.push({ name: benchData.name, amount, value })
        lastCount = stat.totalCount
      }
      return res.filter((it) => it.amount != 0)
    }

    onMounted(() => {
      MG.data_graphic({
        chart_type: 'point',
        title: props.title,
        description: 'Scatterplot of (histogram response times * count)',
        data: props.benchData.flatMap(makeScatterplotData),
        // width: 400,
        // height: 250,
        full_width: true,
        full_height: true,
        target: '#aggregate-scatterplot-chart',
        x_accessor: 'value',
        y_accessor: 'amount',
        color_accessor: 'name',
        color_type: 'category',
      })
    })
  },
  template: /* html */ `
    <component is="style">
      .h-128 {
        height: 32rem;
      }
    </component>
    <div 
      id="aggregate-scatterplot-chart"
      class="bg-gray-200 rounded-md shadow-lg p-2 mx-5 w-2/5 h-128">
    </div>
  `,
})

// This graph is only displayed when extended_hasura_checks results are present
app.component('MemoryStats', {
  props: {
    benchData: Array,
    title: String,
    height: Number,
    width: Number,
  },
  setup(props) {
    const aggregateData = props.benchData.flatMap((it) => {
      let metrics = ['bytes_allocated_per_request', 'live_bytes_before', 'live_bytes_after', 'mem_in_use_bytes_before', 'mem_in_use_bytes_after']
      return metrics.map((metric) => {
        return {
          metric: metric.replaceAll("bytes_","").replaceAll("_", " "),
          name: it.name,
          value: Number(it.extended_hasura_checks[metric].toFixed(2)),
        }
      })
    })

    onMounted(() => {
      MG.data_graphic({
        title: props.title,
        data: aggregateData,
        description: 'Memory and allocation stats, for each benchmark in this set',
        chart_type: 'bar',
        y_accessor: 'value',
        x_accessor: 'name',
        xgroup_accessor: 'metric',
        full_width: true,
        full_height: true,
        buffer: 40,
        size_accessor: 'size',
        target: '#memory-stats',
      })
    })
  },
  template: /* html */ `
    <component is="style">
      .h-128 {
        height: 32rem;
      }
    </component>
    <div 
      id="memory-stats"
      class="bg-gray-200 rounded-md shadow-lg p-4 mx-5 w-4/5 h-128">
    </div>
  `,
})

app.mount('#app')
