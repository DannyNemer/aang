var child_process = require('child_process')

var utilPath = '../util.js'
var inputFilePath = '../aang.json'
var parserPath = './Parser.js'
var forestSearchPath = './forestSearch.js'
var stateTablePath = './StateTable.js'

var testQueries = require('./testQueries')
var util

// If '-t' argument passed to CLI, do not reload modules after every input.
var benchmarkMode = process.argv.indexOf('-t') !== -1

var buildStateTable = require('./buildStateTable').bind(null, inputFilePath, stateTablePath)
var stateTable = buildStateTable()


var rl = require('readline').createInterface(process.stdin, process.stdout, function (line) {
	var completions = [ '.test', '.logTest', '.conjugationTest', '.rebuild', '.deleteCache', '.stateTable', '.history', '.repl', '.help', '.k', '.out', '.trees', '.costs', '.time', '.query', '.stack', '.forest', '.graph' ]

	var matches = completions.filter(function (c) { return c.indexOf(line) === 0 })

	// Show nothing if no completions found.
	return [ matches, line ]
})

rl.setPrompt('❯ ')

rl.prompt()
// Listen for `^C` (`SIGINT`) in the input stream to exit the CLI.
var sawSIGINT = false
rl.on('SIGINT', function () {
	if (this.line.length > 0) {
		// Clear line and reset `sawSIGINT`.
		this.clearLine()
		sawSIGINT = false
	} else if (sawSIGINT) {
		// Exit CLI.
		process.exit(0)
	} else {
		// Confirm before exiting.
		this.output.write('\n(^C again to quit)\n')
		sawSIGINT = true
	}

	this.prompt()
})

rl.on('line', function (line) {
	// Reset `SIGINT` confirmation.
	sawSIGINT = false

	// Reload `util` module (to enable changes).
	util = require(utilPath)

	util.tryCatchWrapper(function () {
		var query = line.trim()

		if (query && !runCommand(query)) {
			parse(query, k)
		}
	})

	// Reload modules after every input to enable module changes.
	if (!benchmarkMode) {
		deleteModuleCaches()
	}

	// Do not print prompt during an asynchronous process, such as rebuilding the grammar.
	if (!rl.paused) {
		rl.prompt()
	}
})

/**
 * Executes a parse.
 *
 * @param {string} query The query to search.
 * @param {number} k The maximum number of suggestions to find.
 * @returns {Object[]} Returns the parse trees output by the search if the parser reaches the start node, else `undefined`.
 */
function parse(query, k) {
	if (printQuery) util.log('\nquery:', query)

	if (printTime) util.time('parse')
	var parser = new (require(parserPath))(stateTable)

	var startNode = parser.parse(query)
	if (printTime) util.timeEnd('parse')

	if (printForest) parser.printForest(startNode)
	if (printStack) parser.printStack()

	if (startNode) {
		var forestSearch = require(forestSearchPath)
		var trees = forestSearch.search(startNode, k, printTrees, printOutput)
		if (printTime) util.timeEnd('parse')

		if (printForestGraph) parser.printNodeGraph(startNode)
		if (printOutput) {
			if (trees.length) forestSearch.print(trees, printCosts, printTrees)
			else util.log('Failed to find legal parse trees.')
		}

		// Return trees for conjugation test.
		return trees
	} else {
		if (printOutput) util.log('Failed to reach start node.')
	}
}


