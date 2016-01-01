/**
 * Usage
 *   node benchmark [options] [<tag> ...]
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
 *   entire test suite.
 *
 * Options
 *   -k               The maximum number of parse trees to find per parse.       [default: 50]
 *   -n, --num-runs   The number of times to parse the queries in the test suite. [default: 1]
 *   -l, --list-tags  List the tags in the test suite.                               [boolean]
 *   -h, --help       Display this screen.                                           [boolean]
 *
 * Examples
 *   node benchmark -n=5  Benchmark the duration of parsing each query in the test suite 5
 *                        times.
 */

var util = require('../util/util')
var yargs = require('yargs')

var argv = yargs
	.usage([
		util.colors.bold('Usage'),
		'  node $0 [options] [<tag> ...]',
		'',
		util.colors.bold('Description'),
		'  Benchmarks the duration of parsing the queries in the test suite. For each parse, finds the 50-best parse trees but does not output the parse results.',
		'',
		'  Benchmark measurements vary slightly due to process cache, main memory cache, and other concurrent processes on the system. Use `childProcessesBenchmark` instead to mitigate the impact of process cache. That impact is demonstrated by the duration of parsing the queries in the test suite twice (`--num-runs=2`) is less than double the duration of parsing them once.',
		'',
		'  For each provided <tag>, only parses test queries with that tag. If none, parses the entire test suite.',
	].join('\n'))
	.updateStrings({
		'Options:': util.colors.bold('Options'),
		'Examples:': util.colors.bold('Examples'),
	})
	.options({
		'k': {
			description: 'The maximum number of parse trees to find per parse.',
			requiresArg: true,
			default: 50,
		},
		'n': {
			alias: 'num-runs',
			description: 'The number of times to parse the queries in the test suite.',
			requiresArg: true,
			default: 1,
		},
		'l': {
			alias: 'list-tags',
			description: 'List the tags in the test suite.',
			type: 'boolean',
		}
	})
	.help('h', 'Display this screen.').alias('h', 'help')
	.example('node $0 -n=5', 'Benchmark the duration of parsing each query in the test suite 5 times.')
	.check(function (argv, options) {
		if (isNaN(argv.k)) {
			throw 'TypeError: \'-k\' must be a number'
		}

		if (isNaN(argv.numRuns)) {
			throw 'TypeError: \'--num-runs\' must be a number'
		}

		return true
	})
	// Fail on unrecognized arguments.
	.strict()
	.wrap(Math.min(yargs.terminalWidth(), 91))
	.argv

var parse = require('../parse/parseExported')
var tests = require('../test/tests.json')
var testTagsUtil = require('../test/testTagsUtil')

if (argv.listTags) {
	// Print a list of all tags found in the test suite.
	testTagsUtil.listTagsInTests(tests)
	process.exit()
}

// For each provided <tag>, only parse of test queries with that tag. If none, parse the entire test suite.
var argTags = argv._
if (argTags.length > 0) {
	tests = testTagsUtil.filterTestsByTag(tests, argTags)
	util.log('Parsing test queries with the following tags:', argTags.map(util.stylize).join(' '))
}

var k = argv.k
var numRuns = argv.numRuns
var testQueries = tests.map(function (test) { return test.query })
var testsLen = tests.length

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