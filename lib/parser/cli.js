var child_process = require('child_process')
var fs = require('fs')

var utilPath = '../util.js'
var inputFilePath = '../aang.json'
var parserPath = './Parser.js'
var forestSearchPath = './forestSearch.js'
var stateTablePath = './StateTable.js'

var tests = require('./tests')
var util

// If '-t' argument passed to CLI, do not reload modules after every input.
var benchmarkMode = process.argv.indexOf('-t') !== -1

var buildStateTable = require('./buildStateTable').bind(null, inputFilePath, stateTablePath)
var stateTable = buildStateTable()


var rl = require('readline').createInterface(process.stdin, process.stdout, function (line) {
	var completions = [ '.test', '.benchmark', '.logTest', '.rebuild', '.repl', '.deleteCache', '.stateTable', '.history', '.help', '.k', '.out', '.trees', '.costs', '.time', '.query', '.stack', '.forest', '.graph' ]

	var matches = completions.filter(function (c) { return c.indexOf(line) === 0 })

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

	// Reload `util` module (to enable changes).
	util = require(utilPath)

	util.tryCatchWrapper(function () {
		var query = line.trim()

		if (query && !runCommand(query)) {
			spawnChildProcessAndRedirectStdio('node', [
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
	})

	// Reload modules after every input to enable module changes.
	if (!benchmarkMode) {
		deleteModuleCaches()
	}

	// Do not print prompt during an asynchronous process, such as rebuilding the grammar.
	if (!this.paused) {
		this.prompt()
	}
})

rl.prompt()

/**
 * Executes a parse.
 *
 * @param {string} query The query to search.
 * @param {number} k The maximum number of suggestions to find.
 * @returns {Object[]} Returns the parse trees output by the search if the parser reaches the start node, else `undefined`.
 */
function parse(query, k) {
	if (config.printQuery) util.log('\nquery:', query)

	if (config.printTime) util.time('parse')
	var parser = new (require(parserPath))(stateTable)

	var startNode = parser.parse(query)
	if (config.printTime) util.timeEnd('parse')

	if (config.printForest) parser.printForest(startNode)
	if (config.printStack) parser.printStack()

	if (startNode) {
		var forestSearch = require(forestSearchPath)
		var trees = forestSearch.search(startNode, k, config.printTrees, config.printOutput)
		if (config.printTime) util.timeEnd('parse')

		if (config.printForestGraph) parser.printNodeGraph(startNode)
		if (config.printOutput) {
			if (trees.length) forestSearch.print(trees, config.printCosts, config.printTrees)
			else util.log('Failed to find legal parse trees.')
		}

		// Return trees for conjugation test.
		return trees
	} else {
		if (config.printOutput) util.log('Failed to reach start node.')
	}
}


// Parser settings:
var config = {
	k: 7,
	// Start CLI with no output if passed '-t' argument.
	printOutput: !benchmarkMode,
	printTrees: false,
	printCosts: false,
	printTime: false,
	printQuery: false,
	printStack: false,
	printForest: false,
	printForestGraph: false,
}

/**
 * Evaluates a line of input from the CLI as either a command to execute, or a search query to parse.
 *
 * @param {string} `input` The input to execute as a command if recognized, else a search query.
 * @returns {boolean} Returns `true` if `input` is a recognized command, else `false`.
 */
function runCommand(input) {
	// All commands begin with a period
	if (input[0] !== '.') return false

	var args = input.split(' ')
	var firstArg = args[0]
	var secondArg = args[1]

	// COMMANDS:
	// Parse the suite of test queries.
	if (firstArg === '.test') {
		spawnChildProcessAndRedirectStdio('node', [
			'./parse.js',
			'test',
			'--k=' + (isNaN(secondArg) ? 50 : secondArg),
			'--benchmark=' + config.printTime,
			'--output=' + config.printOutput,
			'--print-costs=' + config.printCosts,
			'--print-trees=' + config.printTrees,
			'--print-stack=' + config.printStack,
			'--print-forest=' + config.printForest,
			'--print-forest-graph=' + config.printForestGraph,
		])
	}

	// Benchmark the duration of parsing the test suite.
	else if (firstArg === '.benchmark') {
		spawnChildProcessAndRedirectStdio('node', [
			'./parse.js',
			'benchmark',
			'--num-runs=' + (isNaN(secondArg) ? 1 : secondArg),
		])
	}

	// Write parse output of test suite to file.
	else if (firstArg === '.logTest') {
		// Create file if does not exist, truncates file to zero length if it does exist, or throw an error if `path` is a directory.
		var path = util.expandHomeDir('~/Desktop/out')
		var outFD = fs.openSync(path, 'w')

		// Spawn test as a child process, outputting to a file at `path`.
		spawnChildProcessAndRedirectStdio('node', [
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
			util.log('Test output saved:', fs.realpathSync(path))
		})
	}

	// Rebuild grammar and state table.
	else if (firstArg === '.rebuild') {
		util.log('Rebuild grammar and state table:')

		spawnChildProcessAndRedirectStdio('node', [ '../grammar/buildGrammar.js' ], function () {
			// Rebuild state table after regenerating grammar.
			stateTable = buildStateTable()
		})
	}

	// Enter REPL.
	else if (firstArg === '.repl') {
		child_process.execSync('node', { stdio: 'inherit' })
	}

	// Delete module cache.
	else if (firstArg === '.deleteCache') {
		deleteModuleCaches()
		util.log('Deleted cache of modules.')
	}

	// Print state table.
	else if (firstArg === '.stateTable') {
		stateTable.print()
	}

	// Print CLI history.
	else if (firstArg === '.history') {
		var historyLen = rl.history.length
		for (var i = historyLen - 1; i > 0; --i) {
			var idx = historyLen - i
			util.log((historyLen > 10 && idx < 10 ? ' ' : '') + idx + '  ' + rl.history[i])
		}
	}

	// PARSER SETTINGS:
	// Set number of parse trees to search for.
	else if (firstArg === '.k') {
		if (!isNaN(secondArg)) config.k = Number(secondArg)
		util.log('k:', config.k)
	}

	// Toggle printing parse output.
	else if (firstArg === '.out') {
		config.printOutput = !config.printOutput
		util.log('Print parse output:', config.printOutput)
	}

	// Toggle constructing and printing parse trees.
	else if (firstArg === '.trees') {
		config.printTrees = !config.printTrees
		util.log('Construct and print parse trees:', config.printTrees)
	}

	// Toggle printing parse costs.
	else if (firstArg === '.costs') {
		config.printCosts = !config.printCosts
		util.log('Print parse costs:', config.printCosts)
	}

	// Toggle printing parse time.
	else if (firstArg === '.time') {
		config.printTime = !config.printTime
		util.log('Print parse time:', config.printTime)
	}

	// Toggle printing input query.
	else if (firstArg === '.query') {
		config.printQuery = !config.printQuery
		util.log('Print input query:', config.printQuery)
	}

	// Toggle printing parse stack.
	else if (firstArg === '.stack') {
		config.printStack = !config.printStack
		util.log('Print parse stack:', config.printStack)
	}

	// Toggle printing parse forest.
	else if (firstArg === '.forest') {
		config.printForest = !config.printForest
		util.log('Print parse forest:', config.printForest)
	}

	// Toggle printing parse forest graph.
	else if (firstArg === '.graph') {
		config.printForestGraph = !config.printForestGraph
		util.log('Print parse forest graph:', config.printForestGraph)
	}

	// Print help screen.
	else {
		util.log('Commands:')
		util.log('.test <k>         parse the suite of test queries [where k=<k>]')
		util.log('.benchmark <n>    benchmark duration of parsing the test suite [<n> times]')
		util.log('.logTest          write parse output of test suite to file')
		util.log('.rebuild          rebuild grammar and state table')
		util.log('.repl             enter REPL')
		util.log('.deleteCache      delete module cache')
		util.log('.stateTable       print state table')
		util.log('.history          print CLI history')
		util.log('.help             print this screen')

		util.log('\nParser settings:')
		util.log('.k       k:', config.k)
		util.log('.out     print parse output:', config.printOutput)
		util.log('.trees   print parse trees:', config.printTrees)
		util.log('.costs   print parse costs:', config.printCosts)
		util.log('.time    print parse time:', config.printTime)
		util.log('.query   print input query:', config.printQuery)
		util.log('.stack   print parse stack:', config.printStack)
		util.log('.forest  print parse forest:', config.printForest)
		util.log('.graph   print parse forest graph:', config.printForestGraph)
	}

	// Input as a command; do not parse as query.
	return true
}

/**
 * Spawns a new process with `command` and the command line arguments in `args`. This asynchronous process avoids blocking the event loop.
 *
 * Disables the readline `Interace` (RLI) stdio while the child is processing, except for `^C` (`SIGINT`) to terminate the child. Restores the RLI stdio when the child exits or terminates. This creates the appearance of synchronous processing, but with the ability to terminate the child process without terminating the CLI itself.
 *
 * @param {string} command The command to run as a child process.
 * @param {string[]} args The command line arguments for `command`.
 * @param {string|Array} [stdio=['ignore', process.stdout, process.stderr]] The optional child process's stdio configuration.
 * @param {Function} [callback] The optional function to execute after the child process exits and before returning control to the CLI.
 */
function spawnChildProcessAndRedirectStdio(command, args, stdio, callback) {
	if (typeof stdio === 'function') {
		callback = stdio
		stdio = null
	}

	// Prevent printing prompt when executing child process, but continue processing input such as `^C` for `SIGINT` (which `rl.pause()` would prevent).
	rl.paused = true

	// Launches a new process with `command` and the command line arguments in `args`. This asynchronous process avoids blocking the event loop. Unless `stdio` is provided as an argument, the child process ignores input and inherits `stdout` and `stderr`.
	var child = child_process.spawn(command, args, { stdio: stdio || [ 'ignore', process.stdout, process.stderr ] })

	// Disable output from RLI while child is processing.
	var origStdoutWrite = rl.output.write
	rl.output.write = function () {}

	// Temporarily remove RLI `line` event listener(s) (when the user hits `enter`).
	var lineListeners = rl.listeners('line')
	rl.removeAllListeners('line')

	// Send `SIGINT` to child process when received by the RLI.
	function killChild() {
		child.kill('SIGINT')
	}

	// Temporarily replace existing RLI `SIGINT` event listener(s).
	var SIGINTListeners = rl.listeners('SIGINT')
	rl.removeAllListeners('SIGINT')
	rl.on('SIGINT', killChild)

	child.on('error', function (err) {
		util.logError('Failed to start child process:', err.code)
	})

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
			// `child` exited with a `failure` code (most often after an error is thrown).
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

/**
 *  Deletes the cache of modules in use, forcing them to reload and enable any file changes for the next input.
 */
function deleteModuleCaches() {
	util.deleteModuleCache(parserPath, forestSearchPath, stateTablePath, utilPath, './BinaryHeap.js', '../grammar/semantic.js', './calcHeuristicCosts.js')
}