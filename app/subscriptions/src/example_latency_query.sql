WITH album_ids_cte AS (
    SELECT *, event_data->'data'->'albums'->0->'id' as album_id FROM events
)

SELECT *, now() - event_time AS latency
FROM album_ids_cte
INNER JOIN albums
ON albums.id = album_ids_cte.album_id::int
LIMIT 10