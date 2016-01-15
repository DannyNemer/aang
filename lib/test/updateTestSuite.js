/**
 * Usage
 *   node updateTestSuite
 *
 * Description
 *   Parses and finds the 50-best parse trees of the tests queries in the test
 *   suite, updates the tests' existing expected `semantics` with those of the
 *   parse trees, and updates the tests' tags. If the new test differs from the
 *   existing test, outputs the new test for the user to confirm before
 *   overwriting.
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
		'  Parses and finds the 50-best parse trees of the tests queries in the test suite, updates the tests\' existing expected `semantics` with those of the parse trees, and updates the tests\' tags. If the new test differs from the existing test, outputs the new test for the user to confirm before overwriting.',
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
var parseOptions = { quiet: true }

var testsFilePath = './tests.json'
var tests = require(testsFilePath)
var testTagsUtil = require('./testTagsUtil')
var testsOverwritten = false

// Check if test for `query` already exists.
for (var t = 0, testsLen = tests.length; t < testsLen; ++t) {
	var test = tests[t]

	// Parse test query and find 50-best parse trees.
	var parseResults = parse(test.query, 50, parseOptions)

	// Create a new test.
	var newTest = {
		// The query to parse.
		query: test.query,
		// The optional test description.
		description: test.description,
		// The test tags.
		tags: undefined,
		// The optional expected top result of the parse.
		topResult: test.topResult,
		// The unsorted expected semantics to compare (irrespective of order) to test output.
		semantics: mapTreesToSemantics(parseResults.trees),
	}

	// If test previously passed (i.e., `test.semantics` indicate it last matched `test.topResult.semantic`), then update `topResult.semantic`. This is most often due to changed entity ids.
	if (test.topResult && test.topResult.semantic === test.semantics[0] && newTest.semantics.length > 0) {
		newTest.topResult = {
			text: test.topResult.text,
			semantic: newTest.semantics[0],
		}
	}

	// Get the applicable test tags. Must invoke after defining `newTest.topResult`.
	newTest.tags = testTagsUtil.getTagsForTest(newTest, parseResults)

	// Check if new test is different.
	if (!util.arraysEqual(test.semantics, newTest.semantics) || !util.arraysEqual(test.tags, newTest.tags)) {
		// Print comparison of new and existing test.
		util.log(util.diffObjects(test, newTest))

		// Prompt the user to confirm overwriting the existing test.
		var promptMessage = '(' + (t + 1) + ' of ' + testsLen + ') Do you want to overwrite this test? '
		var overwriteExisting = false

		// Alert if this update overwrites `topResult`.
		if (!util.objectsEqual(test.topResult, newTest.topResult)) {
			util.logWarning('This overwrites `topResult`.')
			// Require user to explicitly input "yes" or "no" to confirm.
			overwriteExisting = readlineSync.question(promptMessage + '[yes/no] ', {
				trueValue: [ 'yes' ],
				falseValue: [ 'no' ],
				limit: [ 'yes', 'no' ],
				limitMessage: null,
			})
		} else {
			// Accept "y" or "n" key to confirm.
			overwriteExisting = readlineSync.keyInYNStrict(promptMessage)
		}

		if (overwriteExisting) {
			tests[t] = newTest
			testsOverwritten = true
			util.log('Test saved.')
		} else {
			util.log('Test not saved.')
		}
	}
}

if (testsOverwritten) {
	// Save new test suite.
	util.writeJSONFile(testsFilePath, tests)
} else {
	util.log('No tests updated.')
}