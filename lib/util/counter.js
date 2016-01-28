/**
 * @license
 * counter 0.0.1 - A counter for profiling in Node.js.
 * Copyright 2015-2016 Danny Nemer
 * Available under MIT license <http://opensource.org/licenses/MIT>
 */

var util = require('./util')

/**
 * Used as a key-value map for counters.
 *
 * @private
 * @type {Object}
 */
var _counts = Object.create(null)

/**
 * Increments the invocation count for `label`. Use `counter.end(label)` or `counter.endAll()` to print the counter's value. This is useful for profiling the number of times a section of code is reached.
 *
 * @static
 * @memberOf counter
 * @param {string} label The counter identifier.
 * @example
 *
 * for (var i = 0; i < 100; ++i) {
 *   if (i % 2 === 0) counter.count('even')
 * }
 *
 * counter.end('even')
 * // => Resets the count for 'even' to 0
 * // => Prints "even: 50"
 */
exports.count = function (label) {
	_counts[label] = (_counts[label] || 0) + 1
}

/**
 * Prints (and resets the value of) the number of `counter.count(label)` invocations.
 *
 * @static
 * @memberOf counter
 * @param {string} label The counter identifier.
 */
exports.end = function (label) {
	// Print even if count is 0 to acknowledge never being reached.
	util.log(label + ':', _counts[label] || 0)

	// Reset count.
	delete _counts[label]
}

/**
 * Prints (and resets the values of) all invocation counts (identified by different labels) recorded by `counter.count()`. Does not print counters that are never reached (having not initialized their keys).
 *
 * Prints counts in order of decreasing value.
 *
 * @static
 * @memberOf counter
 * @example
 *
 * for (var i = 0; i < 100; ++i) {
 *   if (i % 2 === 0) counter.count('even')
 *   if (i % 2 === 1) counter.count('odd')
 *   if (i > 100) counter.count('never reached')
 * }
 *
 * counter.endAll()
 * // => Resets all counts to 0
 * // => Prints "even: 50
 * //            odd: 50"
 */
exports.endAll = function () {
	Object.keys(_counts).sort(function (a, b) {
		// Sort counts by decreasing value.
		return _counts[b] - _counts[a]
	}).forEach(function (label) {
		util.log(label + ':', _counts[label])

		// Reset count.
		delete _counts[label]
	})
}