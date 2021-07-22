The bench report visualizer tool here can be opened locally with a browser, and
will ask you to select report JSON from your local filesystem.

We also expose this as a GitHub Page (for convenient linking, etc) at:

https://hasura.github.io/graphql-bench/app/web-app/

You can aslo display a specific report by including the URL to the JSON in the
URL fragment (assuming CORS is configured properly), for example:

https://hasura.github.io/graphql-bench/app/web-app/#https://hasura-benchmark-results.s3.us-east-2.amazonaws.com/mono-pr-1866/chinook.json
