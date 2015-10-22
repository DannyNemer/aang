/**
 * Usage
 *   node addTest <query>
 *
 * Description
 *   Parses <query> and finds the 50-best parse trees, creates a new test with
 *   expeect values derived from the parse trees, and then saves the new test to
 *   the test suite.
 *
 *   Outputs the new test for the user to confirm before saving, and warns if a
 *   test for <qeury> already exists and will be overwritten.
 *
 * Options
 *   -h, --help  Display this screen.                                     [boolean]
 */

var util = require('../util/util')
var yargs = require('yargs')

var argv = yargs
	.usage([
		util.colors.bold('Usage'),
		'  node $0 <query>',
		'',
		util.colors.bold('Description'),
		'  Parses <query> and finds the 50-best parse trees, creates a new test with expeect values derived from the parse trees, and then saves the new test to the test suite.',
		'',
		'  Outputs the new test for the user to confirm before saving, and warns if a test for <qeury> already exists and will be overwritten.'
	].join('\n'))
	.updateStrings({
		'Options:': util.colors.bold('Options'),
	})
	.demand(1, 'Error: Missing input query')
	.help('h', 'Display this screen.').alias('h', 'help')
	// Fail on unrecognized arguments.
	.strict()
	.argv

var readlineSync = require('readline-sync')
var parse = require('../parse/parseExported')

var testsFilePath = './tests.json'
var tests = require(testsFilePath)

// Parse query and find 50-best parse trees.
var query = argv._.join(' ')
var trees = parse(query, 50)

if (!trees) {
	util.logError('Failed to reach start node.')
	process.exit(1)
} else if (trees.length === 0) {
	util.logError('Failed to find legal parse trees.')
	process.exit(1)
}

var topResult = trees[0]

// Create a new test.
var newTest = {
	// The query to parse.
	query: query,
	// The optional expected top result of the parse.
	topResult: {
		// The expected display text of the parse's top result.
		text: query === topResult.text ? false : topResult.text,
		// The expected semantic of the parse's top result.
		semantic: topResult.semanticStr,
	},
	// The optional note regarding the test printed when the test fails.
	note: undefined,
	// The unsorted expected semantics to compare (irrespective of order) to test output.
	semantics: getSemantics(trees),
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
util.log(newTest)
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

/**
 * Gets the semantic strings and disambiguated semantics of `trees`.
 *
 * @param {Object[]} trees The parse trees from which to collect the semantics.
 * @returns {string[]} Returns the semantic strings and disambiguated semantics of `trees`.
 */
function getSemantics(trees) {
	var semantics = []

	for (var t = 0, treesLen = trees.length; t < treesLen; ++t) {
		var tree = trees[t]

		semantics.push(tree.semanticStr)

		if (tree.disambiguation) {
			Array.prototype.push.apply(semantics, tree.disambiguation)
		}
	}

	return semantics
}