The bench report visualizer tool here can be opened locally with a browser, and
will ask you to select report JSON from your local filesystem.

We also expose this as a GitHub Page (for convenient linking, etc) at:

https://hasura.github.io/graphql-bench/app/web-app/

You can aslo display a specific report by including the URL to the JSON in the
URL fragment (assuming CORS is configured properly), for example:

https://hasura.github.io/graphql-bench/app/web-app/#https://hasura-benchmark-results.s3.us-east-2.amazonaws.com/mono-pr-1866/chinook.json

...or using the shorthand form for:

https://hasura.github.io/graphql-bench/app/web-app/#mono-pr-1866/chinook

Multiple reports can be specified (or chosen using the file-picker) to display
a regression report that compares each individual benchmark across runs:

https://hasura.github.io/graphql-bench/app/web-app/#mono-pr-1866/chinook,mono-pr-1849/chinook,mono-pr-1843/chinook

Visualizations will assume the list of runs is in reverse chronological order,
but this mostly doesn't matter.
