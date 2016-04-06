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
 *   --force        Overwrite existing tests without confirmation prompts, except
 *                  for those that update a test's expected top result.   [boolean]
 *   --super-force  Overwrite all existing tests without confirmation prompts.
 *                                                                        [boolean]
 *   -h, --help     Display this screen.                                  [boolean]
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
var numTestsUpdated = 0

// Re-parse `tests` and updates the expected values of each if there are parse result changes.
updateTests(tests)

// Save test suite changes.
saveTestSuiteChanges(tests, testsFilePath, numTestsUpdated)


/**
 * Re-parses `tests` and updates the expected values of each if there are parse result changes.
 *
 * @private
 * @static
 * @param {Object[]} The tests to parse and update.
 */
function updateTests(tests) {
	for (var t = 0, testsLen = tests.length; t < testsLen; ++t) {
		var test = tests[t]

		// Create a new test with updated expected values.
		var newTest = createUpdatedTest(test)

		// Check if new test has different semantics or tags.
		if (!util.arraysEqual(test.semantics, newTest.semantics) || !util.arraysEqual(test.tags, newTest.tags)) {
			// Print comparison of new and existing test.
			util.log(util.diffObjects(test, newTest))

			// Prompt user to confirm overwriting existing test.
			var promptMessage = '(' + (t + 1) + ' of ' + testsLen + ') Which would you like to do?'
			var overwriteExisting = false

			if (!util.objectsEqual(test.topResult, newTest.topResult)) {
				// Prompt test overwrites `topResult`.
				overwriteExisting = promptTestUpdateDiffTopResult(promptMessage)
			} else {
				// Prompt test update.
				overwriteExisting = promptTestUpdate(promptMessage)
			}

			if (overwriteExisting) {
				updateTest(t, tests, newTest)
			} else {
				util.log('Test not saved.\n')
			}
		}
	}
}

/**
 * Creates a new test from `existingTest` with updated expected values (by re-parsing `existingTest.test` and examining the parse results).
 *
 * @private
 * @static
 * @param {Object} existingTest The existing test to re-parse and update.
 * @returns {Object} Returns the new test with updated expected values, if any.
 */
function createUpdatedTest(existingTest) {
	// Parse test query and find 50-best parse trees.
	var parseResults = parse(existingTest.query, 50)

	// Create a new test.
	var newTest = {
		// The query to parse.
		query: existingTest.query,
		// The test description.
		description: existingTest.description,
		// The test tags.
		tags: undefined,
		// The optional expected top result of the parse.
		topResult: existingTest.topResult,
		// The unsorted expected semantics to compare (irrespective of order) to test output.
		semantics: testUtil.mapTreesToSemantics(parseResults.trees),
	}

	// If `existingTest` previously succeeded (i.e., `existingTest.semantics` indicate it last matched `existingTest.topResult.semantic`), then update `topResult.semantic`. This is most often due to changed entity ids.
	if (existingTest.topResult && existingTest.topResult.semantic === existingTest.semantics[0] && newTest.semantics.length > 0) {
		newTest.topResult = {
			// Do not overwrite the previous test's `topResult.text` because there are several tests with correct semantics but incorrect display text (e.g., conjugation).
			text: existingTest.topResult.text,
			semantic: newTest.semantics[0],
		}
	}

	// Get applicable test tags. Must invoke after defining `newTest.topResult`.
	newTest.tags = testUtil.getTagsForTest(newTest, parseResults)

	return newTest
}

/**
 * Prompt user to overwrite a test change when there is a change to `topResult`.
 *
 * @private
 * @static
 * @param {string} promptMessage The message to display with the action list prompt.
 * @returns {boolean} Returns `true` if the user chooses to overwrite the test, else `false`.
 */
