/**
 * Usage
 *   node cli [options]
 *
 * Description
 *   The command line interface for aang.
 *
 *   Contains the following built-in programs:
 *    • parse - Parses the provided query and outputs the k-best parse trees.
 *
 *    • test - Parses the suite of test queries and checks output conforms to the
 *    test's specifications.
 *
 *    • benchmark - Benchmarks the duration of parsing the queries in the test
 *    suite.
 *
 *    • printStateTable - Prints the state table generated from the grammar.
 *
 *   Enables configuration of CLI environment variables for executing the above
 *   programs.
 *
 *   Each program is spawn as a child process. This automically enables any changes
 *   to modules outside the CLI, allows the user to kill any process (with `^C`)
 *   without exiting the CLI, and improves benchmark result consistency by
 *   mitigating the impact of process caches.
 *
 * Options
 *   -h, --help  Display this screen.                                     [boolean]
 */

var util = require('./util')

require('yargs')
	.usage(
		util.colors.bold('Usage') + '\n' +
		'  node $0 [options]\n\n' +
		util.colors.bold('Description') + '\n' +
		'  The command line interface for aang.\n\n' +
		'  Contains the following built-in programs:\n' +
		'   • parse - Parses the provided query and outputs the k-best parse trees.\n\n' +
		'   • test - Parses the suite of test queries and checks output conforms to the test\'s specifications.\n\n' +
		'   • benchmark - Benchmarks the duration of parsing the queries in the test suite.\n\n' +
		'   • printStateTable - Prints the state table generated from the grammar.\n\n' +
		'  Enables configuration of CLI environment variables for executing the above programs.\n\n' +
		'  Each program is spawn as a child process. This automically enables any changes to modules outside the CLI, allows the user to kill any process (with `^C`) without exiting the CLI, and improves benchmark result consistency by mitigating the impact of process caches.'
	)
	.updateStrings({
		'Options:': util.colors.bold('Options'),
	})
	.help('h', 'Display this screen.').alias('h', 'help')
	// Fail on unrecognized arguments.
	.strict()
	.argv

var readline = require('readline')
var childProcess = require('child_process')
var fs = require('fs')


var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
})

// Remove older history lines that duplicate new ones.
rl.historyNoDups = true
rl._addHistory = function () {
  if (this.line.length === 0) return ''

  if (this.history.length === 0 || this.history[0] !== this.line) {
  	if (this.historyNoDups) {
  		// Remove previous history index if duplicate.
  		const existingIndex = this.history.indexOf(this.line)
  		if (existingIndex !== -1) this.history.splice(existingIndex, 1)
  	}

    this.history.unshift(this.line)

    // Only store so many.
    if (this.history.length > this.historySize) this.history.pop()
  }

  this.historyIndex = -1
  return this.history[0]
}

// Listen for `^C` (`SIGINT`) in the input stream to exit the CLI.
rl.sawSIGINT = false
rl.on('SIGINT', function () {
	if (this.line.length > 0) {
		// Clear line and reset `sawSIGINT`.
		this.clearLine()
		this.sawSIGINT = false
	} else if (this.sawSIGINT) {
		// Exit CLI.
		this.close()
		return
	} else {
		// Confirm before exiting.
		this.output.write('\n(^C again to quit)\n')
		this.sawSIGINT = true
	}

	this.prompt()
})

/**
 * Spawns a new process within the readline `Interface` (RLI) to asynchronously run `command` with `args`.
 *
 * Executes `command` as an asynchronous child process, leaving the event loop unblocked, but with the appearance of running synchronously. I.e., the user cannot enter input (e.g., commands) during the process, but can terminate the process and return to the RLI with `^C`. In contrast, Node's default RLI blocks the event loop, requiring processes to complete before accepting any input (including `^C`).
 *
 * Disables the RLI's `stdio` (input and output) while the child is processing, except for `^C` (`SIGINT`) to terminate the child. Restores the RLI `stdio` when the child exits or terminates.
 *
 * @param {string} command The command to run as a child process.
 * @param {string[]} args The command line arguments for `command`.
 * @param {string|Array} [stdio=[ 'ignore', process.stdout, process.stderr ]] The optional child process's `stdio` configuration.
 * @param {Function} [callback] The optional function to execute after the child process exits and before returning control to the RLI.
 */
