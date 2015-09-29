/**
 * Usage
 *   node parse <query> [options]
 *
 * Description
 *   Parses <query> and outputs the k-best parse trees.
 *
 * Options
 *   -k                        The maximum number of parse trees to find.                  [default: 7]
 *   -b, --benchmark           Benchmark the duration of the parse and parse forest search.   [boolean]
 *   -q, --quiet               Suppress parse results from output.                            [boolean]
 *   -c, --print-costs         Print the parse costs.                                         [boolean]
 *   -t, --print-trees         Construct and print the parse trees.                           [boolean]
 *   -s, --print-stack         Print the parse stack.                                         [boolean]
 *   -f, --print-forest        Print an equational representation of the parse forest.        [boolean]
 *   -g, --print-forest-graph  Print a graph representation of the parse forest.              [boolean]
 *   -h, --help                Display this screen.                                           [boolean]
 *
 * Examples:
 *   node parse "people who follow me" -k=5 -t   Finds the 5-best parse trees for the query, and
 *                                               includes the parse trees in the parse results.
 *   node parse "people I follow" -sfq           Finds the 7-best parse trees for the query, prints the
 *                                               parse forest and parse stack, but does not print the
 *                                               parse results.
 *   node parse "males my followers follow" -bc  Finds the 7-best parse trees for the query, prints the
 *                                               duration of the parse, and includes the parse tree
 *                                               costs in the parse results.
 */

var util = require('../util.js')
var yargs = require('yargs')

var argv = yargs
	.usage([
		util.colors.bold('Usage'),
		'  node $0 <query> [options]',
		'',
		util.colors.bold('Description'),
		'  Parses <query> and outputs the k-best parse trees.',
	].join('\n'))
	.updateStrings({
		'Options:': util.colors.bold('Options'),
	})
	.demand(1, 'Error: Missing input query')
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
		'q': {
			alias: 'quiet',
			description: 'Suppress parse results from output.',
			type: 'boolean',
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
	.help('h', 'Display this screen.').alias('h', 'help')
	.example('node $0 \"people who follow me\" -k=5 -t', 'Finds the 5-best parse trees for the query, and includes the parse trees in the parse results.')
	.example('node $0 \"people I follow\" -sfq', 'Finds the 7-best parse trees for the query, prints the parse forest and parse stack, but does not print the parse results.')
	.example('node $0 \"males my followers follow\" -bc', 'Finds the 7-best parse trees for the query, prints the duration of the parse, and includes the parse tree costs in the parse results.')
	.check(function (argv, options) {
		if (isNaN(argv.k)) {
			throw 'TypeError: \'-k\' must be a number'
		}

		return true
	})
	// Fail on unrecognized arguments.
	.strict()
	.wrap(Math.min(yargs.terminalWidth(), 100))
	.argv

var Parser = require('./Parser.js')
var forestSearch = require('./forestSearch.js')

// Generate a `StateTable` from the grammar and instantiate a `Parser`.
var stateTable = require('./buildStateTable.js')
var parser = new Parser(stateTable)

var query = argv._.join(' ')

// Benchmark the duration of the parse and the parse forest search.
if (argv.benchmark) util.time('parse')

// Construct the parse forest for `query`.
var startNode = parser.parse(query)

if (argv.benchmark) util.timeEnd('parse')

if (startNode) {
	// Search the parse forest for the k-best parse trees.
	var trees = forestSearch.search(startNode, argv.k, argv.printTrees, !argv.quiet)

	if (argv.benchmark) util.timeEnd('parse')

	// Include stack and forest printing in both `if...else` blocks to avoid printing before the second `util.timeEnd()` invocation.
	if (argv.printForest) parser.printForest(startNode)
	if (argv.printStack) parser.printStack()
	if (argv.printForestGraph) parser.printNodeGraph(startNode)

	if (!argv.quiet) {
		if (trees.length > 0) {
			forestSearch.print(trees, argv.printCosts, argv.printTrees)
		} else {
			util.logError('Failed to find legal parse trees.')
		}
	}
} else {
	if (argv.printForest) parser.printForest()
	if (argv.printStack) parser.printStack()

	if (!argv.quiet) util.logError('Failed to reach start node.')
}