/**
 * Benchmarks the duration of parsing the provided query and finding the 50-best parse trees, sends the measurement to the parent process, and then exits.
 *
 * Executing a parse in a new process avoids the impact of a process's cache on the benchmark measurements, yielding more consistent measurements than would measuring multiple successive parses within a single process.
 *
 * Benchmark measurements still vary slightly due to main memory cache and other concurrent processes on the system.
 */

var argv = require('yargs')
	.usage(
		'Usage: node $0 <query> [options]\n\n' +
		'Description: Benchmark the duration of parsing <query> and finding the 50-best parse trees, and sends the measurement to the parent process.'
	)
	.demand(1, 'Error: Missing input query')
	.help('h', 'Display help.').alias('h', 'help')
	// Fail on unrecognized arguments.
	.strict()
	.check(function (argv, options) {
		// Check module is not invoked from the command line.
		if (!process.connected) {
			throw 'Error: ' + argv.$0 + ' must be run as a child process'
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
if (startNode) forestSearch.search(startNode, 50)

// End timer.
var durationTuple = process.hrtime(startTime)
var duration = durationTuple[0] * 1e3 + durationTuple[1] / 1e6

// Send benchmark measurement to parent process, and then exit.
process.send(duration)