rl.spawnChildProcess = function (command, args, stdio, callback) {
	// Check arity.
	if (typeof stdio === 'function') {
		callback = stdio
		stdio = null
	}

	// Prevent printing prompt when executing child process, but continue processing input such as `^C` for `SIGINT` (which `rl.pause()` would prevent).
	this.paused = true

	// Launches a new process with `command` and the command line arguments in `args`. This child process avoids blocking the event loop. Unless `stdio` is provided as an argument, the child process ignores input and inherits `stdout` and `stderr`.
	var child = childProcess.spawn(command, args, {
		stdio: stdio || [ 'ignore', process.stdout, process.stderr ]
	})

	// Disable output from RLI while child is processing.
	var origStdoutWrite = this.output.write
	this.output.write = function () {}

	// Temporarily remove RLI `line` event listener(s) (when the user hits `enter`).
	var lineListeners = this.listeners('line')
	this.removeAllListeners('line')

	// Send `SIGINT` to child process when received by the RLI.
	function killChild() {
		child.kill('SIGINT')
	}

	// Temporarily replace existing RLI `SIGINT` event listener(s).
	var SIGINTListeners = this.listeners('SIGINT')
	this.removeAllListeners('SIGINT')
	this.on('SIGINT', killChild)

	child.on('error', function (err) {
		util.logError('Failed to start child process:', err.code)
	})

	var self = this
	child.on('close', function (code, signal) {
		// Restore `stdout`.
		self.output.write = origStdoutWrite

		// Restore `SIGINT` event listeners(s).
		self.removeListener('SIGINT', killChild)
		SIGINTListeners.forEach(function (listener) {
			self.on('SIGINT', listener)
		})

		if (signal) {
			// `child` was killed (most often is due to `SIGINT` sent by the RLI).
			util.logError('Child process terminated due to receipt of signal', signal)
		} else if (code !== 0) {
			// `child` exited with a 'failure' code (most often after an exception is thrown).
			util.logError('Child process exited with code', code)
		} else if (callback) {
			// `child` exited normally. Execute `callback` before returning control to the RLI.
			callback()
		}

		// Restore `line` event listener(s).
		lineListeners.forEach(function (listener) {
			self.on('line', listener)
		})

		// Resume RLI.
		self.prompt()
	})
}

/**
 * Assigns `commands` for the RLI to process. Automatically implements `tab` autocompletion for the command names.
 *
 * Commands are executed in the RLI with a leading period followed by the command name: `.command`. Commands are passed all arguments that follow the command name.
 *
 * @param {Object} commands The functions the RLI will process.
 * @example
 *
 * rl.setCommands({
 *   echo: function (string) {
 *     console.log(string)
 *   }
 * })
 *
 * > <tab>
 * => .echo
 * > .ec<tab> -> .echo -> .echo hello
 * => hello
 */
rl.setCommands = function (commands) {
	this.commands = commands

	// Command names used by `completer`.
	this.commandNames = Object.keys(commands).map(function (commandName) {
		return '.' + commandName
	})

	// `tab` autocompleter.
	var self = this
	var completer = function (line) {
		// Find all command names that can follow input.
		var matches = self.commandNames.filter(function (commandName) {
			return commandName.indexOf(line) === 0
		})

		// Show nothing if no completions found.
		return [ matches, line ]
	}

	// Run `completer` synchronously.
	this.completer = function (v, cb) {
		cb(null, completer(v))
	}
}

/**
 * Listens for `\n` in input stream, usually received when the user hits `return`. Executed when input is not a recognized command (set in `rl.setCommands()`).
 */
rl.on('line', function (line) {
	// Reset `SIGINT` confirmation.
	this.sawSIGINT = false

	var query = line.trim()
	if (query) {
		if (query[0] === '.') {
			var args = query.split(' ')
			var command = args[0].slice(1)

			// Execute command if found, else display usage.
			var commandFunc = this.commands[command] || this.commands['help']

			// Pass all arguments.
			commandFunc.apply(null, args.splice(1))
		} else {
			this.spawnChildProcess('node', [
				'./parser/parse.js',
				query,
				'--k=' + config.k,
				'--benchmark=' + config.printTime,
				'--output=' + config.printOutput,
				'--print-costs=' + config.printCosts,
				'--print-trees=' + config.printTrees,
				'--print-stack=' + config.printStack,
				'--print-forest=' + config.printForest,
				'--print-forest-graph=' + config.printForestGraph,
			])
		}
	}

	// Do not print prompt when a child is process.
	if (!this.paused) {
		this.prompt()
	}
})

// Use a better prompt character.
rl.setPrompt('❯ ')

// Readies RLI for input and displays the prompt character.
rl.prompt()


// Parser settings.
var config = {
	k: 7,
	printOutput: true,
	printTrees: false,
	printCosts: false,
	printTime: false,
	printQuery: false,
	printStack: false,
	printForest: false,
	printForestGraph: false,
}

