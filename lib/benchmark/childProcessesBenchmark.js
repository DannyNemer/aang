/**
 * Usage
 *   node childProcessesBenchmark [options]
 *
 * Description
 *   Benchmarks the duration of serially parsing the queries in the test suite using child
 *   processes. Each parse finds the 50-best parse trees, with not output, and is executed
 *   in a new child process.
 *
 *   Serially parsing each test query in a newly spawned child processes mitigates the
 *   impact of a process's cache on the benchmark, yielding more consistent measurements.
 *   Performance still varies slightly, howwever, due to system cache and other concurrent
 *   processes on the system.
 *
 *   This program requires ~120 s. This is significantly slower than parsing all tests
 *   within a single process, as with `benchmark`, because ~250 ms are required to
 *   instantiate a `StateTable` in every new process. (This time is excluded from the
 *   benchmark measurements.)
 *
 * Options
 *   -k                The maximum number of parse trees to find per test.     [default: 50]
 *   -n, --num-tests   The number of queries in the test suite to parse.
 *   -e, --print-each  Print the benchmark duration of each test.  [boolean] [default: true]
 *   -h, --help        Display this screen.                                        [boolean]
 */

var util = require('../util/util')
var yargs = require('yargs')

var argv = yargs
	.usage([
		util.colors.bold('Usage'),
		'  node $0 [options]',
		'',
		util.colors.bold('Description'),
		'  Benchmarks the duration of serially parsing the queries in the test suite using child processes. Each parse finds the 50-best parse trees, with not output, and is executed in a new child process.',
		'',
		'  Serially parsing each test query in a newly spawned child processes mitigates the impact of a process\'s cache on the benchmark, yielding more consistent measurements. Performance still varies slightly, howwever, due to system cache and other concurrent processes on the system.',
		'',
		'  This program requires ~120 s. This is significantly slower than parsing all tests within a single process, as with `benchmark`, because ~250 ms are required to instantiate a `StateTable` in every new process. (This time is excluded from the benchmark measurements.)',
	].join('\n'))
	.updateStrings({
		'Options:': util.colors.bold('Options'),
	})
	.options({
		'k': {
			description: 'The maximum number of parse trees to find per test.',
			requiresArg: true,
			default: 50,
		},
		'n': {
			alias: 'num-tests',
			description: 'The number of queries in the test suite to parse.',
			requiresArg: true,
		},
		'e': {
			alias: 'print-each',
			description: 'Print the benchmark duration of each test.',
			type: 'boolean',
			default: true,
		},
	})
	.help('h', 'Display this screen.').alias('h', 'help')
	.check(function (argv, options) {
		if (isNaN(argv.k)) {
			throw 'TypeError: \'-k\' must be a number'
		}

		if (argv.numTests !== undefined && isNaN(argv.numTests)) {
			throw 'TypeError: \'--num-tests\' must be a number'
		}

		return true
	})
	// Fail on unrecognized arguments.
	.strict()
	.wrap(Math.min(yargs.terminalWidth(), 89))
	.argv

var childProcess = require('child_process')

var tests = require('../test/tests.json')
var testsLen = argv.numTests ? Math.min(argv.numTests, tests.length) : tests.length
var testIndex = 0
var totalTime = 0

// Display a progress bar for parsing.
var ProgressBar = require('progress')
var bar = new ProgressBar(util.colors.cyan('Parsing') + '  [:bar] :percent  ETA: :etas', {
	complete: util.colors.green('|'),
	incomplete: '—',
	width: 50,
	total: testsLen,
})

// Begin parsing with the first test.
forkParse()

/**
* Forks a child process for parsing a test query, receives the duration of the parse from the child, and recursively repeats for the next test, if any.
*/
function forkParse() {
	var testQuery = tests[testIndex++].query
	var fork = childProcess.fork('../parse/parseForkable.js', [
		testQuery,
		'-k=' + argv.k,
	])

	// Child completed parse and sent back duration of the parse.
	fork.on('message', function (msg) {
		if (argv.printEach) {
			// Temporalily remove the progress bar to keep it below the query benchmarks.
			bar.stream.clearLine()
			bar.stream.cursorTo(0)

			util.log(testQuery + ':', util.colors.yellow(msg.duration + ' ms'))
		}

		// Update progress bar.
		bar.tick()

		totalTime += msg.duration
	})

	// Child exited (after sending the duration of the parse).
	fork.on('exit', function (code, signal) {
		if (testIndex < testsLen) {
			// Fork a new child for the next test query.
			forkParse()
		} else {
			// No test queries remain. Benchmark is complete.
			util.log(util.colors.bold('Total:'), util.colors.yellow(totalTime + ' ms'))
		}
	})
}