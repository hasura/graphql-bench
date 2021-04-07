-- init     = function(args)
-- request  = function()
-- response = function(status, headers, body)
-- done     = function(summary, latency, requests)
json = require "json"

-- Set the default HTTP method and empty "headers" table here
wrk.method = "POST"
wrk.headers = {}

function tprint (tbl, indent)
  if not indent then indent = 0 end
  for k, v in pairs(tbl) do
    formatting = string.rep("  ", indent) .. k .. ": "
    if type(v) == "table" then
      print(formatting)
      tprint(v, indent+1)
    elseif type(v) == 'boolean' then
      print(formatting .. tostring(v))		
    else
      print(formatting .. v)
    end
  end
end

function print_params(params_table)
  print('========')
  print('[PARAMS]')
  tprint(params_table)
  print('========')
end

function print_wrk_config()
  local _wrk = {
    scheme  = wrk.scheme,
    host    = wrk.host,
    port    = wrk.port,
    method  = wrk.method,
    headers = wrk.headers,
    body    = wrk.body
  }
  print('-----')
  print('[WRK CONFIG]')
  tprint(_wrk)
  print('-----')
end

function init(args)
  url, params = args[0], args[1]
  -- print('url', url)
  -- print('params', params)
  if not params then print('ERROR: NO PARAMS PASSED TO WRK2') end

  params = json.decode(params)
  --print_params(params)
  
  if params['headers'] ~= nil then 
    for header, val in pairs(params['headers']) do
      wrk.headers[header] = val
    end
  end

  wrk.body = json.encode({
    query = params['query'],
    variables = params['variables'],
  })

  --print_wrk_config()
end

function request()
  return wrk.request()
end

function format_summary_to_json(summary, latency)
  local stats = {
    requests = summary.requests,
    duration_in_milliseconds = summary.duration / 1000,
    bytes = summary.bytes,
    -- 1e6 = 1,000,000
    requests_per_second = (summary.requests/summary.duration) * 1e6,
    bytes_transfer_per_second = (summary.bytes/summary.duration) * 1e6,
  }

  local latency_aggregate = {
    min = latency.min / 1000,
    max = latency.max / 1000,
    mean = latency.mean / 1000,
    stdev = latency.stdev / 1000,
  }

  local latency_distribution = {}
  for idx, p in ipairs({ 50, 75, 90, 95, 97.5, 99, 99.9, 99.99, 99.999, 100 }) do
    n = latency:percentile(p)
    latency_distribution[idx] = { percentile = p, latency_in_milliseconds = n / 1000 }
  end

  stats.latency_aggregate = latency_aggregate
  stats.latency_distribution = latency_distribution

  json_stats = json.encode(stats)
  return stats, json_stats
end

function file_exists(filename)
  local file = io.open(filename, "rb")
  if file then file:close() end
  return file ~= nil
end

function read_file(filename)
  local file = assert(io.open(filename, "r"))
  local text = file:read("*all")
  file:close()
end

function write_file(filename, content)
  local file = assert(io.open(filename, "w"))
  file:write(content)
  file:close()
end

function done(summary, latency, requests)
  stats_table, json_stats = format_summary_to_json(summary, latency)
  io.stderr:write(json_stats)
  -- Commenting out this file write, just grab it and parse it from stderr for now
  -- write_file('/tmp/wrk2-stats.json', json_stats)
end
  
-- function wrk.format(method, path, headers, body)
    -- wrk.format returns a HTTP request string containing the passed
    -- parameters merged with values from the wrk table.
  
-- global init     -- function called when the thread is initialized
-- global request  -- function returning the HTTP message for each request
-- global response -- optional function called with HTTP response data
-- global done     -- optional function called with results of run
