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

// Print warning if a test with `query` exists.
warnIfTestExists(tests, query)
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
		// The optional expected top result of the parse. When omitted, specifies the top parse result must be anything but `query`.
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
	var existingTestIndex = testUtil.indexOfTest(tests, newTest.query)
	if (existingTestIndex !== -1) {
		// Prompt the user to overwrite the existing test at index `existingTestIndex`.
		return promptAddTest(tests, newTest, existingTestIndex)
	}

	// Prompt the user to append `newTest` to the end of the test suite.
	return promptAddTest(tests, newTest)
}

/**
 * Prompts the user to add `newTest` to `tests` at `testIndex`.
 *
 * If `testIndex` is an existing test index, warns user that `newTest` will overwrite the existing test.
 *
 * @private
 * @static
 * @param {Object[]} tests The test suite.
 * @param {Object} newTest The new test to save to `tests`.
 * @param {number} [testIndex=tests.length] The `tests` index to save `newTest`.
 * @returns {boolean} Returns `true` if the user chose to save `newTest`, else `false`.
 */
function promptAddTest(tests, newTest, testIndex) {
	var promptMessage
	var actions

	if (tests[testIndex] === undefined) {
		testIndex = tests.length
		promptMessage = 'Add test to test suite'
		actions = {
			'y': 'add test to test suite',
			'n': 'discard test',
			't': 'edit test expected top parse result (`topResult`)',
			'd': 'edit test description',
		}

		// Print new test.
		util.log(util.colors.bold('\nNew test:'), newTest)
	} else {
		promptMessage = 'Overwrite existing test'
		actions = {
			'y': 'overwrite existing test',
			'n': 'do not overwrite existing test',
			't': 'edit new test expected top parse result (`topResult`)',
			'd': 'edit new test description',
		}

		// Print comparison of existing and new test.
		util.logWarning('\nTest for query already exists:')
		util.log(util.diffObjects(tests[testIndex], newTest))
	}

	// Print prompt choices.
	util.log()
	for (var actionKey in actions) {
		util.log(actionKey, '-', actions[actionKey])
	}

	// Require user to input one of the specified action keys.
	var actionKeys = Object.keys(actions)
	var actionKey = readlineSync.keyIn(util.colors.bold.blue(promptMessage + ' [' + actionKeys + ']? '), {
		limit: actionKeys,
	})

	switch (actionKey) {
		case 'y':
			// Print success message before `util.writeJSONFile()` "File saved" message.
			util.log('Test added:', util.stylize(newTest.query))

			// Save `newTest` to test suite at `testIndex`.
			tests[testIndex] = newTest
			util.writeJSONFile(testsFilePath, tests)
			return true
		case 'n':
			util.log('Test not saved.')
			return false
		case 't':
			util.log()
			var topResultPromptDefaults
			if (newTest.topResult) {
				topResultPromptDefaults = [ {
					text: newTest.topResult.text,
					semanticStr: newTest.topResult.semantic,
				} ]
			}
			newTest.topResult = getTopResult(newTest.query, topResultPromptDefaults)
			break
		case 'd':
			util.log()
			newTest.description = getDescription()
			break
		default:
			throw new Error('Unrecognized prompt choice.')
	}

	// Prompt again after amending `newTest.topResult` or `newTest.description`.
	return promptAddTest(tests, newTest, testIndex)
}

/**
 * Prompts the user to define an expected top result for parsing `query`. If the user agrees, gets the expected `text` (string) and `semantic` (string) values. If the user declines, it specifies the new test's top parse result must be anything but `query`.
 *
 * @private
 * @static
 * @param {string} query The new test's input query.
 * @param {Object[]} [parseTrees] The parse trees output from parsing `query`.
 * @returns {Object|undefined} Returns the expected top result for the new test, with `text` (string) and `semantic` (string), if the user chooses to define, else `undefined`.
 */
function getTopResult(query, parseTrees) {
	if (readlineSync.keyInYNStrict('Define an expected top parse result? If not, it specifies the top parse result must be anything but `query`.')) {
		// Shim `parseTrees`.
		var topParseResult = parseTrees && parseTrees[0] || {}

		// Get the expected display text of the top parse result.
		var newTestTopResultText
		while (!newTestTopResultText) {
			newTestTopResultText = readlineSync.question(
				'topResult.text: ($<defaultInput>) ',
				{ defaultInput: topParseResult.text }
			)

			if (!newTestTopResultText) {
				util.logError('The expected top result display text is required.')
			}
		}

		// If the user provides a top result display text that differs from the top parse result and the input query, then parse that (corrected) display text and use its top result semantic as the suggested (default) semantic instead of the original top parse result semantic.
		var defaultTopResultSemantic
		if (newTestTopResultText !== topParseResult.text && newTestTopResultText !== query) {
			var correctedParseResults = parse(newTestTopResultText, 1)
			var correctedTrees = correctedParseResults.trees

			if (correctedTrees && correctedTrees.length > 0) {
				defaultTopResultSemantic = correctedTrees[0].semanticStr
			}
		}

		// Get the expected semantic of the top parse result.
		var newTestTopResultSemantic
		while (!newTestTopResultSemantic) {
			newTestTopResultSemantic = readlineSync.question(
				'topResult.semantic: ($<defaultInput>) ',
				{ defaultInput: defaultTopResultSemantic || topParseResult.semanticStr }
			)

			if (!newTestTopResultSemantic) {
				util.logError('The expected top result semantic is required.')
			}
		}

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
 * Prints a warning if a test with `query` exists in `tests`.
 *
 * @private
 * @static
 * @param {Object[]} tests The tests to search.
 * @param {string} query The test query to match.
 */
function warnIfTestExists(tests, query) {
	var existingTest = testUtil.findTest(tests, query)
	if (existingTest) {
		var existingTestCopy = util.clone(existingTest)
		existingTestCopy.semantics = existingTestCopy.semantics.slice(0, 3)
		util.logWarning('\nTest for query already exists. Proceed to overwrite:', existingTestCopy)
		util.log(util.colors.grey('    ↑ `semantics` truncated.'))
	}
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