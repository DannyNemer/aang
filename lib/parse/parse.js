/**
 * Usage
 *   node parse <query> [options]
 *
 * Description
 *   Parses <query> and outputs the k-best parse trees.
 *
 * Options
 *   -k                             The maximum number of parse trees to find.             [default: 7]
 *   -q, --quiet                    Suppress parse results from output.                       [boolean]
 *   -b, --benchmark                Benchmark the duration of parse and parse forest search.  [boolean]
 *   -c, --print-costs              Print the parse costs.                                    [boolean]
 *   -a, --print-ambiguity          Print instances of semantic ambiguity.                    [boolean]
 *   -t, --print-trees              Construct and print the parse trees.                      [boolean]
 *   -n, --print-tree-node-costs    Include in parse trees each node's path cost.             [boolean]
 *   -r, --print-tree-token-ranges  Include in parse trees each node's token range.           [boolean]
 *   -s, --print-stack              Print the parse stack.                                    [boolean]
 *   -f, --print-forest             Print an equational representation of the parse forest.   [boolean]
 *   -g, --print-forest-graph       Print a graph representation of the parse forest.         [boolean]
 *   -h, --help                     Display this screen.                                      [boolean]
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

var util = require('../util/util')
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
		'q': {
			alias: 'quiet',
			description: 'Suppress parse results from output.',
			type: 'boolean',
		},
		'b': {
			alias: 'benchmark',
			description: 'Benchmark the duration of parse and parse forest search.',
			type: 'boolean',
		},
		'c': {
			alias: 'print-costs',
			description: 'Print the parse costs.',
			type: 'boolean',
		},
		'a': {
			alias: 'print-ambiguity',
			description: 'Print instances of semantic ambiguity.',
			type: 'boolean',
		},
		't': {
			alias: 'print-trees',
			description: 'Construct and print the parse trees.',
			type: 'boolean',
		},
		'n': {
			alias: 'print-tree-node-costs',
			description: 'Include in parse trees each node\'s path cost.',
			type: 'boolean',
		},
		'r': {
			alias: 'print-tree-token-ranges',
			description: 'Include in parse trees each node\'s token range.',
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
	.implies('print-tree-token-ranges', 'print-trees')
	.implies('print-tree-node-costs', 'print-trees')
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

// Prevent surrounding file paths with parentheses in stack traces.
util.excludeParenthesesInStackTrace()

var Parser = require('./Parser')
var pfsearch = require('./pfsearch')
var printParseResults = require('./printParseResults')

// Generate a `StateTable` from the grammar and instantiate a `Parser`.
var stateTable = require('./buildStateTable')
var parser = new Parser(stateTable)

var query = argv._.join(' ')

// Benchmark the duration of the parse and the parse forest search.
if (argv.benchmark) util.time('parse')

// Construct the parse forest for `query`.
var startNode = parser.parse(query)

if (argv.benchmark) util.timeEnd('parse')

if (startNode) {
	// Search the parse forest for the k-best parse trees.
	var trees = pfsearch(startNode, argv.k, argv.printTrees, !argv.quiet, argv.printAmbiguity)

	if (argv.benchmark) util.timeEnd('parse')

	if (!argv.quiet) {
		if (trees.length > 0) {
			// Print the display text and semantics for the k-best parse trees.
			printParseResults(trees, {
				costs: argv.printCosts,
				trees: argv.printTrees,
				treeNodeCosts: argv.printTreeNodeCosts,
				treeTokenRanges: argv.printTreeTokenRanges,
			})
		} else {
			util.logError('Failed to find legal parse trees.')
		}
	}

	// Print a graph representation of the parse forest.
	if (argv.printForestGraph) parser.printNodeGraph(startNode)
} else if (!argv.quiet) {
	util.logError('Failed to reach start node.')
}

// Print the parse stack.
if (argv.printStack) parser.printStack()

// Print an equational representation of the parse forest.
if (argv.printForest) parser.printForest(startNode)