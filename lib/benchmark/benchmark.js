/**
 * Usage
 *   node benchmark [options]|[command] [<tag> ...]
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
 *   For each provided <tag>, only parses test queries with that tag. If none, parses the
 *   entire test suite. If <tag> is unrecognized, exits the process.
 *
 * Commands
 *   tags  List the tags in the test suite.
 *
 * Options
 *   -k              The maximum number of parse trees to find per parse.         [default: 7]
 *   -n, --num-runs  The number of times to parse the queries in the test suite.  [default: 1]
 *   -h, --help      Display this screen.                                            [boolean]
 *
 * Examples
 *   node benchmark -n=5  Benchmark the duration of parsing each query in the test suite 5
 *                        times.
 */

var util = require('../util/util')

var tests = require('../test/tests.json')
var testUtil = require('../test/testUtil')

var yargs = require('yargs')
var argv = yargs
	.usage([
		util.colors.bold('Usage'),
		'  node $0 [options]|[command] [<tag> ...]',
		'',
		util.colors.bold('Description'),
		'  Benchmarks the duration of parsing the queries in the test suite. For each parse, finds the 50-best parse trees but does not output the parse results.',
		'',
		'  Benchmark measurements vary slightly due to process cache, main memory cache, and other concurrent processes on the system. Use `childProcessesBenchmark` instead to mitigate the impact of process cache. That impact is demonstrated by the duration of parsing the queries in the test suite twice (`--num-runs=2`) is less than double the duration of parsing them once.',
		'',
		'  For each provided <tag>, only parses test queries with that tag. If none, parses the entire test suite. If <tag> is unrecognized, exits the process.',
	].join('\n'))
	.updateStrings({
		'Commands:': util.colors.bold('Commands'),
		'Options:': util.colors.bold('Options'),
		'Examples:': util.colors.bold('Examples'),
	})
	.command('tags', 'List the tags in the test suite.', function (yargs) {
		testUtil.printTags(tests)
		process.exit()
	})
	.options({
		'k': {
			description: 'The maximum number of parse trees to find per parse.',
			requiresArg: true,
			default: 7,
		},
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
		if (isNaN(argv.k)) {
			throw 'TypeError: \'-k\' is not a number: ' + argv.k
		}

		if (isNaN(argv.numRuns)) {
			throw 'TypeError: \'--num-runs\' is not a number: ' + argv.numRuns
		}

		return true
	})
	// Fail on unrecognized arguments.
	.strict()
	.wrap(Math.min(yargs.terminalWidth(), 91))
	.argv

// For each `<tag>` passed as a command line argument, only parse test queries with that tag. If none, parse the entire test suite. If `<tag>` is unrecognized, exit the process with error code `1`.
tests = filterTestsByTagArgs(argv, tests)

var parse = require('../parse/parseExported')

var k = argv.k
var numRuns = argv.numRuns
var testQueries = tests.map(test => test.query)
var testsLen = tests.length

// Start a CPU profile if run via `devtool`, which runs the program inside Chrome DevTools.
var isDevtool = !!console.profile
if (isDevtool) {
	console.profile('benchmark')
}

// Start timer.
var startTime = process.hrtime()

// Cycle through the test suite `--num-runs` times.
for (var r = 0; r < numRuns; ++r) {
	// Parse every test query.
	for (var t = 0; t < testsLen; ++t) {
		parse(testQueries[t], k)
	}
}

// End timer.
var durationTuple = process.hrtime(startTime)
var duration = durationTuple[0] * 1e3 + durationTuple[1] / 1e6
util.log('Duration:', util.colors.yellow((duration / numRuns).toFixed(3) + ' ms'))

// Print values of any counters used during the benchmark.
util.countEndAll()

// If run via `devtool`, complete CPU profile and print report to the Profiles panel (inside Chrome DevTools).
if (isDevtool) {
	console.profileEnd('benchmark')
}

/**
 * Iterates over tests in `tests`, returning an array of all tests that contain a tag passed as a command line argument, if any. If a command line argument is not recognized as a tag in the test suite, exits the process with error code `1`.
 *
 * @private
 * @static
 * @param {Object} argv The command line arguments object returned by `yargs.argv`.
 * @param {Object[]} tests The tests to filter.
 * @returns {Object[]} Returns the filtered tests.
 */
function filterTestsByTagArgs(argv, tests) {
	// Get command line arguments that are not program commands.
	var argTags = argv._.filter(function (arg) {
		return arg !== 'tags'
	})

	if (argTags.length > 0) {
		tests = testUtil.filterTestsByTags(tests, argTags)
		util.log('Parsing test queries with tags:', argTags.map(util.unary(util.stylize)).join(', '))
	}

	return tests
}