// CLI commands, executed via `.command`.
rl.setCommands({
	// Parse the suite of test queries.
	test: function (k) {
		rl.spawnChildProcess('node', [
			'./test/test.js',
			'--k=' + (isNaN(k) ? 50 : k),
			'--benchmark=' + config.printTime,
			'--output=' + config.printOutput,
			'--print-costs=' + config.printCosts,
			'--print-trees=' + config.printTrees,
			'--print-stack=' + config.printStack,
			'--print-forest=' + config.printForest,
			'--print-forest-graph=' + config.printForestGraph,
		])
	},

	// Benchmark the duration of parsing the test suite.
	benchmark: function (numRuns) {
		rl.spawnChildProcess('node', [
			'./benchmark/benchmark.js',
			'--num-runs=' + (isNaN(numRuns) ? 1 : numRuns),
		])
	},

	// Write output of a parse of the test suite to file.
	logTest: function (filepath) {
		// Create file if does not exist, truncates file to zero length if it does exist, or throw an exception if `outPath` is a directory.
		var outPath = util.expandHomeDir(filepath || '~/Desktop/out')
		var outFD = fs.openSync(outPath, 'w')

		// Spawn test as a child process, outputting to a file at `outPath`.
		rl.spawnChildProcess('node', [
			'./test/test.js',
			'--k=' + 50,
			'--benchmark=' + config.printTime,
			'--output=' + config.printOutput,
			'--print-costs=' + config.printCosts,
			'--print-trees=' + config.printTrees,
			'--print-stack=' + config.printStack,
			'--print-forest=' + config.printFrest,
			'--print-forest-graph=' + config.printForestGraph,
		], [ 'ignore', outFD, outFD ], function () {
			util.log('Test output saved:', fs.realpathSync(outPath))
		})
	},

	// Rebuild grammar.
	rebuild: function () {
		util.log('Rebuild grammar:')
		rl.spawnChildProcess('node', [ './grammar/buildGrammar.js' ])
	},

	// Print state table.
	stateTable: function () {
		rl.spawnChildProcess('node', [ './parser/printStateTable.js' ])
	},

	// Enter REPL.
	repl: function () {
		childProcess.execSync('node', { stdio: 'inherit' })
	},

	// Print CLI history.
	history: function () {
		var historyLen = rl.history.length
		for (var i = historyLen - 1; i > 0; --i) {
			var idx = historyLen - i
			util.log((historyLen > 10 && idx < 10 ? ' ' : '') + idx + '  ' + rl.history[i])
		}
	},

	// Set number of parse trees to search for.
	k: function (k) {
		if (!isNaN(k)) config.k = Number(k)
		util.log('k:', config.k)
	},

	// Toggle printing parse output.
	out: function () {
		config.printOutput = !config.printOutput
		util.log('Print parse output:', config.printOutput)
	},

	// Toggle constructing and printing parse trees.
	trees: function () {
		config.printTrees = !config.printTrees
		util.log('Construct and print parse trees:', config.printTrees)
	},

	// Toggle printing parse costs.
	costs: function () {
		config.printCosts = !config.printCosts
		util.log('Print parse costs:', config.printCosts)
	},

	// Toggle printing parse time.
	time: function () {
		config.printTime = !config.printTime
		util.log('Print parse time:', config.printTime)
	},

	// Toggle printing parse stack.
	stack: function () {
		config.printStack = !config.printStack
		util.log('Print parse stack:', config.printStack)
	},

	// Toggle printing parse forest.
	forest: function () {
		config.printForest = !config.printForest
		util.log('Print parse forest:', config.printForest)
	},

	// Toggle printing parse forest graph.
	graph: function () {
		config.printForestGraph = !config.printForestGraph
		util.log('Print parse forest graph:', config.printForestGraph)
	},

	// Print help screen.
	help: function () {
		util.log([
			util.colors.bold('Commands'),
			'  .test [<k>]        parse the suite of test queries [where k=<k>]',
			'  .benchmark [<n>]   benchmark duration of parsing the test suite [<n> times]',
			'  .logTest [<path>]  write parse output of test suite to file [at <path>]',
			'  .rebuild           rebuild grammar',
			'  .stateTable        print state table',
			'  .repl              enter REPL',
			'  .history           print CLI history',
			'  .help              print this screen',
			'',
			util.colors.bold('Environment Variables'),
			'  .k       k: ' + util.colors.yellow(config.k),
			'  .out     print parse output: ' + util.colors.yellow(config.printOutput),
			'  .trees   print parse trees: ' + util.colors.yellow(config.printTrees),
			'  .costs   print parse costs: ' + util.colors.yellow(config.printCosts),
			'  .time    print parse time: ' + util.colors.yellow(config.printTime),
			'  .stack   print parse stack: ' + util.colors.yellow(config.printStack),
			'  .forest  print parse forest: ' + util.colors.yellow(config.printForest),
			'  .graph   print parse forest graph: ' + util.colors.yellow(config.printForestGraph),
		].join('\n'))
	},
})