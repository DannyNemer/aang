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

// Get the test query. Display prompt immediately, before generating the `StateTable`.
var query = readlineSync.question('query: ')

var printParseResults = require('../parse/printParseResults')
var parse = require('../parse/parseExported')

var testsFilePath = './tests.json'
var tests = require(testsFilePath)
var testUtil = require('./testUtil')

// Create new test for `query`.
var newTest = createNewTest(query)
// Prompt user to add `newTest` to `tests`.
addNewTest(tests, newTest)


/**
 * Creates a new test for `query`.
 *
 * Displays the `query` parse results, prompts the user for the new test description and expected top parse result, and automatically assigns applicable test tags, if any.
 *
 * @private
 * @static
 * @param {string} query The new test query.
 * @returns {Object} Returns the new test.
 */
function createNewTest(query) {
	// Parse query and find 50-best parse trees.
	var parseResults = parse(query, 50)

	// Print parse results.
	printQueryParseResults(query, parseResults)

	// Create a new test.
	var newTest = {
		// The query to parse.
		query: query,
		// The test description.
		description: undefined,
		// The test tags.
		tags: undefined,
		// The optional expected top result of the parse. When omitted, specifies the top parse result should not match `query`.
		topResult: getTopResult(query, parseResults.trees),
		// The unsorted expected semantics to compare (irrespective of order) to test output.
		semantics: testUtil.mapTreesToSemantics(parseResults.trees),
	}

	// Get the required test description.
	newTest.description = getDescription()

	// Get the applicable test tags. Must invoke after defining `newTest.topResult`.
	newTest.tags = testUtil.getTagsForTest(newTest, parseResults)

	return newTest
}

/**
 * Prompts the user to add `newTest` to `tests`.
 *
 * Warns if a test in `tests` already exists for `newTest.query`, allowing the user to overwrite the existing test.
 *
 * @private
 * @static
 * @param {Object[]} tests The test suite.
 * @param {Object} newTest The new test to add to `tests`.
 * @returns {boolean} Returns `true` if the user chose to add `newTest`, else `false`.
 */
function addNewTest(tests, newTest) {
	// Check if a test for `query` already exists.
	for (var t = 0, testsLen = tests.length; t < testsLen; ++t) {
		var existingTest = tests[t]
		if (existingTest.query === newTest.query) {
			// Prompt the user to overwrite the existing test at index `t`.
			return promptOverwriteTest(tests, newTest, t)
		}
	}

	// Prompt the user to append `newTest` to the end of the test suite.
	return promptAppendTest(tests, newTest)
}

/**
 * Prompts the user to append `newTest` to `tests`.
 *
 * @private
 * @static
 * @param {Object[]} tests The test suite.
 * @param {Object} newTest The new test to append to `tests`.
 * @returns {boolean} Returns `true` if the user chose to append `newTest`, else `false`.
 */
function promptAppendTest(tests, newTest) {
	var actions = {
		'y': 'append this test',
		'n': 'discard this test',
		'd': 'edit test description',
	}

	// Print new test.
	util.log(util.colors.bold('\nNew test:'), newTest)

	util.log()
	for (var actionKey in actions) {
		util.log(actionKey, '-', actions[actionKey])
	}

	// Require user to input one of the specified action keys.
	var actionKeys = Object.keys(actions)
	var actionKey = readlineSync.keyIn(util.colors.bold.blue('Append this test [' + actionKeys + ']? '), {
		limit: actionKeys,
	})

	switch (actionKey) {
		case 'y':
			// Print success message before `util.writeJSONFile()` "File saved" message.
			util.log('Test added:', util.stylize(newTest.query))

			// Append `newTest` to test suite.
			tests.push(newTest)
			util.writeJSONFile(testsFilePath, tests)
			return true
		case 'n':
			util.log('Test not saved.')
			return false
		case 'd':
			util.log()
			newTest.description = getDescription()
			return promptAppendTest(tests, newTest)
	}

	throw new Error('promptAppendTest: Should be unreachable.')
}

/**
 * Prompts the user to overwrite the existing test at `tests[testIndex]` with `newTest`.
 *
 * @private
 * @static
 * @param {Object[]} tests The test suite.
 * @param {Object} newTest The new test to replace the existing test at `tests[testIndex]`.
 * @param {number} testIndex The `tests` index to save `newTest`.
 * @returns {boolean} Returns `true` if the user chose to overwrite the existing test, else `false`.
 */
