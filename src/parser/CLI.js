var utilPath = '../util.js'
var inputFilePath = '../aang.json'
var parserPath = './Parser.js'
var forestSearchPath = './forestSearch.js'
var stateTablePath = './StateTable.js'

var testQueries = require('./testQueries')
var util

var buildStateTable = require('./buildStateTable').bind(null, inputFilePath, stateTablePath)
var stateTable = buildStateTable()


var rl = require('readline').createInterface(process.stdin, process.stdout, function (line) {
	var completions = [ '.test', '.logTest', '.conjugationTest', '.rebuild', '.deleteCache', '.stateTable', '.history', '.help', '.k', '.out', '.trees', '.costs', '.time', '.query', '.stack', '.forest', '.graph' ]

	var matches = completions.filter(function (c) { return c.indexOf(line) === 0 })

	// Show nothing if no completions found
	return [ matches, line ]
})

rl.setPrompt('❯ ')
rl.prompt()
rl.on('line', function (line) {
	// Reload `util` module (to enable changes)
	util = require(utilPath)

	util.tryCatchWrapper(function () {
		var query = line.trim()

		if (query && !runCommand(query)) {
			parse(query, K)
		}
	})

	// If no '-t' arg (for 'time'), reload modules after every input to enable module changes
	if (process.argv.indexOf('-t') === -1) {
		deleteModuleCaches()
	}

	rl.prompt()
})

/**
 * Exexcute a parse.
 *
 * @param {String} query The query to search.
 * @param {Number} K The maximum number of suggestions to find.
 * @return {Array} The parse trees output by the search if the parser reaches the start node, else `undefined`.
 */
function parse(query, K) {
	if (printQuery) console.log('\nquery:', query)
	var parser = new (require(parserPath))(stateTable)

	if (printTime) util.time('parse')
	var startNode = parser.parse(query)
	if (printTime) util.timeEnd('parse')

	if (printForest) parser.printForest(startNode)
	if (printStack) parser.printStack()

	if (startNode) {
		var forestSearch = require(forestSearchPath)
		var trees = forestSearch.search(startNode, K, printTrees, printOutput)
		if (printTime) util.timeEnd('parse')

		if (printForestGraph) parser.printNodeGraph(startNode)
		if (printOutput) {
			if (trees.length) forestSearch.print(trees, printCost, printTrees)
			else console.log('Failed to find legal parse trees')
		}

		// Return trees for conjugation test
		return trees
	} else {
		if (printOutput) console.log('Failed to reach start node')
	}
}


// Parser settings:
var K = 7
var printTime = false
var printQuery = false
var printOutput = true
var printStack = false
var printForest = false
var printForestGraph = false
var printTrees = false
var printCost = false

/**
 * Evaluate a line of input from the CLI as either a command to execute, or a search query to parse.
 *
 * @param {String} `input` The input to execute as a command if recognized, else a search query.
 * @return {Boolean} `true` if `input` is a recognized command, else `false`.
 */
