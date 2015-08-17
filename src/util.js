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
 * Checks if an `opts` object adheres to a `schema`.
 * Simulates static function arguments (i.e., type checking and parameter count).
 * Prints descriptive, helpful errors when `opts` is ill-formed.
 *
 * @param {Object} schema Definition of required or optional properties and their expected values in `opts`.
 * @param {Object} opts The options object to check if conforms to `schema`.
 * @return {Boolean} `true` if `opts` is ill-formed, else `false`.
 * @example
 * var schema = {
 *   num: Number,                                  // Must be of type `Number`
 *   list: { type: Array },                        // Must be of type `Array` (identical to previous parameter)
 *   strings: { type: Array, arrayType: String },  // Must be `Array` containing only String
 *   str: { type: String, optional: true },        // Parameter can be omitted
 *   val: [ 'red', 'yellow', 'blue' ]              // Must be one of predefined values
 * }
 *
 * function myFunc(opts) {
 *   if (dannyUtil.illFormedOpts(schema, opts)) {
 *     // Descriptive, helpful errors are printed to console
 *     // Handle ill-formed `opts` how you choose
 *     throw new Error('ill-formed opts')
 *   }
 *
 *   // ...stuff...
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
 * Gets the file path and line number of the first item in the stack of the parent module from where this function was called.
 *
 * @param {Boolean} getCallingLine If `true`, return line of where this function was called, else the line of the parent module.
 * @return {String} The file path and line number of calling line.
 */
exports.getLine = function (getCallingLine) {
	// Get stack sans lines for `Error` and this file
	var stack = Error().stack.split('\n').slice(3)
	var callingFileName

	for (var i = 0, stackLength = stack.length; i < stackLength; ++i) {
		var line = stack[i]

		// `line` must contain a file path
		if (!/\//.test(line)) continue

		// Ignore if `getLine()` called from this file
		if (line.indexOf(__filename) !== -1) continue

		// Remove parentheses surrounding paths in trace for iTerm open-file-path shortcut
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
 * Performs a shallow comparison between two arrays to determine if they are equivalent.
 *
 * @param {Array} a The array to compare.
 * @param {Array} b The other array to compare.
 * @return {Boolean} `true` if the arrays are equivalent, else `false`.
 */
exports.arraysEqual = function (a, b) {
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
 * @param {...Mixed} [valN] The values to print.
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
/**
 * Prints calling file path and line number to mark reaching a section of code, prepended by `msg`.
 *
 * @param {String} [msg] The optional message to prepend line.
 */
exports.assert = function (msg) {
	console.log(colors.red((msg || 'Reached') + ':'), exports.getLine(true))
}

/**
 * Prints calling file path and line number if `value` is truthy, prepended by `msg`.
 *
 * @param {Boolean} value The value to check if truthy.
 * @param {String} [msg] The optional message to prepend line.
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
 * Counts the number of times a section of code is reached, identified by `key`.
 * Use `printCount(key)` to print value.
 *
 * @param {String} key The id to refer to a section of code.
 */
exports.count = function (key) {
	if (counts.hasOwnProperty(key)) {
		counts[key]++
	} else {
		counts[key] = 1
	}
}

/**
 * Prints the number of calls of `count()` with `key`.
 * Resets the count of calls to `key` when called.
 *
 * @param {String} key The id to refer to calls to `count()`.
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
 * Prints the values of all counters used on `count()`.
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
 * Prints like `console.log()`, but color first argument red, prepend message with "Err:".
 *
 * @param {String} [msg] THe error message to color red and append to "Err:".
 * @param {...Mixed} [valN] The values to print following error message.
 */
exports.printErr = function (msg) {
	logPrependColorMsg('red', 'Err', msg, Array.prototype.slice.call(arguments, 1))
}

/**
 * Prints like `console.log()`, but color first argument yellow, prepend with "Warning:".
 *
 * @param {String} [msg] The warning message to color yellow and append to "Warning:".
 * @param {...Mixed} [valN] The values to print following warning message.
 */
exports.printWarning = function (msg) {
	logPrependColorMsg('yellow', 'Warning', msg, Array.prototype.slice.call(arguments, 1))
}

/**
 * Prints like `console.log()`, but color first argument and prepend with a label (e.g., "Err:").
 *
 * @private
 * @param {String} color The color to stylize `label`.
 * @param {String} label The label to prepend the values to print (e.g., "Err").
 * @param {String} [msg] The message to color and append to `label`.
 * @param {Array} [args] The values to print following `msg`.
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
 * Prints error message like `printErr()` and line from which the parent function was called (using `getLine()`).
 *
 * @param {String} [msg] The error message to color red and append to "Err:".
 * @param {...Mixed} [valN] The values to print following error message.
 */
exports.printErrWithLine = function () {
	exports.printErr.apply(null, arguments)
	console.log(exports.getLine())

	return true
}

/**
 * Prints stack trace to the current position.
 * Removes parentheses from stack for iTerm open-file-path shortcut.
 *
 * @param {String} [msg] The optional message to print above stack.
 */
exports.logTrace = function (msg) {
	console.log('Trace' + (msg ? ': ' + msg : ''))

	// Get stack sans lines for `Error` and this file
	var stack = Error().stack.split('\n').slice(3)

	// Remove parentheses
	stack = stack.join('\n').replace(/[()]/gm, '')

	console.log(stack)
}

/**
 * Writes an object to a JSON file.
 *
 * @param {String} path The path to write file.
 * @param {Object} obj The object to save to file.
 */
exports.writeJSONFile = function (path, obj) {
	fs.writeFileSync(path, JSON.stringify(obj, function (key, val) {
		// Convert RegExp to strings for `JSON.stringify()`
		return val instanceof RegExp ? val.source : val
	}, '\t'))

	console.log('File saved:', fs.realpathSync(path))
}

/**
 * Executes the passed function within a `try` block.
 * Removes parentheses from error stack for iTerm open-file-path shortcut.
 *
 * @param {Function} callback The function to execute within `try` block.
 * @return {Mixed} The value returned by `callback`.
 */
exports.tryCatchWrapper = function (callback) {
	try {
		return callback()
	} catch (e) {
		console.log()

		if (e.stack) {
			e.stack.split('\n').forEach(function (stackLine) {
				// Only remove parentheses from the stack, avoiding lines in `Error.message`
				console.log(/^\s+at/.test(stackLine) ? stackLine.replace(/[()]/g, '') : stackLine)
			})
		} else {
			console.log(e)
		}
	}
}

/**
 * Deletes modules from cache, forcing them to be reloaded at next `require()` call.
 * Useful for debugging code on a server without restarting the server.
 *
 * @param {...String} pathN The paths of modules to remove from cache.
 */
exports.deleteModuleCache = function () {
	Array.prototype.slice.call(arguments).forEach(function (path) {
		delete require.cache[fs.realpathSync(path)]
	})
}