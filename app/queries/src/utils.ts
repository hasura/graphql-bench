import * as fs from 'fs'
import readline from 'readline'

import * as hdr from 'hdr-histogram-js'

async function* parseNDJSON(filepath: string) {
  const filestream = fs.createReadStream(filepath)
  const lines = readline.createInterface({
    input: filestream,
    crlfDelay: Infinity,
  })

  for await (const line of lines) {
    yield JSON.parse(line)
  }
}

interface ParsedHDRHistogramSummary {
  buckets: number
  count: number
  max: number
  mean: number
  stddev: number
  sub_buckets: number
}

interface ParsedHDRHistogramValue {
  value: number
  percentile: number
  total_count: number
  of_one_percentile: number
}

interface ParsedHDRHistogram {
  summary: ParsedHDRHistogramSummary
  values: ParsedHDRHistogramValue[]
}

type Primitive =
  | StringConstructor
  | NumberConstructor
  | DateConstructor
  | BooleanConstructor

function convertPropertiesTo(type: Primitive, obj: any) {
  for (let k in obj) obj[k] = type(obj[k])
  return obj
}

function parseHdrHistogram(text: string): ParsedHDRHistogram {
  let valuesRegex = new RegExp(
    /(?<value>\d+\.?\d*)[ ]+(?<percentile>\d+\.?\d*)[ ]+(?<total_count>\d+\.?\d*)([ ]+(?<of_one_percentile>\d+\.?\d*))?/g
  )

  // prettier-ignore
  let summaryRegex = new RegExp(
    /#\[Mean    =       (?<mean>\d+\.?\d*), StdDeviation   =        (?<stddev>\d+\.?\d*)]/.source + "\n" +
    /#\[Max     =       (?<max>\d+\.?\d*), Total count    =         (?<count>\d+\.?\d*)]/.source + "\n" +
    /#\[Buckets =            (?<buckets>\d+\.?\d*), SubBuckets     =         (?<sub_buckets>\d+\.?\d*)]/.source,
    'g'
  )

  // prettier-ignore
  const values: ParsedHDRHistogramValue[] = [...text.matchAll(valuesRegex)]
    .flatMap((it) => convertPropertiesTo(Number, it.groups as any))

  const summary: ParsedHDRHistogramSummary = [...text.matchAll(summaryRegex)]
    .flatMap((it) => convertPropertiesTo(Number, it.groups as any))
    .pop()

  return { summary, values }
}

let testString =
  // prettier-ignore
  `	       Value     Percentile TotalCount 1/(1-Percentile)
       7.000 0.000000000000          9           1.00
      10.000 0.100000000000        152           1.11
      12.000 0.200000000000        408           1.25
      12.000 0.300000000000        408           1.43
      13.000 0.400000000000        538           1.67
      14.000 0.500000000000        647           2.00
      15.000 0.550000000000        736           2.22
      16.000 0.600000000000        823           2.50
      17.000 0.650000000000        879           2.86
      18.000 0.700000000000        930           3.33
      19.000 0.750000000000        982           4.00
      20.000 0.775000000000       1029           4.44
      20.000 0.800000000000       1029           5.00
      21.000 0.825000000000       1059           5.71
      22.000 0.850000000000       1083           6.67
      24.000 0.875000000000       1144           8.00
      24.000 0.887500000000       1144           8.89
      25.000 0.900000000000       1165          10.00
      25.000 0.912500000000       1165          11.43
      26.000 0.925000000000       1185          13.33
      27.000 0.937500000000       1200          16.00
      28.000 0.943750000000       1212          17.78
      28.000 0.950000000000       1212          20.00
      29.000 0.956250000000       1219          22.86
      31.000 0.962500000000       1229          26.67
      32.000 0.968750000000       1236          32.00
      33.000 0.971875000000       1247          35.56
      33.000 0.975000000000       1247          40.00
      33.000 0.978125000000       1247          45.71
      35.000 0.981250000000       1253          53.33
      36.000 0.984375000000       1255          64.00
      37.000 0.985937500000       1258          71.11
      37.000 0.987500000000       1258          80.00
      38.000 0.989062500000       1262          91.43
      38.000 0.990625000000       1262         106.67
      39.000 0.992187500000       1266         128.00
      39.000 0.992968750000       1266         142.22
      39.000 0.993750000000       1266         160.00
      41.000 0.994531250000       1268         182.86
      41.000 0.995312500000       1268         213.33
      42.000 0.996093750000       1271         256.00
      42.000 0.996484375000       1271         284.44
      42.000 0.996875000000       1271         320.00
      42.000 0.997265625000       1271         365.71
      42.000 0.997656250000       1271         426.67
      42.000 0.998046875000       1271         512.00
      42.000 0.998242187500       1271         568.89
      48.000 0.998437500000       1272         640.00
      48.000 0.998632812500       1272         731.43
      48.000 0.998828125000       1272         853.33
      48.000 0.999023437500       1272        1024.00
      48.000 0.999121093750       1272        1137.78
      54.000 0.999218750000       1273        1280.00
      54.000 1.000000000000       1273
#[Mean    =       16.174, StdDeviation   =        6.268]
#[Max     =       54.614, Total count    =         1273]
#[Buckets =            1, SubBuckets     =         2048]
`

function calculateHistogramIntervalCounts(values: ParsedHDRHistogramValue[]) {
  type HistogramPoint = { amount: number; value: number }
  let res: HistogramPoint[] = []

  let lastCount = 0
  for (let entry of values) {
    let amount = entry.total_count - lastCount
    let value = entry.value
    res.push({ amount, value })
    lastCount = entry.total_count
  }

  return res
}

function reconstructHdrHistogramFromParsed(
  parsedHistogram: ParsedHDRHistogram
) {
  const histogram = hdr.build()
  const intervals = calculateHistogramIntervalCounts(parsedHistogram.values)
  for (let entry of intervals)
    histogram.recordValueWithCount(entry.value, entry.amount)
  return histogram
}

export const reconstructHdrHistogramFromText = (text: string) =>
  reconstructHdrHistogramFromParsed(parseHdrHistogram(text))
