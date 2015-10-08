/**
 * Usage
 *   node benchmark [options]
 *
 * Description
 *   Benchmarks the duration of parsing the queries in the test suite. For each parse, finds
 *   the 50-best parse trees but does not output the parse results.
 *
 *   Benchmark measurements vary slightly due to process cache, main memory cache, and other
 *   concurrent processes on the system. Use `childProcessesBenchmark` instead to mitigate the
 *   impact of process cache. That impact is demonstrated by the duration of parsing the
 *   queries in the test suite twice (`--num-runs=2`) is less than double the duration of
 *   parsing them once.
 *
 * Options
 *   -n, --num-runs  The number of times to parse the queries in the test suite.  [default: 1]
 *   -h, --help      Display this screen.                                            [boolean]
 *
 * Examples:
 *   node benchmark -n=5  Benchmark the duration of parsing each query in the test suite 5
 *                        times.
 */

var util = require('../util/util.js')
var yargs = require('yargs')

var argv = yargs
	.usage([
		util.colors.bold('Usage'),
		'  node $0 [options]',
		'',
		util.colors.bold('Description'),
		'  Benchmarks the duration of parsing the queries in the test suite. For each parse, finds the 50-best parse trees but does not output the parse results.',
		'',
		'  Benchmark measurements vary slightly due to process cache, main memory cache, and other concurrent processes on the system. Use `childProcessesBenchmark` instead to mitigate the impact of process cache. That impact is demonstrated by the duration of parsing the queries in the test suite twice (`--num-runs=2`) is less than double the duration of parsing them once.',
	].join('\n'))
	.updateStrings({
		'Options:': util.colors.bold('Options'),
	})
	.options({
		'n': {
			alias: 'num-runs',
			description: 'The number of times to parse the queries in the test suite.',
			requiresArg: true,
			default: 1,
		},
	})
	.help('h', 'Display this screen.').alias('h', 'help')
	.example('node $0 -n=5', 'Benchmark the duration of parsing each query in the test suite 5 times.')
	.check(function (argv, options) {
		if (isNaN(argv.numRuns)) {
			throw 'TypeError: \'--num-runs\' must be a number'
		}

		return true
	})
	// Fail on unrecognized arguments.
	.strict()
	.wrap(Math.min(yargs.terminalWidth(), 91))
	.argv

var Parser = require('../parser/Parser.js')
var forestSearch = require('../parser/forestSearch.js')

var stateTable = require('../parser/buildStateTable.js')
var parser = new Parser(stateTable)

var numRuns = argv.numRuns
var tests = require('../test/tests.js')
var testsLen = tests.length
var testQueries = tests.map(function (test) { return test.query })

util.time('Time')

// Cycle through the test suite `--num-runs` times.
for (var r = 0; r < numRuns; ++r) {
	// Parse every test query.
	for (var t = 0; t < testsLen; ++t) {
		var startNode = parser.parse(testQueries[t])
		if (startNode) forestSearch.search(startNode, 50)
	}
}

util.timeEnd('Time')