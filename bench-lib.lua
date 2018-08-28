-- A library that can be used in custom lua scripts for benchmarking

local _M = {}

local json = require "json"
local os = require "os"

local function file_exists(file)
  local f = io.open(file, "r")
  if f~=nil then
    local content = f:read("*all")
    io.close(f)
    return content
  else
    error("file not found: " .. file)
  end
end

function _M.init(args)
  -- args[0] is the url
  local queryFile = args[1]
  local operationName = args[2]
  local query = file_exists(queryFile)
  return json.encode({query=query,operationName=operationName})
end

function _M.request(wrk, req_body)
  wrk.method = "POST"
  wrk.headers["Content-Type"] = "application/json"
  wrk.body = req_body
  return wrk.format()
end

local function get_stat_summary(stat)
  local dist = {}
  for _, p in pairs({ 95, 98, 99 }) do
    dist[tostring(p)] = stat:percentile(p)
  end
  return {
    min=stat.min,
    max=stat.max,
    stdev=stat.stdev,
    mean=stat.mean,
    dist=dist
  }
end

local function getTime()
  return os.date("%c %Z")
end

function _M.done(summary, latency, requests)
  io.stderr:write(
    json.encode({
        time=getTime(),
        latency=get_stat_summary(latency),
        summary=summary,
        requests=get_stat_summary(requests)
    })
  )
  io.stderr:write('\n')
end

return _M
