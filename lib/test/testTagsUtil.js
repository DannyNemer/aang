/**
 * Utility functions for operating on tags in the test suite.
 */

var util = require('../util/util')
var cliui = require('cliui')
var tags = require('./tags.js')


/**
 * Creates a new array with all tests from `tests` that contain a tag in `tags`.
 *
 * @static
 * @param {Object[]} tests The test suite.
 * @param {string[]} tags The tags by which filter.
 * @returns {Object[]} Returns the new, filtered array of tests.
 */
exports.filterTestsByTags = function (tests, tags) {
	var filteredTests = []
	var foundTags = []
	var tagsLen = tags.length

	// Adds tests to `filteredTests` that contain a tag in `tags`, while maintain order of `tests`.
	for (var t = 0, origTestLen = tests.length; t < origTestLen; ++t) {
		var test = tests[t]
		var testTags = test.tags

		// Instead of checking for an intersection of at least one tag, check all tags to add every match to `foundTags` in case one tag is a complete subset of another tag and would not be marked as found otherwise.
		var containsMatchingTag = false
		for (var i = 0, testTagsLen = testTags.length; i < testTagsLen; ++i) {
			var testTag = testTags[i]

			for (var a = 0; a < tagsLen; ++a) {
				if (testTag === tags[a]) {
					containsMatchingTag = true

					if (foundTags.indexOf(testTag) === -1) {
						foundTags.push(testTag)
					}
				}
			}
		}

		if (containsMatchingTag) {
			filteredTests.push(test)
		}
	}

	// If no test is found for a provided tag, print an error and exit.
	for (var a = 0; a < tagsLen; ++a) {
		var tag = tags[a]
		if (foundTags.indexOf(tag) === -1) {
			util.logError('Tag not found:', util.stylize(tag))
			util.log()
			exports.printTags(tests)
			process.exit(1)
		}
	}

	return filteredTests
}

/**
 * Prints the names and descriptions of the tags in the test suite.
 *
 * @static
 */
exports.printTags = function () {
	util.log(util.colors.bold('Test suite tags'))

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
 * Gets all tags found in `tests`.
 *
 * @static
 * @param {Object[]} tests The test suite.
 * @returns {string[]} Returns an array of all tags found in `tests`.
 */
exports.getTags = function (tests) {
	var tags = []

	for (var t = 0, testsLen = tests.length; t < testsLen; ++t) {
		var testTags = tests[t].tags

		for (var i = 0, testTagsLen = testTags.length; i < testTagsLen; ++i) {
			var tag = testTags[i]

			if (tags.indexOf(tag) === -1) {
				tags.push(tag)
			}
		}
	}

	return tags
}