function promptOverwriteTest(tests, newTest, testIndex) {
	var actions = {
		'y': 'overwrite existing test',
		'n': 'do not overwrite existing test',
		'd': 'edit new test description',
	}

	// Print comparison of existing and new test.
	util.logWarning('\nTest already exists:')
	util.log(util.diffObjects(tests[testIndex], newTest))

	util.log()
	for (var actionKey in actions) {
		util.log(actionKey, '-', actions[actionKey])
	}

	// Require user to input one of the specified action keys.
	var actionKeys = Object.keys(actions)
	var actionKey = readlineSync.keyIn(util.colors.bold.blue('Overwrite existing test [' + actionKeys + ']? '), {
		limit: actionKeys,
	})

	switch (actionKey) {
		case 'y':
			// Print success message before `util.writeJSONFile()` "File saved" message.
			util.log('Test added:', util.stylize(newTest.query))

			// Add `newTest` to test suite at `testIndex`.
			tests[testIndex] = newTest
			util.writeJSONFile(testsFilePath, tests)
			return true
		case 'n':
			util.log('Test not saved.')
			return false
		case 'd':
			util.log()
			newTest.description = getDescription()
			return promptOverwriteTest(tests, newTest, testIndex)
	}

	throw new Error('promptOverwriteTest: Should be unreachable.')
}

/**
 * Prompts the user to define an expected top result for parsing `query`. If the user agrees, gets the expected `text` (string) and `semantic` (string) values. If the user declines, it specifies the new test's top parse result should not match `query`.
 *
 * @private
 * @static
 * @param {string} query The new test's input query.
 * @param {Object[]} [trees] The parse trees output from parsing `query`.
 * @returns {Object|undefined} Returns the expected top result for the new test, with `text` (string) and `semantic` (string), if the user chooses to define, else `undefined`.
 */
function getTopResult(query, trees) {
	if (readlineSync.keyInYNStrict('Define an expected top parse result? If not, it specifies the top parse result should not match `query`.')) {
		// Shim `trees`.
		var topParseResult = trees && trees[0] || {}

		// Get the expected display text of the parse's top result.
		var newTestTopResultText = readlineSync.question(
			'topResult.text: ($<defaultInput>) ',
			{ defaultInput: topParseResult.text }
		)

		// If the user provides a top result display text that differs from the top parse result's and the input query, then parse that (corrected) display text and use its top result semantic as the suggested (default) semantic instead of the original parse's.
		var defaultTopResultSemantic
		if (newTestTopResultText !== topParseResult.text && newTestTopResultText !== query) {
			var correctedParseResults = parse(newTestTopResultText, 1)
			var correctedTrees = correctedParseResults.trees

			if (correctedTrees && correctedTrees.length > 0) {
				defaultTopResultSemantic = correctedTrees[0].semanticStr
			}
		}

		// Get the expected semantic of the parse's top result.
		var newTestTopResultSemantic = readlineSync.question(
			'topResult.semantic: ($<defaultInput>) ',
			{ defaultInput: defaultTopResultSemantic || topParseResult.semanticStr }
		)

		return {
			text: newTestTopResultText,
			semantic: newTestTopResultSemantic,
		}
	}
}

/**
 * Prompts the user for the new test's description.
 *
 * @private
 * @static
 * @returns {string} Returns the test description.
 */
function getDescription() {
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

			return description
		} else {
			util.logError('A description is required.')
		}
	}
}

/**
 * Prints the parse results for `query`.
 *
 * @private
 * @static
 * @param {string} query The new test's input query.
 * @param {Object} parseResults The parse results from parsing `query`.
 */
function printQueryParseResults(query, parseResults) {
	util.log('\n' + util.colors.bold('Parse results:'))

	if (parseResults.trees) {
		// Clone `parseResults` to print only first 5 parse results.
		var parseResults = util.clone(parseResults)
		parseResults.trees = parseResults.trees.slice(0, 5)
	}

	printParseResults(parseResults, {
		diffInputQuery: query,
	})

	util.log()
}

/**
 * Prompts user to add tags to `newTest`. The user either chooses from `tags` or creates a new tag.
 *
 * @deprecated No longer in use because all tags are defined in `tags`, where each has a validation function that checks it the tag applies to a given test.
 *
 * @private
 * @static
 * @param {Object} newTest The new tag to which to add tags at `newTest.tags`.
 * @param {string[]} tags The tags from which the user can choose.
 */
function tagsPrompt(newTest, tags) {
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
}