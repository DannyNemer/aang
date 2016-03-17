/**
 * Utility functions for operating on tags in the test suite.
 */

var util = require('../util/util')
var cliui = require('cliui')
var tags = require('./testTags')


/**
 * Creates a new array with all tests from `tests` that contain a tag in `filterTags`.
 *
 * @static
 * @memberOf testTagsUtil
 * @param {Object[]} tests The test suite.
 * @param {string[]} filterTags The tags by which filter.
 * @returns {Object[]} Returns the new, filtered array of tests.
 */
exports.filterTestsByTags = function (tests, filterTags) {
	// Check for unrecognized tags.
	for (var t = 0, tagsLen = filterTags.length; t < tagsLen; ++t) {
		var filterTagName = filterTags[t]
		if (!tags[filterTagName]) {
			util.logError('Unrecognized test tag:', util.stylize(filterTagName))
			util.log()
			exports.printTags(tests)
			process.exit(1)
		}
	}

	var filteredTests = []

	// Adds tests to `filteredTests` that contain a tag in `filterTags`, while maintaining original order of `tests`.
	for (var t = 0, origTestLen = tests.length; t < origTestLen; ++t) {
		var test = tests[t]
		var testTags = test.tags

		for (var i = 0, testTagsLen = testTags.length; i < testTagsLen; ++i) {
			if (filterTags.indexOf(testTags[i]) !== -1) {
				filteredTests.push(test)
				break
			}
		}
	}

	return filteredTests
}

/**
 * Gets the test tags that apply to `test` and its parse results. Invokes the validation functions in `tags` to determine the applicable tags.
 *
 * @static
 * @memberOf testTagsUtil
 * @param {Object} test The test to check.
 * @param {Object} parseResults The parse results from parsing `test.query`.
 * @returns {string[]} Returns an array of the tags that apply to `test`.
 */
exports.getTagsForTest = function (test, parseResults) {
	var testTags = []

	for (var tagName in tags) {
		if (tags[tagName].appliesToTest(test, parseResults)) {
			testTags.push(tagName)
		}
	}

	return testTags
}

/**
 * Prints the names and descriptions of the tags in the test suite.
 *
 * @static
 * @memberOf testTagsUtil
 */
exports.printTags = function () {
	util.log(util.colors.bold('Test Suite Tags:'))

	var tagsTable = cliui({
		width: 80,
		wrap: true,
	})

	for (var tagName in tags) {
		tagsTable.div({
			text: tagName,
			width: 18,
			// 2 px left padding, 1 px bottom padding.
			padding: [ 0, 0, 1, 2 ],
		}, {
			text: tags[tagName].description,
			// 1 px bottom padding.
			padding: [ 0, 0, 1, 0 ],
		})
	}

	util.log(tagsTable.toString())
}

/**
 * The map of test suite tag names to `TagSchema` objects. Each defines a tag used in the test suite and can check its application to a provided test.
 *
 * @type {Object.<string, TagSchema>}
 * @memberOf testTagsUtil
 */
exports.tags = tags