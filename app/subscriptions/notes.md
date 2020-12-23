When querying for latency, you must sure to have ordered the fields by "updated_at", or else the item at index "0" may not be the most recently updated item.
This would give very inaccurate results; For example, subscribing to an array of 10 items, updating one, but the 0th index of response is an item whose "updated_at" value is several days old.
