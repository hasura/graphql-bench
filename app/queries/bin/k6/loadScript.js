import http from 'k6/http'
import { check } from 'k6'

var cachedFileVariables;
var fileVariablesCurrentIndex = 0;

/**
 * Use ES5 syntax
 */
export default function () {
  let { url, headers, query, variables, fileVariables } = __ENV

  // Can't pass nested JSON in config file, need to parse here because stringified
  if (headers) headers = JSON.parse(headers)
  if (variables) variables = JSON.parse(variables)
  // Storing the JSONified fileVariables to not deserialize in every iteration
  if (!cachedFileVariables) {
    cachedFileVariables = JSON.parse(fileVariables)
  }

  let combinedVariables;

  if (cachedFileVariables.length!=0) {
    // TODO: can look at getting a random value beween 0 and cachedFileVariables.length rather than iterating for ensured randomness
    if (fileVariablesCurrentIndex >= cachedFileVariables.length) {
      fileVariablesCurrentIndex = 0;
    }    
    combinedVariables = Object.assign({}, variables, cachedFileVariables[fileVariablesCurrentIndex]);  
    fileVariablesCurrentIndex++;  
  } else {
    combinedVariables = variables;
  }
  

  // Prepare query & variables (if provided)
  let body = JSON.stringify({ query, variables: combinedVariables })

  // Send the request
  let res = http.post(url, body, { headers })

  // Run assertions on status, errors in body, optionally results count
  let check_cxt = { 'is status 200': (r) => r.status === 200, }
  if (res.body) { // unavailable if discardResponseBodies: true
    check_cxt['no error in body'] = (r) => Boolean(r.json('errors')) == false
  }
  check(res, check_cxt)
}
