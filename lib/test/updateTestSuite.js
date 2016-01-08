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

var testsFilePath = './tests.json'
var tests = require(testsFilePath)
var testTagsUtil = require('./testTagsUtil')
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
		// The optional test tags, updated with any changes.
		tags: updateTags(test, trees),
		// The optional expected top result of the parse.
		topResult: test.topResult,
		// The unsorted expected semantics to compare (irrespective of order) to test output.
		semantics: mapTreesToSemantics(trees),
	}

	// If test previously passed (i.e., `test.semantics` indicate it last matched `test.topResult.semantic`), then update `topResult.semantic`. This is most often due to changed entity ids.
	if (test.topResult && test.topResult.semantic === test.semantics[0] && newTest.semantics.length > 0) {
		newTest.topResult = {
			text: test.topResult.text,
			semantic: newTest.semantics[0],
		}
	}

	// Check if new test is different.
	if (!util.arraysEqual(test.semantics, newTest.semantics) || !util.arraysEqual(test.tags, newTest.tags)) {
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

/**
 * Updates `test.tags` by adding applicable tags or removing inapplicable tags..
 *
 * @param {Object} test The test to check.
 * @param {Object[]} trees The parse trees from `test.query`.
 * @returns {string[]} Returns a new array of the updated `test.tags`.
 */
function updateTags(test, trees) {
	// Clone tags array to enable checking for changes that require saving.
	var existingTags = test.tags.slice()

	// Add/remove 'union' tag.
	updateTag(test, trees, existingTags, 'union', testTagsUtil.hasUnion)

	// Add/remove 'anaphora' tag.
	updateTag(test, trees, existingTags, 'anaphora', testTagsUtil.isAnaphoric)

	return existingTags
}

/**
 * Adds or removes `tag` to/from `existingTags` based on whether `validator` returns truthy when invoked with the following two arguments: (test, trees).
 *
 * @param {Object} test The test to check.
 * @param {Object[]} trees The parse trees from `test.query`.
 * @param {string[]} existingTags The existing tags to modify.
 * @param {string} tag The name of the tag to add or remove.
 * @param {Function} validator The function to check if `tag` applies to `test`.
 */
function updateTag(test, trees, existingTags, tag, validator) {
	var tagIndex = existingTags.indexOf(tag)
	if (validator(test, trees)) {
		if (tagIndex === -1) {
			existingTags.push(tag)
		}
	} else if (tagIndex !== -1) {
		existingTags.splice(tagIndex, 1)
	}
}