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
var printParseResults = require('../parse/printParseResults')

var testsFilePath = './tests.json'
var tests = require(testsFilePath)

// Get the test query.
var query = readlineSync.question('query: ')

// Parse query and find 50-best parse trees.
var trees = parse(query, 50)

// Print parse results.
util.log('\n' + util.colors.bold('Parse results:'))
if (!trees) {
	util.logError('Failed to reach start node.')
	trees = [] // Shim array.
} else if (trees.length === 0) {
	util.logError('Failed to find legal parse trees.')
} else {
	// Compare top result display text to query.
	var topResult = trees[0]
	if (topResult.text !== query) {
		var diff = util.diffStrings(query, topResult.text)
		util.log(diff.expected)
		topResult.text = diff.actual
	}

	printParseResults(trees.slice(0, 5))

	topResult.text = util.colors.stripColor(topResult.text)
}
util.log()

// Create a new test.
var newTest = {
	// The query to parse.
	query: query,
	// The test description.
	description: undefined,
	// The optional expected top result of the parse. When omitted, specifies the top parse result should not match `query`.
	topResult: undefined,
	// The unsorted expected semantics to compare (irrespective of order) to test output.
	semantics: mapTreesToSemantics(trees),
}

// Prompt user to specify defining an expected top parse result.
if (readlineSync.keyInYN('Define an expected top parse result? If not, it specifies the top parse result should not match `query`.')) {
	// Shim `trees`.
	var topResult = trees[0] || {}

	newTest.topResult = {
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
	}
}

// Get the required test description.
while (true) {
	var description = readlineSync.question('description: ')

	if (description) {
		// Ensure descriptions end with a period.
		if (description[description.length - 1] !== '.') {
			description += '.'
		}

		newTest.description = description

		break
	} else {
		util.logError('A description is required.')
	}
}

// Check if test for `query` already exists.
for (var t = 0, testsLen = tests.length; t < testsLen; ++t) {
	var test = tests[t]
	if (test.query === query) {
		// Print comparison of new and existing test.
		util.log()
		util.logWarning('Test already exists:')
		util.log(util.diffObjects(test, newTest))

		// Prompt the user to confirm overwriting the existing test for the provided query.
		do {
			var response = readlineSync.keyInYN('Test already exists. Do you want to overwrite it?')
			if (response) {
				// Overwrite existing test at index `t`.
				saveTest(tests, newTest, t)
			} else if (response === false) {
				util.log('Test not saved.')
			}
		} while (response === '')

		return
	}
}

// Prompt user to confirm saving this test.
util.log(util.colors.bold('\nNew test:'), newTest)
do {
	var response = readlineSync.keyInYN('Save this test?')
	if (response) {
		// Append test to test suite.
		saveTest(tests, newTest, testsLen)
	} else if (response === false) {
		util.log('Test not saved.')
	}
} while (response === '')

/**
 * Saves `newTest` to test suite at `index` and overwrite existing tests file.
 *
 * @private
 * @static
 * @param {Object[]} tests The test suite to which to add `newTest`.
 * @param {Object} newTest The new test to save to `tests`.
 * @param {number} index The test suite index at which to save `newTest`.
 */
function saveTest(tests, newTest, index) {
	util.log('Test added for:', util.stylize(newTest.query))
	tests[index] = newTest
	util.writeJSONFile(testsFilePath, tests)
}