.PHONY: run_docker_query_bench run_docker_subscription_bench seed_chinook_database help

00000000: ## --------------------------------------------------
00README: ## RECOMMENDED PROCESS: setup_containers -> seed_chinook_database -> build_local_docker_image -> run_docker_query_bench
00TIPS:   ## You can alter the query & subscription benchmark config in ./docker-run-test/config.(query|subscription).yaml
01TIPS:   ## By default it works with the Hasura & Chinook setup provided here.
88888888: ## --------------------------------------------------

build_local_docker_image: ## Builds ands tags a local docker image of graphql-bench
	docker build -t graphql-bench-local:latest ./app

run_docker_query_bench: ## Runs local docker container query benchmark, using config.query.yaml in ./docker-run-test
	./docker-run-test/run-query-bench-docker.sh

run_docker_subscription_bench: ## Runs local docker container subscription benchmark, using the default config.subscription.yaml in ./docker-run-test
	./docker-run-test/run-subscription-bench-docker.sh "config.subscription.yaml"

run_docker_subscription_bench_mssql: ## Runs local docker container subscription benchmark, using config.mssql.subscription.yaml in ./docker-run-test
	./docker-run-test/run-subscription-bench-docker.sh "config.mssql.subscription.yaml"

setup_containers: ## Sets up Hasura, Postgres and SQL Server Docker containers
	cd containers && docker-compose up -d --force-recreate && ./graphql-wait.sh

seed_chinook_database: ## Creates Chinook database schema & seed data in Hasura for testing
	./containers/psql-seed-chinook.sh

seed_chinook_database_mssql: ## Creates Chinook database schema & seed data in Hasura for testing
	./containers/mssql-seed-chinook.sh

setup_events_table: ## Sets up events table for subscriptions
	./containers/psql-setup-events-table.sh

run_update_rows: ## Updates rows to trigger data events
	./containers/update-rows.sh psql

run_update_rows_mssql: ## Updates rows to trigger data events
	./containers/update-rows.sh mssql

start_container_report: ## Starts cadvisor for Docker container stats reporting
	./reports/start-cadvisor

cleanup:
	cd containers && docker-compose stop && docker-compose rm && docker rm -f containers_graphql_bench_subs_1

install_wrk2: ## Handles installing or cloning and compiling wrk2 from source on either Mac or Debian-based Linux (for local non-Docker development)
	OS := $(shell uname)
	ifeq ($(OS),Darwin)
		brew tap jabley/homebrew-wrk2
		brew install --HEAD wrk2
	else
	  # Installs the build tools, open ssl dev libs (including headers), and git. Then uses git to download wrk and build.
		sudo apt-get update
		sudo apt-get install -y build-essential libssl-dev git zlib1g-dev
		git clone https://github.com/giltene/wrk2.git
		cd wrk2
		make
		# Move the executable to somewhere in your PATH
		sudo cp wrk /usr/local/bin
		# Finally, delete the repo folder
		cd ../
		sudo rm -rf wrk
	endif

install_k6: ## Handles installing k6 either Mac or Debian-based Linux (for local non-Docker development)
	OS := $(shell uname)
	ifeq ($(OS),Darwin)
		brew install k6
	else
		sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 379CE192D401AB61
		echo "deb https://dl.bintray.com/loadimpact/deb stable main" | sudo tee -a /etc/apt/sources.list
		sudo apt-get update
		sudo apt-get install k6
	endif

setup_all: ## Sets up containers and then creates Chinook database
	setup_containers setup_events_table

# Subscriptions / Postgres
setup_psql: setup_containers setup_events_table seed_chinook_database build_local_docker_image
run_benchmark_psql: run_docker_subscription_bench run_update_rows
benchmark_psql: setup_psql run_benchmark_psql cleanup

# Subscriptions / SQL Server
setup_mssql: setup_containers setup_events_table seed_chinook_database_mssql build_local_docker_image
run_benchmark_mssql: run_docker_subscription_bench_mssql run_update_rows_mssql
benchmark_mssql: setup_mssql run_benchmark_mssql cleanup

help:
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