// Parser settings:
var k = 7
// Start CLI with no output if passed '-t' argument.
var printOutput = !benchmarkMode
var printTrees = false
var printCosts = false
var printTime = false
var printQuery = false
var printStack = false
var printForest = false
var printForestGraph = false

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
	// Run test queries.
	if (firstArg === '.test') {
		// Set number of times to cycle test queries on test.
		var testRuns = isNaN(secondArg) ? 1 : Number(secondArg)

		// If testRuns > 1, then test is a benchmark and prevent output.
		if (testRuns > 1) {
			var origPrintOutput = printOutput
			printOutput = false
		}

		if (printOutput) {
			var origPrintQuery = printQuery
			printQuery = true
		} else {
			// Benchmark test.
			util.time('test')
		}

		var i = 0
		var queries = testQueries.general
		var queriesLen = queries.length
		while (i++ < testRuns) {
			for (var q = 0; q < queriesLen; ++q) {
				parse(queries[q], 50)
			}
		}

		if (printOutput) {
			printQuery = origPrintQuery
		} else {
			util.timeEnd('test')
		}

		util.countEndAll()

		if (testRuns > 1) {
			printOutput = origPrintOutput
		}
	}

	// Output a run of test queries to file.
	else if (firstArg === '.logTest') {
		var origPrintOutput = printOutput
		printOutput = true

		util.outputToFile('~/Desktop/out', function () {
			runCommand('.test')
		})

		printOutput = origPrintOutput
	}

	// Run conjugation tests.
	else if (firstArg === '.conjugationTest') {
		var origPrintTrees = printTrees
		printTrees = false
		var origPrintOutput = printOutput
		printOutput = false
		var failed = false

		testQueries.conjugation.forEach(function (query) {
			var trees = parse(query, 1)
			if (!trees || trees[0].text !== query) {
				util.logError('Expected:', util.stylize(query))
				util.log('         Actual:', util.stylize(trees[0].text))
				failed = true
			}
		})

		if (!failed) util.logSuccess('All conjugation tests passed.')
		printOutput = origPrintOutput
		printTrees = origPrintTrees
	}

	// Rebuild grammar and state table.
	else if (firstArg === '.rebuild') {
		util.log('Rebuild grammar and state table:')

		spawnChildProcessAndRedirectStdio('node', [ '../grammar/buildGrammar.js' ], function () {
			// Rebuild state table after regenerating grammar.
			stateTable = buildStateTable()
		})
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

	// Enter REPL.
	else if (firstArg === '.repl') {
		child_process.execSync('node', { stdio: 'inherit' })
	}

	// PARSER SETTINGS:
	// Set number of parse trees to search for.
	else if (firstArg === '.k') {
		if (!isNaN(secondArg)) k = Number(secondArg)
		util.log('k:', k)
	}

	// Toggle printing parse output.
	else if (firstArg === '.out') {
		printOutput = !printOutput
		util.log('Print parse output:', printOutput)
	}

	// Toggle constructing and printing parse trees.
	else if (firstArg === '.trees') {
		printTrees = !printTrees
		util.log('Construct and print parse trees:', printTrees)
	}

	// Toggle printing parse costs.
	else if (firstArg === '.costs') {
		printCosts = !printCosts
		util.log('Print parse costs:', printCosts)
	}

	// Toggle printing parse time.
	else if (firstArg === '.time') {
		printTime = !printTime
		util.log('Print parse time:', printTime)
	}

	// Toggle printing parse query.
	else if (firstArg === '.query') {
		printQuery = !printQuery
		util.log('Print parse query:', printQuery)
	}

	// Toggle printing parse stack.
	else if (firstArg === '.stack') {
		printStack = !printStack
		util.log('Print parse stack:', printStack)
	}

	// Toggle printing parse forest.
	else if (firstArg === '.forest') {
		printForest = !printForest
		util.log('Print parse forest:', printForest)
	}

	// Toggle printing parse forest graph.
	else if (firstArg === '.graph') {
		printForestGraph = !printForestGraph
		util.log('Print parse forest graph:', printForestGraph)
	}

	// Print help screen.
	else {
		util.log('Commands:')
		util.log('.test [<int>]     run test queries [<int> times]')
		util.log('.logTest          output a run of test queries to file')
		util.log('.conjugationTest  run conjugation test')
		util.log('.rebuild          rebuild grammar and state table')
		util.log('.deleteCache      delete module cache')
		util.log('.stateTable       print state table')
		util.log('.history          print CLI history')
		util.log('.repl             enter REPL')
		util.log('.help             print this screen')

		util.log('\nParser settings:')
		util.log('.k       k:', k)
		util.log('.out     print parse output:', printOutput)
		util.log('.trees   print parse trees:', printTrees)
		util.log('.costs   print parse costs:', printCosts)
		util.log('.time    print parse time:', printTime)
		util.log('.query   print parse query:', printQuery)
		util.log('.stack   print parse stack:', printStack)
		util.log('.forest  print parse forest:', printForest)
		util.log('.graph   print parse forest graph:', printForestGraph)
	}

	// Input as a command; do not parse as query.
	return true
}

/**
 * Spawns a new process with `command` and the command line arguments in `args`. This asynchronous process avoids blocking the event loop.
 *
 * Disables CLI stdio while the child is processing, except for `^C` (`SIGINT`) to terminate the child. Restores the CLI stdio when the child exits or terminates. This enables terminating the child process without terminating the CLI itself.
 *
 * @param {string} command The command to run as a child process.
 * @param {string[]} args The command line arguments for `command`.
 * @param {Function} [callback] The optional function to execute after the child process exits and before returning control to the CLI.
 */
function spawnChildProcessAndRedirectStdio(command, args, callback) {
	// Prevent printing prompt when executing child process, but continue processing input such as `^C` for `SIGINT` (which `rl.pause()` would prevent).
	rl.paused = true

	// Launches a new process with `command` and the command line arguments in `args`. This asynchronous process avoids blocking the event loop.
	var child = child_process.spawn(command, args, { stdio: 'inherit' })

	// Disable output from CLI while child is processing.
	var origStdoutWrite = rl.output.write
	rl.output.write = function () {}

	// Send `SIGINT` to child process when received by the CLI.
	function killChild() {
		child.kill('SIGINT')
	}

	rl.on('SIGINT', killChild)

	// Temporarily remove CLI `line` event listener (when the user hits `enter`).
	var online = rl._events.line
	rl.removeListener('line', online)

	child.on('error', function (err) {
		util.logError('Failed to start child process:', err.code)
	})

	child.on('close', function (code, signal) {
		// Restore `stdout`.
		rl.output.write = origStdoutWrite

		rl.removeListener('SIGINT', killChild)

		if (signal) {
			// `child` was killed (most often is due to `SIGINT` sent by the CLI).
		  util.logError('Child process terminated due to receipt of signal', signal)
		} else if (code !== 0) {
			// `child` exited with a `failure` code (most often after an error is thrown).
			util.logError('Child process exited with code', code)
		} else if (callback) {
			// `child` exited normally. Execute `callback` before returning control to the CLI.
			callback()
		}

		// Restore `line` event listener.
		rl.on('line', online)

		// Resume CLI.
		rl.prompt()
	})
}

/**
 *  Deletes the cache of modules in use, forcing them to reload and enable any file changes for the next input.
 */
function deleteModuleCaches() {
	util.deleteModuleCache(parserPath, forestSearchPath, stateTablePath, utilPath, './BinaryHeap.js', '../grammar/semantic.js', './calcHeuristicCosts.js')
}