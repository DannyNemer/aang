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
 *   --force     Overwrite existing tests without confirmation prompts, except for
 *               those that update a test's expected top result.          [boolean]
 *   --super-force  Overwrite all existing tests without confirmation prompts.
 *                                                                        [boolean]
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
	.options({
		'force': {
			description: 'Overwrite existing tests without confirmation prompts, except for those that update a test\'s expected top result.',
			type: 'boolean',
		},
		'super-force': {
			description: 'Overwrite all existing tests without confirmation prompts.',
			type: 'boolean',
		},
	})
	.help('h', 'Display this screen.').alias('h', 'help')
	// Fail on unrecognized arguments.
	.strict()
	.argv

var readlineSync = require('readline-sync')
var parse = require('../parse/parseExported')

var testsFilePath = './tests.json'
var tests = require(testsFilePath)
var testUtil = require('./testUtil')
var testsOverwritten = false

// Check if test for `query` already exists.
for (var t = 0, testsLen = tests.length; t < testsLen; ++t) {
	var test = tests[t]

	// Parse test query and find 50-best parse trees.
	var parseResults = parse(test.query, 50)

	// Create a new test.
	var newTest = {
		// The query to parse.
		query: test.query,
		// The test description.
		description: test.description,
		// The test tags.
		tags: undefined,
		// The optional expected top result of the parse.
		topResult: test.topResult,
		// The unsorted expected semantics to compare (irrespective of order) to test output.
		semantics: testUtil.mapTreesToSemantics(parseResults.trees),
	}

	// If test previously passed (i.e., `test.semantics` indicate it last matched `test.topResult.semantic`), then update `topResult.semantic`. This is most often due to changed entity ids.
	if (test.topResult && test.topResult.semantic === test.semantics[0] && newTest.semantics.length > 0) {
		newTest.topResult = {
			// Do not overwrite the previous test's `topResult.text` because there are several tests with correct semantics but incorrect display text (e.g., conjugation).
			text: test.topResult.text,
			semantic: newTest.semantics[0],
		}
	}

	// Get applicable test tags. Must invoke after defining `newTest.topResult`.
	newTest.tags = testUtil.getTagsForTest(newTest, parseResults)

	// Check if new test has different semantics or tags.
	if (!util.arraysEqual(test.semantics, newTest.semantics) || !util.arraysEqual(test.tags, newTest.tags)) {
		// Print comparison of new and existing test.
		util.log(util.diffObjects(test, newTest))

		// Prompt user to confirm overwriting existing test.
		var promptMessage = '(' + (t + 1) + ' of ' + testsLen + ') Which would you like to do?'
		var overwriteExisting = false

		// Alert if this update overwrites `topResult`.
		if (!util.objectsEqual(test.topResult, newTest.topResult)) {
			util.logWarning('This change overwrites `topResult`.')

			if (argv.superForce) {
				// Check '--super-force' here to always print the `topResult` warning (above).
				overwriteExisting = true
			} else {
				var answerIndex = readlineSync.keyInSelect([
					'Overwrite this entire test.',
					'Overwrite this test except `topResult`.',
					'Skip this test.'
				], promptMessage, {
					// Do not show "CANCEL" choice.
					cancel: false,
				})

				if (answerIndex === 0) {
					// Overwrite entire test.
					overwriteExisting = true
				} else if (answerIndex === 1) {
					// Restore original `topResult` in new test.
					util.log('Original `topResult` restored.')
					newTest.topResult = test.topResult
					overwriteExisting = true
				} else if (answerIndex === 2) {
					// Skip test.
				}
			}
		}

		// Update does not overwrite `topResult`.
		else if (argv.superForce || argv.force) {
			overwriteExisting = true
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