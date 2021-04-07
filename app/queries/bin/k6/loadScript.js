import http from 'k6/http'
import { check } from 'k6'

export default function () {
  let { url, headers, query, variables } = __ENV

  // Can't pass nested JSON in config file, need to parse here because stringified
  if (headers) headers = JSON.parse(headers)
  if (variables) variables = JSON.parse(variables)

  // Prepare query & variables (if provided)
  let body = JSON.stringify({ query, variables })

  // Send the request
  let res = http.post(url, body, { headers })

  // Run assertions on status, errors in body, optionally results count
  let check_cxt = { 'is status 200': (r) => r.status === 200, }
  if (res.body) { // unavailable if discardResponseBodies: true
    check_cxt['no error in body'] = (r) => Boolean(r.json('errors')) == false
  }
  check(res, check_cxt)
}
