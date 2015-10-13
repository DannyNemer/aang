/**
 * @license
 * hrtimer 0.0.1 - A high-resolution timer for Node.js.
 * Copyright 2015 Danny Nemer
 * Available under MIT license <http://opensource.org/licenses/MIT>
 */

var util = require('./util')

/**
 * Used as a key-value map for timers.
 *
 * @private
 * @type Map
 */
var _times = new Map()

/**
 * Starts a high-resolution timer (with precision in microseconds) identified by `label`. Use `hrtimer.end(label)` to print the timer's current value.
 *
 * @static
 * @memberOf hrtimer
 * @param {string} label The timer identifier.
 */
exports.start = function (label) {
	_times.set(label, process.hrtime())
}

/**
 * Prints the current high-resolution value of a timer initiated with `hrtimer.start(label)`.
 *
 * @static
 * @memberOf hrtimer
 * @param {string} label The timer identifier.
 */
exports.end = function (label) {
	var startTime = _times.get(label)

	if (!startTime) {
		throw new Error('No such label: ' + label)
	}

	var durationTuple = process.hrtime(startTime)
	var duration = durationTuple[0] * 1e3 + durationTuple[1] / 1e6

	// Separate the time's numerical value and unit symbol with a space, per SI unit style convention.
	util.log(label + ':', util.colors.yellow(duration.toFixed(3) + ' ms'))
}