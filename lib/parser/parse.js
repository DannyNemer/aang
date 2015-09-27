/**
 * A command line application to parse a provided query and output the k-best parse trees.
 *
 * The CLI spawns child processes of this module to execute parses and commands. This enables the modules to reload any changes after every CLI input, and makes benchmarking results more consistent by lessening the impact of system caches. Eventually, this module will need to be a forked child process that is sent messages for input queries to avoid instantiating a `StateTable` for every parse.
 *
 * Usage: node parse <query> [options]
 *
 * Description: Parse <query> and output the k-best parse trees.
 *
 * Options:
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
 *   node parse "people who follow me" -k=5 -t     Finds the 5-best parse trees for the query, and
 *                                                 includes the parse trees in the parse results.
 *   node parse "people I follow" -sf --no-output  Finds the 7-best parse trees for the query, prints
 *                                                 the parse forest and parse stack, but does not print
 *                                                 the parse results.
 *   node parse "males my followers follow" -bc    Finds the 7-best parse trees for the query, prints
 *                                                 the duration of the parse, and includes the parse
 *                                                 tree costs in the parse results.
 */

var yargs = require('yargs')
var argv = yargs
	.usage(
		'Usage: node $0 <query> [options]\n\n' +
		'Description: Parse <query> and output the k-best parse trees.'
	)
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
	.help('h', 'Display help.').alias('h', 'help')
	.example('node $0 \"people who follow me\" -k=5 -t', 'Finds the 5-best parse trees for the query, and includes the parse trees in the parse results.')
	.example('node $0 \"people I follow\" -sf --no-output', 'Finds the 7-best parse trees for the query, prints the parse forest and parse stack, but does not print the parse results.')
	.example('node $0 \"males my followers follow\" -bc', 'Finds the 7-best parse trees for the query, prints the duration of the parse, and includes the parse tree costs in the parse results.')
	.check(function (argv, options) {
		if (isNaN(argv.k)) {
			throw 'TypeError: \'-k\' must be a number'
		}

		return true
	})
	// Report errors for unrecognized arguments.
	.strict()
	.wrap(Math.min(yargs.terminalWidth(), 100))
	.argv


var util = require('../util.js')
var Parser = require('./Parser.js')
var forestSearch = require('./forestSearch.js')
var stateTable = require('./buildStateTable.js')

var query = argv._.join(' ')

// Benchmark the duration of the parse and the parse forest search.
if (argv.benchmark) util.time('parse')

// Include `Parser` instantiation in benchmark because a new `Parser` must be created for every parse.
var parser = new Parser(stateTable)

// Construct the parse forest for `query`.
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
} else {
	if (argv.printForest) parser.printForest()
	if (argv.printStack) parser.printStack()

	if (argv.output) util.logError('Failed to reach start node.')
}