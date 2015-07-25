/*!
 * danny-util.js v0.0.1
 * Copyright (C) 2015 Danny Nemer
 * Available under MIT license <http://mths.be/mit>
 */

var fs = require('fs')
var colors = require('colors/safe')

/**
 * Project-agnostic utility functions for Node.js.
 * @module
 * @typicalname dannyUtil
 * @example
 * var dannyUtil = require('./danny-util/danny-util.js')
 */


/**
 * Check if an `opts` object matches a `schema`.
 * Simulates static function arguments (i.e., type checking and parameter count).
 * Prints descriptive, helpful errors when `opts` is ill-formed.
 *
 * @param  {Object} schema  Definition of required or optional properties and their expected values in `opts`.
 * @param  {Object} opts  The options object to check if conforms to `schema`.
 * @return {Boolean}  Whether `opts` is ill-formed.
 * @example
 * // Example `schema`:
 * {
 *   num: Number,                                  // Must be of type `Number`
 *   list: { type: Array },                        // Must be of type `Array` (identical to previous parameter)
 *   strings: { type: Array, arrayType: String },  // Must be `Array` containing only String
 *   str: { type: String, optional: true },        // Parameter can be omitted
 *   val: [ 'red', 'yellow', 'blue' ]              // Must be one of predefined values
 * }
 */
exports.illFormedOpts = function (schema, opts) {
	// Check if missing an opts parameter required by schema
	for (var prop in schema) {
		var val = schema[prop]

		if (!val.optional && !opts.hasOwnProperty(prop)) {
			return exports.printErrWithLine('Missing \'' + prop + '\' property')
		}
	}

	// Check if passed parameters conform to schema
	for (var prop in opts) {
		// Unrecognized property
		if (!schema.hasOwnProperty(prop)) {
			return exports.printErrWithLine('Unrecognized property', prop)
		}

		var optsVal = opts[prop]
		var schemaVal = schema[prop]
		var schemaPropType = schemaVal.type || schemaVal

		// Accidentally passed an `undefined` object; ex: `undefined`, `[]`, `[ 1, undefined ]`
		if (optsVal === undefined || (Array.isArray(optsVal) && (optsVal.length === 0 || optsVal.indexOf(undefined) !== -1))) {
			return exports.printErrWithLine('undefined ' + prop, optsVal)
		}

		// Schema contains an `Array` of predefined accepted values
		if (Array.isArray(schemaPropType)) {
			// Unrecognized value for parameter with predefined values
			if (schemaPropType.indexOf(optsVal) === -1) {
				exports.printErr('Unrecognized value for ' + prop, optsVal)
				console.log('     Accepted values for ' + prop + ':', schemaPropType)
				console.log(exports.getLine())
				return true
			}
		} else {
			// Passed value of incorrect type; ex: `num: String`, `str: Array`
			if (optsVal.constructor !== schemaPropType) {
				return exports.printErrWithLine('\'' + prop + '\' not of type ' + schemaPropType.name, optsVal)
			}

			// Passed Array contains elements not of `arrayType` (if `arrayType` is defined)
			if (Array.isArray(optsVal) && schemaVal.arrayType && !optsVal.every(function (el) { return el.constructor === schemaVal.arrayType })) {
				return exports.printErrWithLine('\'' + prop + '\' not an array of type ' + schemaVal.arrayType.name, optsVal)
			}
		}
	}

	// No errors
	return false
}

/**
 * Get file path and line number of the first item in the stack of the parent module from where this function was called.
 *
 * @param  {Boolean} getCallingLine  If true, return line of where this function was called (i.e., not parent module).
 * @return {String}  File path and line number of calling line.
 */
