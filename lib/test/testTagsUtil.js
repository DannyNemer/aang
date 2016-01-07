/**
 * Utility functions for operating on tags in the test suite.
 */

var util = require('../util/util')


/**
 * Creates a new array with all tests from `tests` that contain a tag in `tags`.
 *
 * @static
 * @param {Object[]} tests The test suite.
 * @param {string[]} tags The tags by which filter.
 * @returns {Object[]} Returns the new, filtered array of tests.
 */
exports.filterTestsByTag = function (tests, tags) {
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
			exports.listTagsInTests(tests)
			process.exit(1)
		}
	}

	return filteredTests
}

/**
 * Prints a list of all tags found in `tests`.
 *
 * @param {Object[]} tests The test suite.
 */
exports.listTagsInTests = function (tests) {
	var tags = exports.getTags(tests)
	util.log('Tags found in the test suite:')
	util.log('  ' + tags.join('\n  '))
}

/**
 * Gets all tags found in `tests`.
 *
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

/**
 * Checks if the 'union' tag applies to `test`.
 *
 * @param {Object} test The test to check.
 * @param {Object[]} trees The parse trees from `test.query`.
 * @returns {boolean} Returns `true` if the 'union' tag applies to `test`, else `false`.
 */
 exports.hasUnion = function (test, trees) {
	var reHasOr = /(^|\W)or(\W|$)/
	var reHasUnion = /(^|\W)union\((\W|$)/

	// Check if input query contains "or".
	if (reHasOr.test(test.query)) {
		return true
	}

	// Check if top parse result has display text with "or" os semantic with `union()`.
	var parseTopResult = trees[0]
	if (parseTopResult && (reHasOr.test(parseTopResult.text) || reHasUnion.test(parseTopResult.semanticStr))) {
		return true
	}

	// Check if test's expected top parse result has display text with "or" os semantic with `union()`.
	var expectedTopResult = test.topResult
	if (expectedTopResult && (reHasOr.test(expectedTopResult.text) || reHasUnion.test(expectedTopResult.semantic))) {
		return true
	}

	return false
}