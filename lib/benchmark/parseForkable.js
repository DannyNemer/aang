/**
 * Usage
 *   node parseForkable.js <query> [options]
 *
 * Description
 *   Benchmarks the duration of parsing the provided query and finding the 50-best
 *   parse trees, sends the measurement to the parent process, and then exits. This
 *   program must be run as a child process.
 *
 *   Executing a parse in a new process avoids the impact of a process's cache on
 *   the benchmark measurements, yielding more consistent measurements than would
 *   measuring multiple successive parses within a single process.
 *
 *   Benchmark measurements still vary slightly due to main memory cache and other
 *   concurrent processes on the system.
 *
 * Options
 *   -k          The maximum number of parse trees to find.            [default: 7]
 *   -h, --help  Display this screen.                                     [boolean]
 */

var util = require('../util/util.js')
var yargs = require('yargs')

var argv = yargs
	.usage([
		util.colors.bold('Usage'),
		'  node $0 <query> [options]',
		'',
		util.colors.bold('Description'),
		'  Benchmarks the duration of parsing the provided query and finding the 50-best parse trees, sends the measurement to the parent process, and then exits. This program must be run as a child process.',
		'',
		'  Executing a parse in a new process avoids the impact of a process\'s cache on the benchmark measurements, yielding more consistent measurements than would measuring multiple successive parses within a single process.',
		'',
		'  Benchmark measurements still vary slightly due to main memory cache and other concurrent processes on the system.',
	].join('\n'))
	.updateStrings({
		'Options:': util.colors.bold('Options'),
	})
	.options({
		'k': {
			description: 'The maximum number of parse trees to find.',
			requiresArg: true,
			default: 7,
		},
	})
	.demand(1, 'Error: Missing input query')
	.help('h', 'Display this screen.').alias('h', 'help')
	// Fail on unrecognized arguments.
	.strict()
	// Check module is not invoked from a command line.
	.check(function (argv, options) {
		if (!process.connected) {
			throw 'Error: ' + argv.$0 + ' must be run as a child process'
		}

		if (isNaN(argv.k)) {
			throw 'TypeError: \'-k\' must be a number'
		}

		return true
	})
	.argv

var Parser = require('../parser/Parser.js')
var forestSearch = require('../parser/forestSearch.js')

var stateTable = require('../parser/buildStateTable.js')
var parser = new Parser(stateTable)

var query = argv._.join(' ')

// Start timer.
var startTime = process.hrtime()

// Parse query.
var startNode = parser.parse(query)
if (startNode) forestSearch(startNode, argv.k)

// End timer.
var durationTuple = process.hrtime(startTime)
var duration = durationTuple[0] * 1e3 + durationTuple[1] / 1e6

// Send benchmark measurement to parent process, and then exit.
process.send(duration)