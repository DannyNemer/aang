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
var testTagsUtil = require('./testTagsUtil')

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
	printParseResults(trees.slice(0, 5), {
		diffInputQuery: query,
	})
}
util.log()

// Create a new test.
var newTest = {
	// The query to parse.
	query: query,
	// The test description.
	description: undefined,
	// The optional test tags.
	tags: [],
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
		if (description.indexOf('Check ') !== 0) {
			util.logError('Description does not start with "Check ...":', util.stylize(description))
			continue
		}

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

// Get the optional test tags.
var tags = testTagsUtil.getTags(tests)
tags.unshift('NONE', 'NEW TAG')

while (true) {
	var tagIndex = readlineSync.keyInSelect(tags, 'Add a tag', { cancel: false })

	// User chose 'NONE'.
	if (tagIndex === 0) break

	var newTag
	if (tagIndex === 1) {
		// User chose 'NEW TAG'.
		while (true) {
			newTag = readlineSync.question('New tag: ').toLowerCase()

			if (newTag) {
				if (tags.indexOf(newTag) === -1 && newTest.tags.indexOf(newTag) === -1) {
					break
				} else {
					util.logError('Tag already exists:', util.stylize(newTag))
				}
			}
		}
	} else {
		newTag = tags[tagIndex]

		// Remove chosen tag from choices.
		tags.splice(tagIndex, 1)
	}

	newTest.tags.push(newTag)
	util.log('Tags for new test:', newTest.tags)
}

// Check if test for `query` already exists.
for (var t = 0, testsLen = tests.length; t < testsLen; ++t) {
	var test = tests[t]
	if (test.query === query) {
		// Print comparison of new and existing test.
		util.log()
		util.logWarning('Test already exists:')
		util.log(util.diffObjects(test, newTest))

		// Prompt the user to confirm overwriting the existing test (at index `t`) for the provided query.
		saveTest(tests, newTest, t, 'Test already exists. Do you want to overwrite it?')
		return
	}
}

// Prompt user to confirm saving this test (appended at the end of the test suite).
util.log(util.colors.bold('\nNew test:'), newTest)
saveTest(tests, newTest, testsLen, 'Save this test?')

/**
 * Saves `newTest` to test suite at `index` and overwrite existing tests file.
 *
 * @private
 * @static
 * @param {Object[]} tests The test suite to which to add `newTest`.
 * @param {Object} newTest The new test to save to `tests`.
 * @param {number} index The test suite index at which to save `newTest`.
 * @param {string} promptMsg The message to display to the user to confirm saving `newTest`.
 */
function saveTest(tests, newTest, index, promptMsg) {
	do {
		var response = readlineSync.keyInYN(promptMsg)
		if (response) {
			// Print success message before "File saved" message.
			util.log('Test added:', util.stylize(newTest.query))

			// Add test to test suite at `index`
			tests[index] = newTest
			util.writeJSONFile(testsFilePath, tests)
			return
		} else if (response === false) {
			util.log('Test not saved.')
		}
	} while (response === '')
}