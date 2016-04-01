/**
 * Utility functions for the test suite.
 */

var util = require('../util/util')


/**
 * Gets the test in `tests` with query `query`.
 *
 * @static
 * @memberOf testUtil
 * @param {Object[]} tests The tests over which to search.
 * @param {string} query The test query for which to match.
 * @returns {Object|undefined} Returns the test with query `query` if exists, else `undefined`.
 */
exports.getTest = function (tests, query) {
	for (var t = 0, testsLen = tests.length; t < testsLen; ++t) {
		var test = tests[t]
		if (test.query === query) {
			return test
		}
	}
}

/**
 * Prints `test` to output, excluding the `semantic` value. For use by the `list` command.
 *
 * @static
 * @memberOf testUtil
 * @param {Object} test The test from the test suite to print.
 */
exports.printTest = function (test) {
	var query = test.query
	var topResult = test.topResult

	if (topResult) {
		if (topResult.text !== query) {
			var textDiff = util.diffStrings(query, topResult.text)
			util.log(textDiff.expected)
			util.log(textDiff.actual)
		} else {
			util.log(query)
		}

		util.log('  ', topResult.semantic)
	} else {
		util.log(query)
		util.log(util.colors.red('--not-input--'))
	}

	util.log('  ', util.colors.grey(test.description))
}