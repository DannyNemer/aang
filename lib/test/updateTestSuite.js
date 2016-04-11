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
		var existingTest = tests[t]

		// Create a new test with updated expected values.
		var newTest = createUpdatedTest(existingTest)

		// Check if new test has different semantics or tags.
		if (!util.arraysEqual(existingTest.semantics, newTest.semantics) || !util.arraysEqual(existingTest.tags, newTest.tags)) {
			// Print comparison of new and existing test.
			util.log(util.diffObjects(existingTest, newTest))
			// Prompt the user to overwrite the test at `tests[t]` with `newTest.
			if (promptOverwriteTest(tests, t, newTest)) {
				tests[testIndex] = newTest
				++numTestsUpdated
				util.log('Test saved.\n')
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
 * Prompts the user to overwrite the test at `tests[testIndex]` with `newTest.
 *
 * @private
 * @static
 * @param {Object[]} tests The test suite.
 * @param {number} testIndex The index of the test in `tests` to overwrite.
 * @param {Object} newTest The new test to replace the existing test at `tests[testIndex]`.
 * @returns {boolean} Returns `true` if the user chose to overwrite the existing test, else `false`.
 */
function promptOverwriteTest(tests, testIndex, newTest) {
	var actions = {
		'y': 'overwrite this test',
		'e': 'overwrite this test except `topResult`',
		'n': 'do not overwrite this test',
		'q': 'quit; do not overwrite this test, save all previous test changes, and exit',
		'a': 'abort; do not overwrite this test, discard all previous test changes, and exit',
	}

	var existingTest = tests[testIndex]
	// Check if `newTest` overwrites `existingTest.topResult`.
	if (!util.objectsEqual(existingTest.topResult, newTest.topResult)) {
		util.logWarning('This change overwrites `topResult`.')

		// Overwrite test without prompt if '--super-force' command line option was provided.
		// Check '--super-force' after printing the `topResult` warning (above).
		if (argv.superForce) {
			return true
		}
	} else {
		// Overwrite test without prompt if '--force' or '--super-force' command line option was provided.
		if (argv.superForce || argv.force) {
			return true
		}

		// Hide the `topResult` action in action list (because this update does not overwrite `topResult`).
		delete actions.e
	}

	util.log()
	for (var actionKey in actions) {
		util.log(actionKey, '-', actions[actionKey])
	}

	// Require user to input one of the specified action keys.
	var actionKeys = Object.keys(actions)
	var query = '(' + (testIndex + 1) + ' of ' + tests.length + ') Overwrite this test [' + actionKeys + ']? '
	var actionKey = readlineSync.keyIn(util.colors.bold.blue(query), {
		limit: actionKeys,
	})

	switch (actionKey) {
		case 'y':
			// Overwrite this entire test.
			return true
		case 'e':
			// Restore original `topResult` in new test.
			util.log('Original `topResult` restored.')
			newTest.topResult = existingTest.topResult
			return true
		case 'n':
			// Skip this test.
			return false
		case 'q':
			// Skip this test.
			util.log('Test not saved.')
			// Save all previous test changes, and exit process.
			saveAndExit()
		case 'a':
			// Exit process without saving test changes.
			abortTestSuiteUpdate()
	}

	throw new Error('promptOverwriteTest: Should be unreachable.')
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