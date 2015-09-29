/**
 * A command line application that benchmarks the duration of serially parsing the queries in the test suite using child processes. Each parse finds the 50-best parse trees, with not output, and is executed in a new child process.
 *
 * Serially parsing each test query in a newly spawned child processes mitigates the impact of a process's cache on the benchmark, yielding more consistent measurements. Performance still varies slightly, howwever, due to system cache and other concurrent processes on the system.
 *
 * This benchmark requires ~120 s. This is significantly slower than parsing all tests within a single process, as with `benchmark`, mainly because ~250 ms are required to instantiate a `StateTable` in every new process. (This time is excluded from the benchmark measurements.)
 *
 * Usage: node childProcessesBenchmark [options]
 *
 * Description: Benchmark the duration of serially parsing the queries in the test
 * suite using child processes. Each parse finds the 50-best parse trees, with not
 * output, and is executed in a new child process.
 *
 * Options:
 *   -h, --help  Display help.                                            [boolean]
 */

var argv = require('yargs')
	.usage(
		'Usage: node $0 [options]\n\n' +
		'Description: Benchmark the duration of serially parsing the queries in the test suite using child processes. Each parse finds the 50-best parse trees, with not output, and is executed in a new child process.'
	)
	.help('h', 'Display help.').alias('h', 'help')
	// Fail on unrecognized arguments.
	.strict()
	.argv

var util = require('../util.js')
var childProcess = require('child_process')

var Parser = require('../parser/Parser.js')
var forestSearch = require('../parser/forestSearch.js')

var stateTable = require('../parser/buildStateTable.js')
var parser = new Parser(stateTable)

var tests = require('./tests.js')
var testsLen = tests.length
var testIndex = 0

var totalTime = 0

// Parse first test query.
forkParse()

/**
* Forks a child process for parsing a test query, receives the benchmark of the duration of the parse, and recursively repeats for the next test, if any.
*/
function forkParse() {
	var testQuery = tests[testIndex++].query
	var fork = childProcess.fork('./parseForkable.js', [ testQuery ])

	// Parse finished and sent back duration of the parse.
	fork.on('message', function (duration) {
		util.log(testQuery, duration)
		totalTime += duration
	})

	// Parse completed and process exited.
	fork.on('close', function (code, signal) {
		if (testIndex < testsLen) {
			// Fork a new process for the next test query.
			forkParse()
		} else {
			// No test queries remain. Benchmark is complete.
			util.log('total:', totalTime)
		}
	})
}