function runCommand(input) {
	// All commands begin with a period
	if (input[0] !== '.') return false

	var args = input.split(' ')
	var firstArg = args[0]
	var secondArg = args[1]

	// COMMANDS:
	// Run test queries
	if (firstArg === '.test') {
		// Set number of times to cycle test queries on test
		var testRuns = isNaN(secondArg) ? 1 : Number(secondArg)

		// If testRuns > 1, then test is a benchmark and prevent output
		if (testRuns > 1) {
			var prevPrintOutput = printOutput
			printOutput = false
		}

		// Benchmark test if !printOutput
		if (printOutput) printQuery = true
		else util.time('test')

		var i = 0
		var queries = testQueries.basic
		var queriesLen = queries.length
		while (i++ < testRuns) {
			for (var q = 0; q < queriesLen; ++q) {
				parse(queries[q], 50)
			}
		}

		if (printOutput) printQuery = false
		else util.timeEnd('test')

		util.countEndAll()

		if (testRuns > 1) {
			printOutput = prevPrintOutput
		}
	}

	// Output a run of test queries to file
	else if (firstArg === '.logTest') {
		var prevSettingPrintOutput = printOutput
		printOutput = true

		util.redirectOutputToFile('~/Desktop/out', function () {
			runCommand('.test')
		})

		printOutput = prevSettingPrintOutput
	}

	// Run conjugation tests
	else if (firstArg === '.conjugationTest') {
		var prevSettingPrintTrees = printTrees
		printTrees = false
		var prevSettingPrintOutput = printOutput
		printOutput = false
		var failed = false

		testQueries.conjugation.forEach(function (query) {
			var trees = parse(query, 1)
			if (!trees || trees[0].text !== query) {
				util.logError('Expected:', query)
				console.log('       Actual:', trees[0].text)
				failed = true
			}
		})

		if (!failed) console.log('All conjugation tests passed')
		printOutput = prevSettingPrintOutput
		printTrees = prevSettingPrintTrees
	}

	// Rebuild grammar and state table
	else if (firstArg === '.rebuild') {
		console.log('Rebuild grammar and state table:')

		// Rebuild grammar
		util.tryCatchWrapper(function () {
			require('child_process').execFileSync('node', [ '../grammar/buildGrammar.js' ], { stdio: 'inherit' })
		})

		// Rebuild state table
		stateTable = buildStateTable()
	}

	// Delete module cache
	else if (firstArg === '.deleteCache') {
		deleteModuleCaches()
		console.log('Deleted cache of modules')
	}

	// Print state table
	else if (firstArg === '.stateTable') {
		stateTable.print()
	}

	// Print CLI history
	else if (firstArg === '.history') {
		var historyLen = rl.history.length
		for (var i = historyLen - 1; i > 0; --i) {
			var idx = historyLen - i
			console.log((historyLen > 10 && idx < 10 ? ' ' : '') + idx + '  ' + rl.history[i])
		}
	}

	// PARSER SETTINGS:
	// Set number of parse trees to search for
	else if (firstArg === '.k') {
		if (!isNaN(secondArg)) K = Number(secondArg)
		console.log('K:', K)
	}

	// Toggle printing parse output
	else if (firstArg === '.out') {
		printOutput = !printOutput
		console.log('Print parse output:', printOutput)
	}

	// Toggle constructing and printing parse trees
	else if (firstArg === '.trees') {
		printTrees = !printTrees
		console.log('Construct and print parse trees:', printTrees)
	}

	// Toggle printing parse costs
	else if (firstArg === '.costs') {
		printCost = !printCost
		console.log('Print parse costs:', printCost)
	}

	// Toggle printing parse time
	else if (firstArg === '.time') {
		printTime = !printTime
		console.log('Print parse time:', printTime)
	}

	// Toggle printing parse query
	else if (firstArg === '.query') {
		printQuery = !printQuery
		console.log('Print parse query:', printQuery)
	}

	// Toggle printing parse stack
	else if (firstArg === '.stack') {
		printStack = !printStack
		console.log('Print parse stack:', printStack)
	}

	// Toggle printing parse forest
	else if (firstArg === '.forest') {
		printForest = !printForest
		console.log('Print parse forest:', printForest)
	}

	// Toggle printing parse forest graph
	else if (firstArg === '.graph') {
		printForestGraph = !printForestGraph
		console.log('Print parse forest graph:', printForestGraph)
	}

	// Print help screen
	else {
		console.log('Commands:')
		console.log('.test [<int>]     run test queries [<int> times]')
		console.log('.logTest          output a run of test queries to file')
		console.log('.conjugationTest  run conjugation test')
		console.log('.rebuild          rebuild grammar and state table')
		console.log('.deleteCache      delete module cache')
		console.log('.stateTable       print state table')
		console.log('.history          print CLI history')
		console.log('.help             print this screen')

		console.log('\nParser settings:')
		console.log('.k       K:', K)
		console.log('.out     print parse output:', printOutput)
		console.log('.trees   print parse trees:', printTrees)
		console.log('.costs   print parse costs:', printCost)
		console.log('.time    print parse time:', printTime)
		console.log('.query   print parse query:', printQuery)
		console.log('.stack   print parse stack:', printStack)
		console.log('.forest  print parse forest:', printForest)
		console.log('.graph   print parse forest graph:', printForestGraph)
	}

	// Input as a command; do not parse as query
	return true
}

/**
 *  Delete the cache of modules in use, forcing them to reload and enable any file changes for the next input.
 */
function deleteModuleCaches() {
	util.deleteModuleCache(parserPath, forestSearchPath, stateTablePath, utilPath, './BinaryHeap.js', '../grammar/semantic.js', './calcHeuristicCosts.js')
}