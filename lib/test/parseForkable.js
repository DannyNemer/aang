/**
 * Benchmarks the duration of parsing the provided query and finding the 50-best parse trees, sends the measurement to the parent process, and then exits.
 *
 * Executing a parse in a new process avoids the impact of a process's cache on the benchmark measurements, yielding more consistent measurements than would measuring multiple successive parses within a single process.
 *
 * Benchmark measurements still vary slightly due to main memory cache and other concurrent processes on the system.
 *
 * Usage: node parseForkable <query> [options]
 *
 * Description: Benchmark the duration of parsing <query> and finding the 50-best parse
 * trees, and sends the measurement to the parent process.
 *
 * Options:
 *   -l, --load-and-wait  Instantiate a `StateTable`, notify the parent process, and
 *                        wait for a process message to benchmark the parse.   [boolean]
 *   -h, --help           Display help.                                        [boolean]
 */

 var yargs = require('yargs')
 var argv = yargs
	.usage(
		'Usage: node $0 <query> [options]\n\n' +
		'Description: Benchmark the duration of parsing <query> and finding the 50-best parse trees, and sends the measurement to the parent process.'
	)
	.demand(1, 'Error: Missing input query')
	.options({
		'l': {
			alias: 'load-and-wait',
			description: 'Instantiate a `StateTable`, notify the parent process, and wait for a process message to benchmark the parse.',
			type: 'boolean',
		},
	})
	.help('h', 'Display help.').alias('h', 'help')
	// Fail on unrecognized arguments.
	.strict()
	.wrap(Math.min(yargs.terminalWidth(), 85))
	// Check module is not invoked from a command line.
	.check(function (argv, options) {
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

// Notify parent process of `StateTable` instantiation completion, and wait for message to begin parsing.
if (argv.loadAndWait) {
	process.send('ready')

	process.on('message', function () {
		var duration = parse(query)

		// Send benchmark measurement to parent process.
		process.send(duration)

		// Remove listeners so process will automatically exit after `duration` is sent.
		process.removeAllListeners('message')
	})
}

// Parse immediately.
else {
	var duration = parse(query)

	// Send benchmark measurement to parent process, and then exit.
	process.send(duration)
}

/**
 * Parses `query` and benchmarks the duration of the parse.
 *
 * @param {string} query The query to parse.
 * @returns {number} Returns the duration of the parse.
 */
function parse(query) {
	// Start timer.
	var startTime = process.hrtime()

	// Parse query.
	var startNode = parser.parse(query)
	if (startNode) forestSearch.search(startNode, 50)

	// End timer.
	var durationTuple = process.hrtime(startTime)
	var duration = durationTuple[0] * 1e3 + durationTuple[1] / 1e6

	return duration
}