import * as hdr from 'hdr-histogram-js'
import { parseHdrHistogramText } from './executors/base/index'
import { HDRHistogramParsedStats } from './executors/base/types'

/* A wrapper for Histogram that gets us more precision. See
 * https://github.com/HdrHistogram/HdrHistogramJS/issues/35
 *
 * Values inserted will be truncated to `logBase 10 scalingFactor` (i.e. 3)
 * decimal places.
 */
export class PreciseHdrHistogram {
  // We'll need to multiply by scalingFactor anything we insert, and divide by scalingFactor
  // anything we output from here:
  private _histogramDirty: hdr.Histogram
  static scalingFactor: number = 1000

  constructor(
    request: hdr.BuildRequest
  ) {
    this._histogramDirty = hdr.build(request)
  }

  //// On inputs we multiply...
  public recordValue(value: number) {
    this._histogramDirty.recordValue(value*PreciseHdrHistogram.scalingFactor)
  }

  public recordValueWithCount(value: number, count: number): void {
    this._histogramDirty.recordValueWithCount(value*PreciseHdrHistogram.scalingFactor, count)
  }

  //// ...and on outputs we divide:
  public toJSON(): hdr.HistogramSummary {
    let summary = this._histogramDirty.summary
    for (let key in summary) {
      // scale mean and percentiles (but not counts) back down:
      if (key == "totalCount") continue
      summary[key] /= PreciseHdrHistogram.scalingFactor
    }

    return summary
  }
  get mean(): number {
    return (this._histogramDirty.mean / PreciseHdrHistogram.scalingFactor)
  }
  get min(): number {
    // NOTE: 'minNonZeroValue' is already just 'min' since 0 can't be recorded
    return (this._histogramDirty.minNonZeroValue / PreciseHdrHistogram.scalingFactor)
  }
  get stdDeviation(): number {
    return (this._histogramDirty.stdDeviation / PreciseHdrHistogram.scalingFactor)
  }
  // This is our own helper, where formerly we called:
  //    parseHdrHistogramText(histogram.outputPercentileDistribution())
  get parsedStats(): HDRHistogramParsedStats[] {
    let parsedDirty = parseHdrHistogramText(
      this._histogramDirty.outputPercentileDistribution())

    // scale mean and percentiles (but not counts) back down:
    parsedDirty.forEach(function (line) { 
      // i.e. line.value /= PreciseHdrHistogram.scalingFactor
      line.value = String((Number(line.value) / PreciseHdrHistogram.scalingFactor))
    })
    return parsedDirty
  }

  // Don't leak implementation in debugging output, which might be confusing:
  [Symbol.for("nodejs.util.inspect.custom")]() {
    return JSON.stringify(this.toJSON(), null, 2)
  }
}

// Copy-pasted from 'hdr-histogram-js', since this isn't exported
export const defaultRequest: hdr.BuildRequest = {
  bitBucketSize: 32,
  autoResize: true,
  lowestDiscernibleValue: 1,
  highestTrackableValue: 2,
  numberOfSignificantValueDigits: 3,
  useWebAssembly: false,
}

export const build = (request = defaultRequest): PreciseHdrHistogram => {
  return new PreciseHdrHistogram(request) 
}
