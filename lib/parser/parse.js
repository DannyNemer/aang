/**
 * Loads the input grammar, generates a `StateTable`, and parses a provided query.
 *
 * Usage: node parse <query> [options]
 *
 *   <query>  The input query to parse.
 *
 * Options:
 *   -k                        The maximum number of parse trees to find.                  [default: 7]
 *   -b, --benchmark           Benchmark duration of the parse and parse forest search.       [boolean]
 *   -o, --output              Print the parse output.                        [boolean] [default: true]
 *   -c, --print-costs         Print the parse costs.                                         [boolean]
 *   -t, --print-trees         Construct and print the parse trees.                           [boolean]
 *   -q, --print-query         Print the input query.                                         [boolean]
 *   -s, --print-stack         Print the parse stack.                                         [boolean]
 *   -f, --print-forest        Print an equational representation of the parse forest.        [boolean]
 *   -g, --print-forest-graph  Print a graph representation of the parse forest.              [boolean]
 *   -h, --help                Display help.                                                  [boolean]
 *
 * Examples:
 *   node parse "people who follow me" -k=5 -t  Finds the 5-best parses for the query and includes
 *                                              their parse trees in the output.
 */

var util = require('../util.js')
var yargs = require('yargs')


var argv = yargs
	.usage(
		'Usage: node $0 <query> [options]\n\n' +
		'  <query>  The input query to parse.'
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
			description: 'Benchmark duration of the parse and parse forest search.',
			type: 'boolean',
		},
		'o': {
			alias: 'output',
			description: 'Print the parse output.',
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
		'q': {
			alias: 'print-query',
			description: 'Print the input query.',
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
	.example('node $0 \"people who follow me\" -k=5 -t', 'Finds the 5-best parses for the query and includes their parse trees in the output.')
	.wrap(Math.min(yargs.terminalWidth(), 100))
	// Report errors for unrecognized arguments.
	.strict()
	.argv


var Parser = require('./Parser.js')
var forestSearch = require('./forestSearch.js')
var stateTable = require('./buildStateTable')('../aang.json', './StateTable.js')


var query = argv._.join(' ')

if (argv.printQuery) util.log('\nquery:', query)

if (argv.benchmark) util.time('parse')

// Include `Parser` instantiation in benchmark because a new `Parser` must be created for every parse.
var parser = new Parser(stateTable)
var startNode = parser.parse(query)

if (argv.benchmark) util.timeEnd('parse')

if (startNode) {
	var trees = forestSearch.search(startNode, argv.k, argv.printTrees, argv.output)

	if (argv.benchmark) util.timeEnd('parse')

	// Include stack and forest printing in both `if...else` blocks to avoid printing before the second `util.timeEnd()` invocation.
	if (argv.printForest) parser.printForest(startNode)
	if (argv.printStack) parser.printStack()
	if (argv.printForestGraph) parser.printNodeGraph(startNode)

	if (argv.output) {
		if (trees.length) {
			forestSearch.print(trees, argv.printCosts, argv.printTrees)
		} else {
			util.log('Failed to find legal parse trees.')
		}
	}
} else {
	if (argv.printForest) parser.printForest()
	if (argv.printStack) parser.printStack()

	if (argv.output) util.log('Failed to reach start node.')
}