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

var query = argv._.join(' ')

var testsFilePath = './tests.json'
var tests = require(testsFilePath)

// Check if test for `query` already exists.
for (var t = 0, testsLen = tests.length; t < testsLen; ++t) {
	var test = tests[t]
	if (test.query === query) {
		util.logError('Test already exists:', test)

		// Prompt the user to confirm overwriting the existing test for the provided query.
		if (!readlineSync.keyInYN('Test already exists. Do you want to continue?')) {
		  console.log('Test not saved.')
		  process.exit(1)
		}

		break
	}
}

var parse = require('../parse/parseExported')

// Parse query and find 50-best parse trees.
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
	// The expected display text of the parse's first result:
	// - If `true`, then display text must be (any `string`) distinguishable from `newTest.query`.
	// - If `false`, then display text must match `newTest.query` (i.e., no edits).
	// - If a `string`, then display text must match `newTest.correction`.
	correction: query === topResult.text ? false : topResult.text,
	// The expected semantic of the parse's first result. Required when `newTest.correction` is `false` or a `string` (i.e., accepts a specific result), otherwise (i.e., accepts varying results) forbidden.
	semantic: topResult.semanticStr,
	// The optional note regarding the test printed when the test fails.
	note: undefined,
	// The optional unsorted expected semantics to compare (irrespective of order) to test output.
	suggestions: getSemanticSuggestions(trees),
}

// Prompt user to confirm saving this test.
util.log(newTest)
if (readlineSync.keyInYN('Save this test?')) {
	// Save test to test suite at index `t` and overwrite existing file.
	tests[t] = newTest
	util.writeJSONFile(testsFilePath, tests)
} else {
  console.log('Test not saved.')
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