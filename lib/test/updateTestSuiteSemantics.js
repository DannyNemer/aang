/**
 * Usage
 *   node updateTestSuiteSemantics
 *
 * Description
 *   Parses and finds the 50-best parse trees of the tests queries in the test
 *   suite, and updates the tests' existing expected `semantics` with those of the
 *   parse trees. If the new test differs from the existing test, outputs the new
 *   test for the user to confirm before overwriting
 *
 * Options
 *   -h, --help  Display this screen.                                     [boolean]
 */

var util = require('../util/util')
var yargs = require('yargs')

var argv = yargs
	.usage([
		util.colors.bold('Usage'),
		'  node $0',
		'',
		util.colors.bold('Description'),
		'  Parses and finds the 50-best parse trees of the tests queries in the test suite, and updates the tests\' existing expected `semantics` with those of the parse trees. If the new test differs from the existing test, outputs the new test for the user to confirm before overwriting',
	].join('\n'))
	.updateStrings({
		'Options:': util.colors.bold('Options'),
	})
	.help('h', 'Display this screen.').alias('h', 'help')
	// Fail on unrecognized arguments.
	.strict()
	.argv

var readlineSync = require('readline-sync')
var mapTreesToSemantics = require('./mapTreesToSemantics')
var parse = require('../parse/parseExported')

var testsFilePath = './tests.json'
var tests = require(testsFilePath)
var testsOverwritten = false

// Check if test for `query` already exists.
for (var t = 0, testsLen = tests.length; t < testsLen; ++t) {
	var test = tests[t]

	// Parse test query and find 50-best parse trees.
	var trees = parse(test.query, 50) || []

	// Create a new test.
	var newTest = {
		// The query to parse.
		query: test.query,
		// The optional test description.
		description: test.description,
		// The optional expected top result of the parse.
		topResult: test.topResult,
		// The unsorted expected semantics to compare (irrespective of order) to test output.
		semantics: mapTreesToSemantics(trees),
	}

	// If test previously passed (i.e., `test.semantics` indicate it last matched `test.topResult.semantic`), then update `topResult`. This is most often due to changed entity ids. Only update `topResult.text` if `topResult.semantic` changes.
	if (test.topResult) {
		var prevTopSemantic = test.topResult.semantic
		if (prevTopSemantic === test.semantics[0] && prevTopSemantic !== newTest.semantics[0]) {
			newTest.topResult = {
				text: trees[0].text,
				semantic: newTest.semantics[0],
			}
		}
	}

	// Check if new test is different.
	if (!util.arraysEqual(test.semantics, newTest.semantics)) {
		// Print comparison of new and existing test.
		util.log(util.diffObjects(test, newTest))

		// Alert if this update overwrites `topResult`.
		if (!util.objectsEqual(test.topResult, newTest.topResult)) {
			util.logWarning('This overwrites `topResult`.')
		}

		// Prompt the user to confirm overwriting the existing test.
		if (readlineSync.keyInYN('(' + (t + 1) + ' of ' + testsLen + ') Do you want to overwrite this test? ')) {
			tests[t] = newTest
			testsOverwritten = true
		  console.log('Test saved.')
		} else {
		  console.log('Test not saved.')
		}
	}
}

if (testsOverwritten) {
	// Save new test suite.
	util.writeJSONFile(testsFilePath, tests)
} else {
	util.log('No tests updated.')
}