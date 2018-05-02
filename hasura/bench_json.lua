local json = require "json"

function file_exists(file)
  local f = io.open(file, "r")
  if f~=nil then
    local content = f:read("*all")
    io.close(f)
    return content
  else
    error("file not found")
  end
end

local req_body = ""

function init(args)
  -- args[0] is the url
  req_body = file_exists(args[1])
end

function request()
  wrk.method = "POST"
  wrk.path   = "/v1/query"

  wrk.headers["Content-Type"] = "application/json"
  wrk.headers["X-Hasura-Role"]    = "admin"
  wrk.headers["X-Hasura-User-Id"] = "1"

  wrk.body = req_body
  return wrk.format()
end
