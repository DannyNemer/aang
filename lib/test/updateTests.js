/**
 * Usage
 *   node updateTests
 *
 * Description
 *   Parses and finds the 50-best parse trees of the existing tests queries in the
 *   test suite, creates new tests with expected values derived from the parse
 *   trees, and then overwrites the existing tests in the test suite.
 *
 *   If the new test differs from the existing test, outputs the new test for the
 *   user to confirm before overwriting.
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
		'  Parses and finds the 50-best parse trees of the existing tests queries in the test suite, creates new tests with expected values derived from the parse trees, and then overwrites the existing tests in the test suite.',
		'',
		'  If the new test differs from the existing test, outputs the new test for the user to confirm before overwriting.'
	].join('\n'))
	.updateStrings({
		'Options:': util.colors.bold('Options'),
	})
	.help('h', 'Display this screen.').alias('h', 'help')
	// Fail on unrecognized arguments.
	.strict()
	.argv

var readlineSync = require('readline-sync')
var parse = require('../parse/parseExported')

var testsFilePath = './tests.json'
var tests = require(testsFilePath)
var testsOverwritten = false

// Check if test for `query` already exists.
for (var t = 0, testsLen = tests.length; t < testsLen; ++t) {
	var test = tests[t]

	// Parse test query and find 50-best parse trees.
	var trees = parse(test.query, 50) || []
	var topResult = trees[0] || {}

	// Create a new test.
	var newTest = {
		// The query to parse.
		query: test.query,
		// The expected display text of the parse's first result:
		// - If `true`, then display text must be (any `string`) distinguishable from `newTest.query`.
		// - If `false`, then display text must match `newTest.query` (i.e., no edits).
		// - If a `string`, then display text must match `newTest.correction`.
		correction: test.correction,
		// The expected semantic of the parse's first result. Required when `newTest.correction` is `false` or a `string` (i.e., accepts a specific result), otherwise (i.e., accepts varying results) forbidden.
		semantic: test.semantic,
		// The optional note regarding the test printed when the test fails.
		note: test.note,
		// The optional unsorted expected semantics to compare (irrespective of order) to test output.
		suggestions: topResult.semanticStr === test.semantic || test.suggestions ? getSemanticSuggestions(trees) : undefined,
	}

	// Delete properties defined as `undefined` for `util.isDeepEqual()`.
	util.deleteUndefinedObjectProps(newTest)

	// Check if new test is different.
	if (!util.isDeepEqual(test, newTest)) {
		// Print comparison of new and existing test.
		util.log(util.diffObjects(test, newTest))

		// Prompt the user to confirm overwriting the existing test.
		if (readlineSync.keyInYN('Do you want to overwrite this test?')) {
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

/**
 * Gets the semantic strings and disambiguated semantics of `trees`.
 *
 * @param {Object[]} trees The parse trees from which to collect the semantics.
 * @returns {string[]} Returns the semantic strings and disambiguated semantics of `trees`.
 */
function getSemanticSuggestions(trees) {
	var semanticSuggestions = []

	for (var t = 0, treesLen = trees.length; t < treesLen; ++t) {
		var tree = trees[t]

		semanticSuggestions.push(tree.semanticStr)

		if (tree.disambiguation) {
			Array.prototype.push.apply(semanticSuggestions, tree.disambiguation)
		}
	}

	return semanticSuggestions
}