/**
 * A command line application that benchmarks the duration of parsing the queries in the test suite. For each parse, finds the 50-best parse trees with no output.
 *
 * Benchmark measurements vary due to process cache, main memory cache, and other concurrent processes on the system. To mitigate the first, the option `--use-child-processes` exists to execute each parse within a new child process.
 *
 * Usage: node benchmark [options]
 *
 * Description: Benchmark the duration of parsing the queries in the test suite. For each parse, finds the
 * 50-best parse trees with no output.
 *
 * Options:
 *   -n, --num-runs                The number of times to parse the queries in the test suite.  [default: 1]
 *   -s, --serial-child-processes  Serially parse each test query in a newly spawned process. This avoids
 *                                 the impact of a process's cache on the benchmark measurements, yielding
 *                                 more consistent measurements.                                   [boolean]
 *   -p, --parallel                Parse test queries in separate, parallel processes.             [boolean]
 *   -h, --help                    Display help.                                                   [boolean]
 *
 * Examples:
 *   node benchmark -n=5  Benchmark the duration of parsing the queries in the test suite 5 times.
 */

var yargs = require('yargs')
var argv = yargs
	.usage(
		'Usage: node $0 [options]\n\n' +
		'Description: Benchmark the duration of parsing the queries in the test suite. For each parse, finds the 50-best parse trees with no output.'
	)
	.options({
		'n': {
			alias: 'num-runs',
			description: 'The number of times to parse the queries in the test suite.',
			requiresArg: true,
			default: 1,
		},
		's': {
			alias: 'serial-child-processes',
			description: 'Serially parse each test query in a newly spawned process. This avoids the impact of a process\'s cache on the benchmark measurements, yielding more consistent measurements.',
			type: 'boolean',
		},
		'p': {
			alias: 'parallel',
			description: 'Parse test queries in separate, parallel processes.',
			type: 'boolean',
		},
	})
	.help('h', 'Display help.').alias('h', 'help')
	.example('node $0 -n=5', 'Benchmark the duration of parsing the queries in the test suite 5 times.')
	.check(function (argv, options) {
		if (isNaN(argv.numRuns)) {
			throw 'TypeError: \'--num-runs\' must be a number'
		}

		return true
	})
	// Fail on unrecognized arguments.
	.strict()
	.wrap(Math.min(yargs.terminalWidth(), 105))
	.argv

var util = require('../util.js')
var childProcess = require('child_process')

var Parser = require('../parser/Parser.js')
var forestSearch = require('../parser/forestSearch.js')

var stateTable = require('../parser/buildStateTable.js')
var parser = new Parser(stateTable)

var numRuns = argv.numRuns
var tests = require('./tests.js')
var testsLen = tests.length
var testQueries = tests.map(function (test) { return test.query })

// Serially parse each test query in a newly spawned process. This avoids the impact of a process's cache on the benchmark measurements, yielding more consistent measurements. However, performance still varies slightly due to system cache and other concurrent processes on the system.
// This is significantly slower than parsing all tests within this process, mainly because ~250 ms are required to instantiate a `StateTable` in every new process. (This time is excluded from the benchmark measurement.)
// Limited to one run of the test suite; i.e., ignores `--num-runs`.
if (argv.serialChildProcesses) {
	var totalTime = 0
	var testIndex = 0

	// Parse first test query.
	forkParse()

	function forkParse() {
		var testQuery = testQueries[testIndex++]
		var parse = childProcess.fork('./parseForkable.js', [ testQuery ])

		// Parse finished and sent back duration of the parse.
		parse.on('message', function (duration) {
			util.log(testQuery, duration)
			totalTime += duration
		})

		// Parse completed and process exited. Fork a new process for the next test query, if any.
		parse.on('close', function (code, signal) {
			if (testIndex < testsLen) {
				forkParse()
			} else {
				// Parses complete.
				util.log('total:', totalTime)
			}
		})
	}
}

// Parse test queries in separate, parallel processes, limited to 25 concurrent processes. This does not yield an accurate benchmark at all because of the impact each process has on system performance.
else if (argv.parallel) {
	var totalTime = 0
	var testIndex = 0

	// Parse 25 test queries in parallel.
	for (var i = 0; i < 25; ++i) {
		forkParseParallel()
	}

	function forkParseParallel() {
		var testQuery = testQueries[testIndex++]
		var parse = childProcess.fork('./parseForkable.js', [ testQuery, '--return-query' ])

		// Parse finished and sent back duration of the parse.
		parse.on('message', function (obj) {
			util.log(obj.query, obj.duration)
			totalTime += obj.duration
		})

		// Parse completed and process exited. Fork a new process for the next test query, if any.
		parse.on('close', function (code, signal) {
			if (testIndex < testsLen) {
				forkParseParallel()
			} else {
				// Parses complete.
				util.log('total:', totalTime)
			}
		})
	}
}

// Parse each test query within this process.
else {
	util.time('test')

	// Cycle through the test suite `--num-runs` times.
	for (var r = 0; r < numRuns; ++r) {
		// Parse every test query.
		for (var t = 0; t < testsLen; ++t) {
			var startNode = parser.parse(testQueries[t])
			if (startNode) forestSearch.search(startNode, 50)
		}
	}

	util.timeEnd('test')
}