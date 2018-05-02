local gqbench = require "graphql-bench"

local req_body = ""
function init(args)
  req_body = gqbench.init(args)
end

function request()
  wrk.method = "POST"
  wrk.path   = "/v1alpha1/graphql"

  wrk.headers["Content-Type"] = "application/json"
  wrk.headers["X-Hasura-Role"]    = "admin"
  wrk.headers["X-Hasura-User-Id"] = "1"

  wrk.body = req_body
  return wrk.format()
end

function done(s, l, r)
  gqbench.done(s, l, r)
end