exports.getLine = function (getCallingLine) {
	var stack = Error().stack.split('\n').slice(2)
	var callingFileName

	for (var i = 0, stackLength = stack.length; i < stackLength; ++i) {
		var line = stack[i]

		// `line` must contain a file path
		if (!/\//.test(line)) continue

		// Ignore if `getLine()` called from this file
		if (line.indexOf(__filename) !== -1) continue

		// Remove parenthesis surrounding paths in trace for iTerm open-file-path shortcut
		if (getCallingLine || (callingFileName && line.indexOf(callingFileName) === -1)) {
			return line.replace(/[()]/g, '').slice(line.lastIndexOf(' ') + 1)
		}

		// Name of file from which `getLine()` was called
		callingFileName = line.slice(line.indexOf('/') + 1, line.indexOf(':'))
	}

	// Could not find line in stack for file from which function calling `getLine()` was called
	// exports.printErr('Sought-after line not found in stack trace (trace limited to 10 most recent)')
	// exports.logTrace()
}

/**
 * Compare shallow-level elements in a pair of arrays.
 *
 * @param  {Array} a  Array to compare.
 * @param  {Array} b  Array to compare.
 * @return {Boolean}  Whether arrays contain identical contents.
 */
exports.arraysMatch = function (a, b) {
	// Identical arrays (or, both undefined)
	if (a === b) return true

	// One of two is undefined
	if (!a || !b) return false

	var i = a.length

	// Different lengths
	if (i !== b.length) return false

	while (i--) {
		if (a[i] !== b[i]) return false
	}

	return true
}

/**
 * Print-print objects (on separate lines).
 *
 * @param {...Mixed} [valN]  Values to print.
 */
exports.log = function () {
	Array.prototype.slice.call(arguments).forEach(function (arg) {
		// Print strings normally to avoid unnecessary styling
		// - Use `typeof` to account for `undefined`
		if (typeof arg === 'string') {
			console.log(arg)
		} else {
			console.dir(arg, { depth: null, colors: true })
		}
	})

	// Print trailing blank line
	console.log()
}

/**
 * Print calling file path and line number to mark reaching a section of code, prepended by `msg`.
 *
 * @param {String} [msg]  Optional message to prepend line.
 */
exports.assert = function (msg) {
	console.log(colors.red((msg || 'Reached') + ':'), exports.getLine(true))
}

/**
 * Print calling file path and line number if `value` is truthy, prepended by `msg`.
 *
 * @param {Boolean} value  Value to check if truthy.
 * @param {String} [msg]  Optional message to prepend line.
 */
exports.assertTrue = function (value, msg) {
	if (value) exports.assert(msg)
}

/**
 * Key-value map used by `count()`.
 *
 * @type {Object}
 * @private
 */
var counts = {}

/**
 * Count number of times a section of code is reached, identified by `key`.
 * Use `printCount(key)` to print value.
 *
 * @param {String} key  Id to refer to a section of code.
 */
exports.count = function (key) {
	if (counts.hasOwnProperty(key)) {
		counts[key]++
	} else {
		counts[key] = 1
	}
}

/**
 * Print number of calls of `count()` with `key`.
 * Reset the count of calls to `key` when called.
 *
 * @param {String} key  Id to refer to calls to `count()`.
 */
exports.printCount = function (key) {
	var label = (key || 'count') + ':'
	if (counts.hasOwnProperty(key)) {
		console.log(label, counts[key])

		// Reset count
		delete counts[key]
	} else {
		console.log(label, 0)
	}
}

/**
 * Print values of all counters used on `count()`.
 * Will not print counters that are never reached (and never have their keys initialized).
 * Reset all counts.
 */
exports.printCounts = function () {
	for (var key in counts) {
		console.log((key === undefined ? 'count' : key) + ':', counts[key])
	}

	// Reset all counts
	counts = {}
}

/**
 * Print like `console.log()`, but color first argument red, prepend message with "Err:".
 *
 * @param {String} [msg]  Error message to color red and append to "Err:".
 * @param {...Mixed} [valN]  Values to print following error message.
 */
exports.printErr = function (msg) {
	logPrependColorMsg('red', 'Err', msg, Array.prototype.slice.call(arguments, 1))
}

/**
 * Print like `console.log()`, but color first argument yellow, prepend with 'Warning:'.
 *
 * @param {String} [msg]  Warning message to color yellow and append to 'Warning:'.
 * @param {...Mixed} [valN]  Values to print following warning message.
 */
exports.printWarning = function (msg) {
	logPrependColorMsg('yellow', 'Warning', msg, Array.prototype.slice.call(arguments, 1))
}

/**
 * Print like `console.log()`, but color first argument and prepend with a label (e.g., "Err:"").
 *
 * @private
 * @param {String} color  Color to stylize `label`.
 * @param {String} label  A label to prepend the values to print (e.g., "Err").
 * @param {String} [msg]  Message to color and append to `label`.
 * @param {Array} [args]  Values to print following `msg`.
 */
function logPrependColorMsg(color, label, msg, args) {
	// Append ':' to `label`
	if (label[label.length - 1] !== ':') {
		label += ':'
	}

	if (msg) {
		// Append ':' to `msg`
		if (msg[msg.length - 1] !== ':') {
			msg += ':'
		}

		label += ' ' + msg
	}

	// Color label + message, print and append with remaining arguments
	console.log.apply(null, [ colors[color](label) ].concat(args))
}

/**
 * Print error message like `printErr()` and line from which the parent function was called (using `getLine()`).
 *
 * @param {String} [msg]  Error message to color red and append to 'Err:'.
 * @param {...Mixed} [valN]  Values to print following error message.
 */
exports.printErrWithLine = function () {
	exports.printErr.apply(null, arguments)
	console.log(exports.getLine())

	return true
}

/**
 * Print stack trace to the current position.
 * Remove parentheses from stack for iTerm open-file-path shortcut.
 *
 * @param {String} [msg]  Optional message to print above stack.
 */
exports.logTrace = function (msg) {
	console.log('Trace' + (msg ? ': ' + msg : ''))

	// Remove lines for `Error` and current file
	var stack = Error().stack.split('\n').slice(2)

	stack.forEach(function (stackLine) {
		console.log(stackLine.replace(/[()]/g, ''))
	})
}

/**
 * Write an object to a JSON file.
 *
 * @param {String} path  Path to write file.
 * @param {Object} obj  Object to save to file.
 */
exports.writeJSONFile = function (path, obj) {
	fs.writeFileSync(path, JSON.stringify(obj, function (key, val) {
		// Convert RegExp to strings for `JSON.stringify()`
		return val instanceof RegExp ? val.source : val
	}, '\t'))

	console.log('File saved:', fs.realpathSync(path))
}

/**
 * Execute the passed function within a `try` block.
 * Remove parentheses from error stack for iTerm open-file-path shortcut.
 *
 * @param {Function} callback  Function to execute within `try` block.
 * @return {Mixed}  Value returned by `callback`.
 */
exports.tryCatchWrapper = function (callback) {
	try {
		return callback()
	} catch (e) {
		console.log()

		if (e.stack) {
			e.stack.split('\n').forEach(function (stackLine) {
				// Only remove parentheses from the stack, avoiding lines in `Error.message`
				console.log(/^\s/.test(stackLine) ? stackLine.replace(/[()]/g, '') : stackLine)
			})
		} else {
			console.log(e)
		}
	}
}

/**
 * Delete modules from cache, forcing them to be reloaded at next `require()` call.
 * Useful for debugging code on a server without restarting the server.
 *
 * @param {...String} pathN  Paths of modules to remove from cache.
 */
exports.deleteModuleCache = function () {
	Array.prototype.slice.call(arguments).forEach(function (path) {
		delete require.cache[fs.realpathSync(path)]
	})
}