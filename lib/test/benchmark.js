/**
 * A command line application that benchmarks the duration of parsing the queries in the test suite. For each parse, finds the 50-best parse trees with no output.
 *
 * Duration varies due to caches and garbage collection. This is demonstrated by the duration of parsing the queries in the test quite twice (`--num-runs=2`) is less than double the duration of parsing them once. If every parse were a new process, and the durations were accumulated sans process and `StateTable` instantiation, then the cumulative durations would be more consistent.
 *
 * Usage: node benchmark.js [options]
 *
 * Description: Benchmark the duration of parsing the queries in the test suite. For each
 * parse, finds the 50-best parse trees with no output.
 *
 * Options:
 *   -n, --num-runs  The number of times to parse the queries in the test suite.
 *                                                                               [default: 1]
 *   -h, --help      Display help.                                                  [boolean]
 *
 * Examples:
 *   node benchmark.js -n=5  Benchmark the duration of parsing the queries in the test suite
 *                           5 times.
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
	.wrap(Math.min(yargs.terminalWidth(), 90))
	.argv

var util = require('../util.js')
var Parser = require('../parser/Parser.js')
var forestSearch = require('../parser/forestSearch.js')

var stateTable = require('../parser/buildStateTable.js')
var parser = new Parser(stateTable)

var numRuns = argv.numRuns
var tests = require('./tests.js')
var testsLen = tests.length
var testQueries = tests.map(function (test) { return test.query })


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