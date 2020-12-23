graphql-bench
=============



[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/graphql-bench.svg)](https://npmjs.org/package/graphql-bench)
[![Downloads/week](https://img.shields.io/npm/dw/graphql-bench.svg)](https://npmjs.org/package/graphql-bench)
[![License](https://img.shields.io/npm/l/graphql-bench.svg)](https://github.com/GavinRay97/graphql-bench/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g graphql-bench
$ graphql-bench COMMAND
running command...
$ graphql-bench (-v|--version|version)
graphql-bench/0.0.0 linux-x64 node-v14.6.0
$ graphql-bench --help [COMMAND]
USAGE
  $ graphql-bench COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`graphql-bench hello [FILE]`](#graphql-bench-hello-file)
* [`graphql-bench help [COMMAND]`](#graphql-bench-help-command)

## `graphql-bench hello [FILE]`

describe the command here

```
USAGE
  $ graphql-bench hello [FILE]

OPTIONS
  -f, --force
  -h, --help       show CLI help
  -n, --name=name  name to print

EXAMPLE
  $ graphql-bench hello
  hello world from ./src/hello.ts!
```

_See code: [src/commands/hello.ts](https://github.com/GavinRay97/graphql-bench/blob/v0.0.0/src/commands/hello.ts)_

## `graphql-bench help [COMMAND]`

display help for graphql-bench

```
USAGE
  $ graphql-bench help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.2.0/src/commands/help.ts)_
<!-- commandsstop -->
