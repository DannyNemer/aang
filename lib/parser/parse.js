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


var optionator = require('optionator')({
	prepend: '\nUsage: node parse <query> [options]\n\n <query>  The input query to parse\n\nOptions:',
	options: [
		{
			option: 'k',
			type: 'Int',
			description: 'The maximum number of parse trees to find',
			default: '7',
		},{
			option: 'output',
			alias: 'o',
			description: 'Print the parse output',
			type: 'Boolean',
			default: 'true',
		}, {
			option: 'trees',
			alias: 't',
			description: 'Print the parse trees',
			type: 'Boolean',
		}, {
			option: 'costs',
			alias: 'c',
			description: 'Print the parse costs',
			type: 'Boolean',
		}, {
			option: 'query',
			alias: 'q',
			description: 'Print the input query',
			type: 'Boolean',
		}, {
			option: 'stack',
			alias: 's',
			description: 'Print the parse stack',
			type: 'Boolean',
		}, {
			option: 'forest',
			alias: 'f',
			description: 'Print an equational representation of the parse forest',
			type: 'Boolean',
		}, {
			option: 'forest-graph',
			alias: 'g',
			description: 'Print a graph representation of the parse forest',
			type: 'Boolean',
		}, {
			option: 'help',
			alias: 'h',
			type: 'Boolean',
			description: 'Display help',
		},
	],
	})

var argv = optionator.parse(process.argv)
var query = argv._.join(' ')
util.log(query)
util.log(argv.k)