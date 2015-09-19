/**
 * Loads the input grammar, generates a `StateTable`, and parses a provided query.
 *
 * Usage: node parse2 <query> [options]
 *
 *  <query>  The input query to parse
 *
 * Options:
 *   -k <int>            The maximum number of parse trees to find               [default: 7]
 *   -o, --output        Print the parse output                     [boolean] [default: true]
 *   -t, --trees         Print the parse trees                                      [boolean]
 *   -c, --costs         Print the parse costs                                      [boolean]
 *   -q, --query         Print the input query                                      [boolean]
 *   -s, --stack         Print the parse stack                                      [boolean]
 *   -f, --forest        Print an equational representation of the parse forest     [boolean]
 *   -g, --forest-graph  Print a graph representation of the parse forest           [boolean]
 *   -h, --help          Display help                                               [boolean]
 */

var util = require('../util.js')
var yargs = require('yargs')


var argv = yargs
	.usage('\nUsage: node $0 <query> [options]\n\n <query>  The input query to parse')
	.demand(1, 'Error: Missing input query')
	.options({
		'k': {
			description: 'The maximum number of parse trees to find',
			// type: 'number',
			requiresArg: true,
			default: 7,
		},
		'o': {
			alias: 'output',
			description: 'Print the parse output',
			type: 'boolean',
			default: true,
		},
		't': {
			alias: 'trees',
			description: 'Print the parse trees',
			type: 'boolean',
		},
		'c': {
			alias: 'costs',
			description: 'Print the parse costs',
			type: 'boolean',
		},
		'q': {
			alias: 'query',
			description: 'Print the input query',
			type: 'boolean',
		},
		's': {
			alias: 'stack',
			description: 'Print the parse stack',
			type: 'boolean',
		},
		'f': {
			alias: 'forest',
			description: 'Print an equational representation of the parse forest',
			type: 'boolean',
		},
		'g': {
			alias: 'forest-graph',
			description: 'Print a graph representation of the parse forest',
			type: 'boolean',
		},
	})
	.help('h', 'Display help').alias('h', 'help')
	.wrap(Math.min(yargs.terminalWidth(), 90))
	// Report errors for unrecognized arguments.
	.strict()
	.argv

var query = argv._.join(' ')
util.log(query)
util.log(argv.k)