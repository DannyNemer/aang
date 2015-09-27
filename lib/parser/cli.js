var readline = require('readline')
var child_process = require('child_process')
var fs = require('fs')
var util = require('../util')


var rl = readline.createInterface(process.stdin, process.stdout, function (line) {
	var matches = commandNames.filter(function (commandName) {
		return commandName.indexOf(line) === 0
	})

	// Show nothing if no completions found.
	return [ matches, line ]
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

rl.setPrompt('❯ ')

rl.on('line', function (line) {
	// Reset `SIGINT` confirmation.
	this.sawSIGINT = false

	var query = line.trim()
	if (query) {
		if (query[0] === '.') {
			var args = query.split(' ')
			var command = args[0].slice(1)
			var arg = args[1]

			// Execute command if found else, else display usage.
			var commandFunc = commands[command] || commands['help']
			commandFunc(arg)
		} else {
			this.spawnChildProcess('node', [
				'./parse.js',
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

rl.prompt()


// Parser settings:
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

// CLI commands, executed via `.command_name`.
var commands = {
	// Parse the suite of test queries.
	test: function (k) {
		rl.spawnChildProcess('node', [
			'./parse.js',
			'test',
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
			'./parse.js',
			'benchmark',
			'--num-runs=' + (isNaN(numRuns) ? 1 : numRuns),
		])
	},

	// Write output of a parse of the test suite to file.
	logTest: function () {
		// Create file if does not exist, truncates file to zero length if it does exist, or throw an exception if `outPath` is a directory.
		var outPath = util.expandHomeDir('~/Desktop/out')
		var outFD = fs.openSync(outPath, 'w')

		// Spawn test as a child process, outputting to a file at `outPath`.
		rl.spawnChildProcess('node', [
			'./parse.js',
			'test',
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
		rl.spawnChildProcess('node', [ '../grammar/buildGrammar.js' ])
	},

	// Print state table.
	stateTable: function () {
		rl.spawnChildProcess('node', [
			'./parse.js',
			'statetable',
		])
	},

	// Enter REPL.
	repl: function () {
		child_process.execSync('node', { stdio: 'inherit' })
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
		util.log('Commands:')
		util.log('  .test <k>       parse the suite of test queries [where k=<k>]')
		util.log('  .benchmark <n>  benchmark duration of parsing the test suite [<n> times]')
		util.log('  .logTest        write parse output of test suite to file')
		util.log('  .rebuild        rebuild grammar')
		util.log('  .repl           enter REPL')
		util.log('  .stateTable     print state table')
		util.log('  .history        print CLI history')
		util.log('  .help           print this screen')

		util.log('\nParser settings:')
		util.log('  .k       k:', config.k)
		util.log('  .out     print parse output:', config.printOutput)
		util.log('  .trees   print parse trees:', config.printTrees)
		util.log('  .costs   print parse costs:', config.printCosts)
		util.log('  .time    print parse time:', config.printTime)
		util.log('  .stack   print parse stack:', config.printStack)
		util.log('  .forest  print parse forest:', config.printForest)
		util.log('  .graph   print parse forest graph:', config.printForestGraph)
	},
}

// Commands names used for RLI completer.
var commandNames = Object.keys(commands).map(function (commandName) {
	return '.' + commandName
})

/**
 * Spawns a new process within the readline `Interface` (RLI) to execute `command` and the command line arguments in `args`. This asynchronous process avoids blocking the event loop, enabling the process to be terminated without exiting the RLI.
 *
 * Disables the RLI `stdio` while the child is processing, except for `^C` (`SIGINT`) to terminate the child. Restores the RLI `stdio` when the child exits or terminates. This creates the appearance of synchronous processing, but with the ability to terminate the child process without terminating the RLI itself.
 *
 * @param {string} command The command to run as a child process.
 * @param {string[]} args The command line arguments for `command`.
 * @param {string|Array} [stdio=['ignore', process.stdout, process.stderr]] The optional child process's `stdio` configuration.
 * @param {Function} [callback] The optional function to execute after the child process exits and before returning control to the RLI.
 */
rl.spawnChildProcess = function (command, args, stdio, callback) {
	if (typeof stdio === 'function') {
		callback = stdio
		stdio = null
	}

	// Prevent printing prompt when executing child process, but continue processing input such as `^C` for `SIGINT` (which `rl.pause()` would prevent).
	this.paused = true

	// Launches a new process with `command` and the command line arguments in `args`. This asynchronous process avoids blocking the event loop. Unless `stdio` is provided as an argument, the child process ignores input and inherits `stdout` and `stderr`.
	var child = child_process.spawn(command, args, { stdio: stdio || [ 'ignore', process.stdout, process.stderr ] })

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

	var rl = this
	child.on('close', function (code, signal) {
		// Restore `stdout`.
		rl.output.write = origStdoutWrite

		// Restore `SIGINT` event listeners(s).
		rl.removeListener('SIGINT', killChild)
		SIGINTListeners.forEach(function (listener) {
			rl.on('SIGINT', listener)
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
			rl.on('line', listener)
		})

		// Resume RLI.
		rl.prompt()
	})
}