function promptTestUpdateDiffTopResult(promptMessage) {
	util.logWarning('This change overwrites `topResult`.')

	if (argv.superForce) {
		// Check '--super-force' here to always print the `topResult` warning (above).
		return true
	}

	var answerIndex = readlineSync.keyInSelect([
		'Overwrite this entire test.',
		'Overwrite this test except `topResult`.',
		'Skip this test.',
		'Save and exit; skip this test, save all previous test changes, and exit.',
		'Abort; skip this test, discard all previous test changes, and exit.',
	], promptMessage, {
		// Do not show "CANCEL" choice.
		cancel: false,
	})

	if (answerIndex === 0) {
		// Overwrite this entire test.
		return true
	} else if (answerIndex === 1) {
		// Restore original `topResult` in new test.
		util.log('Original `topResult` restored.')
		newTest.topResult = test.topResult
		return true
	} else if (answerIndex === 2) {
		// Skip this test.
		return false
	} else if (answerIndex === 3) {
		// Skip this test.
		util.log('Test not saved.')
		// Save all previous test changes, and exit.
		saveAndExit()
	} else if (answerIndex === 4) {
		abortTestSuiteUpdate()
	}

	throw new Error('promptTestUpdateDiffTopResult: Should never be reached.')
}

/**
 * Prompt user to overwrite a test change (when there is no change to `topResult`).
 *
 * @private
 * @static
 * @param {string} promptMessage The message to display with the action list prompt.
 * @returns {boolean} Returns `true` if the user chooses to overwrite the test, else `false`.
 */
function promptTestUpdate(promptMessage) {
	if (argv.superForce || argv.force) {
		return true
	}

	// Accept "y" or "n" key to confirm.
	var answerIndex = readlineSync.keyInSelect([
		'Overwrite this test.',
		'Skip this test.',
		'Save and exit; skip this test, save all previous test changes, and exit.',
		'Abort; skip this test, discard all previous test changes, and exit.',
	], promptMessage, {
		// Do not show "CANCEL" choice.
		cancel: false,
	})

	if (answerIndex === 0) {
		// Overwrite this test.
		return true
	} else if (answerIndex === 1) {
		// Skip this test.
		return false
	} else if (answerIndex === 2) {
		// Skip this test.
		util.log('Test not saved.')
		// Save all previous test changes, and exit.
		saveAndExit()
	} else if (answerIndex === 3) {
		abortTestSuiteUpdate()
	}

	throw new Error('promptTestUpdate: Should never be reached.')
}

/**
 * Overwrites the test at `testIndex` in `tests` with `newTest`.
 *
 * Increments module variable `numTestsUpdated`.
 *
 * @private
 * @static
 * @param {number} testIndex The index of the test in `tests` to overwrite.
 * @param {Object[]} tests The test suite.
 * @param {Object} newTest The new test to replace the existing test at `testIndex` in `tests`.
 */
function updateTest(testIndex, tests, newTest) {
	tests[testIndex] = newTest
	++numTestsUpdated
	util.log('Test saved.\n')
}

/**
 * Writes `tests` to `testsFilePath`.
 *
 * @private
 * @static
 * @param {Object[]} tests The test suite to write to `testsFilePath`.
 * @param {string} testsFilePath The file-path at where to write `tests`.
 * @param {number} numTestsUpdated The number of tests updated in tests.
 */
function saveTestSuiteChanges(tests, testsFilePath, numTestsUpdated) {
	if (numTestsUpdated > 0) {
		// Save new test suite.
		util.log(numTestsUpdated, 'of', tests.length, 'test updated.')
		util.writeJSONFile(testsFilePath, tests)
	} else {
		util.logWarning('No tests updated.')
	}
}

/**
 * Prints a message for exiting test suite update prematurely, saves any changes to the test suite, and exits process with code 0.
 *
 * @private
 * @static
 */
function saveAndExit() {
	util.log('Save test changes and exit.')
	saveTestSuiteChanges(tests, testsFilePath, numTestsUpdated)
	process.exit(0)
}

/**
 * Prints an error message and exists the process with code 1 without saving any test suite changes.
 *
 * @private
 * @static
 */
function abortTestSuiteUpdate() {
	util.logError('Test suite update aborted. No tests updated.')
	process.exit(1)
}