CREATE TABLE public.events (
  -- unique label to identify benchmark
  label text NOT NULL,
  -- connection_id represents the n'th connection
  connection_id int NOT NULL,
  operation_id int NOT NULL,
  -- event_number represents the nth event that was received by the client
  event_number int NOT NULL,
  -- event_data stores the payload that was received
  event_data jsonb NOT NULL,
  -- event_time stores the time at which the event was received by the client
  event_time timestamptz NOT NULL,
  -- is_error represents whether the event was error or not
  is_error boolean NOT NULL,
  --  latency is not populated by the benchmark tool, but this can be populated by calculating event_time - <event_triggered_time>
  latency int
)
