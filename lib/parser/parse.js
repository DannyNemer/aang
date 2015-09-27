/**
 * Loads the input grammar, generates a `StateTable`, and parses a provided query, parses the test suite, or benchmarks the test suite.
 *
 * The CLI spawns child processes of this module to execute parses and commands. This enables the modules to reload any changes after every CLI input, and makes benchmarking results more consistent by lessening the impact of system caches. Eventually, this module will need to be a forked child process that is sent messages for input queries to avoid instantiating a `StateTable` for every parse.
 *
 * Usage: node parse <query>|<command> [options]
 *
 *   <query>    The input query to parse.
 *   <command>  The command to execute.
 *
 * Commands:
 *   benchmark   Benchmark the duration of parsing the test suite.
 *
 * <query> options:
 *   -k                        The maximum number of parse trees to find.                  [default: 7]
 *   -b, --benchmark           Benchmark the duration of the parse and parse forest search.   [boolean]
 *   -o, --output              Print the parse results.                       [boolean] [default: true]
 *   -c, --print-costs         Print the parse costs.                                         [boolean]
 *   -t, --print-trees         Construct and print the parse trees.                           [boolean]
 *   -s, --print-stack         Print the parse stack.                                         [boolean]
 *   -f, --print-forest        Print an equational representation of the parse forest.        [boolean]
 *   -g, --print-forest-graph  Print a graph representation of the parse forest.              [boolean]
 *   -h, --help                Display help.                                                  [boolean]
 *
 * Examples:
 *   node parse "people who follow me" -k=5 -t     Finds the 5-best parses for the query, and includes
 *                                                 the parse trees in the parse results.
 *   node parse "people I follow" -sf --no-output  Finds the 7-best parses for the query, prints the
 *                                                 parse forest and parse stack, but does not print the
 *                                                 parse results.
 *   node parse <command> -h                       Display help for <command>.
 */

var util = require('../util.js')
var yargs = require('yargs')

var command = yargs.argv._[0]
var commandDescriptions = {
	'benchmark': 'Benchmark the duration of parsing the test suite.',
}

// Benchmarks the duration of parsing the test suite.
if (command === 'benchmark') {
	yargs
		.usage(
			util.format('Usage: node $0 %s [options]\n\n', command) +
			util.format('Description: %s For each parse, finds the 50-best parses and does not output anything.', commandDescriptions[command])
		)
		.updateStrings({
			'Options:': 'Benchmark options:',
		})
		.options({
			'n': {
				alias: 'num-runs',
				description: 'The number of times to parse the suite of test queries.',
				requiresArg: true,
				default: 1,
			},
		})
		.example(util.format('node $0 %s -n=5', command), 'Measures the time to parse the test suite 5 times.')
		.check(function (argv, options) {
			if (isNaN(argv.n)) {
				throw 'TypeError: \'--num-runs\' must be a number'
			}

			return true
		})
}

// No command. Parses the input query.
else {
	yargs
		.usage(
			'Usage: node $0 <query>|<command> [options]\n\n' +
			'  <query>    The input query to parse.\n' +
			'  <command>  The command to execute.'
		)
		.demand(1, 'Error: Missing input query')
		.updateStrings({
			'Options:': '<query> options:',
		})
		.options({
			'k': {
				description: 'The maximum number of parse trees to find.',
				requiresArg: true,
				default: 7,
			},
			'b': {
				alias: 'benchmark',
				description: 'Benchmark the duration of the parse and parse forest search.',
				type: 'boolean',
			},
			'o': {
				alias: 'output',
				description: 'Print the parse results.',
				type: 'boolean',
				default: true,
			},
			'c': {
				alias: 'print-costs',
				description: 'Print the parse costs.',
				type: 'boolean',
			},
			't': {
				alias: 'print-trees',
				description: 'Construct and print the parse trees.',
				type: 'boolean',
			},
			's': {
				alias: 'print-stack',
				description: 'Print the parse stack.',
				type: 'boolean',
			},
			'f': {
				alias: 'print-forest',
				description: 'Print an equational representation of the parse forest.',
				type: 'boolean',
			},
			'g': {
				alias: 'print-forest-graph',
				description: 'Print a graph representation of the parse forest.',
				type: 'boolean',
			},
		})
		.example('node $0 \"people who follow me\" -k=5 -t', 'Finds the 5-best parses for the query, and includes the parse trees in the parse results.')
		.example('node $0 \"people I follow\" -sf --no-output', 'Finds the 7-best parses for the query, prints the parse forest and parse stack, but does not print the parse results.')
		.example('node $0 <command> -h', 'Display help for <command>.')
		.check(function (argv, options) {
			if (isNaN(argv.k)) {
				throw 'TypeError: \'-k\' must be a number'
			}

			return true
		})

	for (var commandName in commandDescriptions) {
		yargs.command(commandName, commandDescriptions[commandName])
	}
}

var argv = yargs
	.help('h', 'Display help.').alias('h', 'help')
	// Report errors for unrecognized arguments.
	.strict()
	.wrap(Math.min(yargs.terminalWidth(), 100))
	.argv


var Parser = require('./Parser.js')
var forestSearch = require('./forestSearch.js')
var stateTable = require('./buildStateTable.js')

// Benchmark the duration of parsing the test suite.
// Duration varies due to caches and garbage collection. If every parse were a new process, and the durations were accumulated sans process and `StateTable` instantiation, then the cumulative durations would be more consistent.
if (command === 'benchmark') {
	var numRuns = argv.numRuns
	var testQueries = require('./tests.js').map(function (test) {
		return test.query
	})
	var testQueriesLen = testQueries.length

	util.time('test')

	// Cycle through the test suite `--num-runs` times.
	for (var i = 0; i < numRuns; ++i) {
		// Cycle through every test query.
		for (var q = 0; q < testQueriesLen; ++q) {
			var parser = new Parser(stateTable)
			var startNode = parser.parse(testQueries[q])
			if (startNode) forestSearch.search(startNode, 50)
		}
	}

	util.timeEnd('test')
}

// Parse the input query.
else {
	parse(argv._.join(' '))
}

/**
 * Constructs a parse forest for `query`, and if it reaches the start node, then finds the k-best parse trees as well as their semantics and display texts
 *
 * @param {string} query The query to search.
 * @returns {undefined|Object[]} Returns the parse trees if the parse reaches the start node.
 */
function parse(query) {
	// Benchmark the duration of the parse and the parse forest search.
	if (argv.benchmark) util.time('parse')

	// Include `Parser` instantiation in benchmark because a new `Parser` must be created for every parse.
	var parser = new Parser(stateTable)

	// Construct the parse forest.
	var startNode = parser.parse(query)

	if (argv.benchmark) util.timeEnd('parse')

	if (startNode) {
		// Search the parse forest for the k-best parse trees.
		var trees = forestSearch.search(startNode, argv.k, argv.printTrees, argv.output)

		if (argv.benchmark) util.timeEnd('parse')

		// Include stack and forest printing in both `if...else` blocks to avoid printing before the second `util.timeEnd()` invocation.
		if (argv.printForest) parser.printForest(startNode)
		if (argv.printStack) parser.printStack()
		if (argv.printForestGraph) parser.printNodeGraph(startNode)

		if (argv.output) {
			if (trees.length > 0) {
				forestSearch.print(trees, argv.printCosts, argv.printTrees)
			} else {
				util.logError('Failed to find legal parse trees.')
			}
		}

		return trees
	} else {
		if (argv.printForest) parser.printForest()
		if (argv.printStack) parser.printStack()

		if (argv.output) util.logError('Failed to reach start node.')
	}
}