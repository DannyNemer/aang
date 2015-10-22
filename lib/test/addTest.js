/**
 * Usage
 *   node addTest
 *
 * Description
 *   Interactively creates a new test for the test suite.
 *
 *   Outputs the new test for the user to confirm before saving, and warns if a
 *   test for the provided query already exists and will be overwritten.
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
		'  Interactively creates a new test for the test suite.',
		'',
		'  Outputs the new test for the user to confirm before saving, and warns if a test for the provided query already exists and will be overwritten.'
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

// Get the test query.
var query = readlineSync.question('query: ')

// Parse query and find 50-best parse trees.
var trees = parse(query, 50) || []
var topResult = trees[0] || {}

// Create a new test.
var newTest = {
	// The query to parse.
	query: query,
	// The expected top result of the parse.
	topResult: {
		// The expected display text of the parse's top result.
		text: readlineSync.question(
			'topResult.text: (${defaultInput}) ',
			{ defaultInput: topResult.text }
		),
		// The expected semantic of the parse's top result.
		semantic: readlineSync.question(
			'topResult.semantic: (${defaultInput}) ',
			{ defaultInput: topResult.semanticStr }
		),
	},
	// The optional note regarding the test, printed when the test fails.
	note: readlineSync.question('note: '),
	// The unsorted expected semantics to compare (irrespective of order) to test output.
	semantics: mapTreesToSemantics(trees),
}

// Check if test for `query` already exists.
for (var t = 0, testsLen = tests.length; t < testsLen; ++t) {
	var test = tests[t]
	if (test.query === query) {
		// Print comparison of new and existing test.
		util.logError('Test already exists:')
		util.log(util.diffObjects(test, newTest))

		// Prompt the user to confirm overwriting the existing test for the provided query.
		if (readlineSync.keyInYN('Test already exists. Do you want to overwrite it?')) {
			// Overwrite existing test at index `t`.
			saveTest(newTest, t)
		} else {
			console.log('Test not saved.')
		}

		return
	}
}

// Prompt user to confirm saving this test.
util.log('New test:', newTest)
if (readlineSync.keyInYN('Save this test?')) {
	// Append test to test suite.
	saveTest(newTest, testsLen)
} else {
	console.log('Test not saved.')
}

/**
 * Saves `newTest` to test suite at `index` and overwrite existing tests file.
 *
 * @param {Object} newTest The new test to save to the test suite.
 * @param {number} index The test suite index at which to save `newTest`.
 */
function saveTest(newTest, index) {
	tests[index] = newTest
	util.writeJSONFile(testsFilePath, tests)
}