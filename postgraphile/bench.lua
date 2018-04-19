local gqbench = require "graphql-bench"

local req_body = ""
function init(args)
  req_body = gqbench.init(args)
end

function request()
  wrk.method = "POST"
  wrk.path   = "/graphql"

  wrk.headers["Content-Type"] = "application/json"

  wrk.body = req_body
  return wrk.format()
end

function done(s, l, r)
  gqbench.done(s, l, r)
end
