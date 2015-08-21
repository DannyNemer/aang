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
 *     // Prints descriptive, helpful error messages
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
 * Gets the file path and line number of the first item in the stack of the parent module from where this function was called. This is useful for logging where an object is instantiated.
 *
 * @param {Boolean} getCallingLine If `true`, return line of where this function was called, else the line of the parent module.
 * @return {String} The file path and line number of calling line.
 */
exports.getLine = function (getCallingLine) {
	// Get stack without lines for `Error` and this file
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
 * @example
 * dannyUtil.arraysEqual([], []) // -> true
 *
 * dannyUtil.arraysEqual([1, 2, 3, 'danny'], [1, 2, 3, 'danny']) // -> true
 *
 * dannyUtil.arraysEqual([ false, true ], [ true ]) // -> false
 *
 * // A shallow comparison will not compare object properties
 * var objA = { prop: 'val' }
 * var objB = { prop: 'val' }
 * dannyUtil.arraysEqual([ 1, 2, objA ], [ 1, 2, objB ]) // -> false
 *
 * // Rather, objects are only equal if they are the same instance
 * dannyUtil.arraysEqual([ objA, objB ], [ objA, objB ]) // -> true
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
 * Prints objects in color (on separate lines), recursing 2 times while formatting the object (which is identical to `console.log()`).
 *
 * @param {...Mixed} [valN] The values to print.
 */
exports.log = function () {
	prettyPrint(arguments, { colors: true })
}

/**
 * Prints objects in color (on separate lines), recursing indefinitely while formatting the object. This is useful for inspecting large, complicated objects.
 *
 * @param {...Mixed} [valN] The values to print.
 */
exports.dir = function () {
	prettyPrint(arguments, { depth: null, colors: true })

	// Print trailing blank line
	console.log()
}

/**
 * Prints objects according to the formattings options of `opts` (as defined for `console.dir()`) on seperate lines.
 *
 * @private
 * @param {Object} args The `arguments` object (passed to the callee) with the values to print.
 * @param {Object} opts The options object (as defined for `console.dir()`).
 */
function prettyPrint(args, opts) {
	Array.prototype.slice.call(args).forEach(function (arg) {
		// Print strings passed as arguments (i.e., not Object properties) without styling
		if (typeof arg === 'string') {
			console.log(arg)
		} else {
			console.dir(arg, opts)
		}
	})
}

 /**
	* Key-value map used by `time()`.
	*
	* @private
	* @type Map
	*/
var _times = new Map()

/**
 * Starts a high-resolution timer (with precision in nanoseconds) identified by `label`. Use `dannyUtil.timeEnd(label)` to print the timer's current value.
 *
 * @param {String} label The identifier of the timer.
 * @example
 * // Start timer
 * dannyUtil.time('my test')
 *
 * // ...stuff...
 *
 * // Prints "my test: 23.264491ms"
 * dannyUtil.timeEnd('my test')
 *
 * // ...more stuff...
 *
 * // Prints "my test: 36.183837ms"
 * dannyUtil.timeEnd('my test')
 */
exports.time = function (label) {
	_times.set(label, process.hrtime())
}

/**
 * Prints the current high-resolution value of a timer initiated with `dannyUtil.time(label)`.
 *
 * @param {String} label The identifier of the timer.
 */
exports.timeEnd = function (label) {
	var time = _times.get(label)

	if (!time) {
		throw new Error('No such label:', label)
	}

	var duration = process.hrtime(time)
	console.log('%s: %dms', label, duration[0] * 1e3 + duration[1] / 1e6)
}

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
 * Key-value map used by `dannyUtil.count()`.
 *
 * @private
 * @type Map
 */
var _counts = new Map()

/**
 * Counts the number of times a section of code is reached, identified by `label`. Use `dannyUtil.countEnd(label)` to print value. This is useful for profiling complex programs.
 *
 * @param {String} label The id to refer to a section of code.
 */
exports.count = function (label) {
	var val = _counts.get(label) || 0
	_counts.set(label, val + 1)
}

/**
 * Prints the number of calls of `dannyUtil.count(label)`.
 * Resets the count of calls to `label` when called.
 *
 * @param {String} label The id to refer to calls to `dannyUtil.count()`.
 */
exports.countEnd = function (label) {
	// Print even if no value to acknowledge never being reached
	var count = _counts.get(label) || 0
	console.log('%s: %d', label === undefined ? 'count' : label, count)

	// Reset count
	_counts.delete(label)
}

/**
 * Prints the values of all counters used on `dannyUtil.count()`.
 * Will not print counters that are never reached (and never have their keys initialized).
 * Reset all counts.
 */
exports.countEndAll = function () {
	_counts.forEach(function(count, label) {
		console.log(label + ':', count)
	})

	// Reset all counts
	_counts.clear()
}

/**
 * Prints like `console.log()`, but color first argument red, prepend message with "Err:".
 *
 * @param {String} [msg] The error message to color red and append to "Err:".
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

	// Get stack without lines for `Error` and this file
	var stack = Error().stack.split('\n').slice(3).join('\n')

	// Remove parentheses of file paths for iTerm open-file-path shortcut
	console.log(stack.replace(/[()]/gm, ''))
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
 * Colors error type name red (e.g., 'ReferenceError').
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
			// Error message without source code (if present)
			var message = e.message.split('\n').pop()

			e.stack.split('\n').forEach(function (stackFrame) {
				if (e.message.indexOf(stackFrame) !== -1) {
					console.log(stackFrame)
				} else if (stackFrame.indexOf(message) !== -1) {
					// Color error type name red
					console.log(stackFrame.replace(e.name, colors.red(e.name)))
				} else {
					// Remove parentheses of file paths for iTerm open-file-path shortcut
					console.log(stackFrame.replace(/[()]/g, ''))
				}
			})
		} else {
			console.log(e)
		}
	}
}

/**
 * Deletes modules from cache, forcing them to be reloaded at next `require()` call. Without removing a module from cache, subsequent `require()` calls to the same module will not enable changes to its file(s).
 * This is useful for enabling changes on a server without restarting the server.
 *
 * @param {...String} pathN The paths of modules to remove from cache.
 * @example
 * // Load module
 * var myModule = require('./myModule.js')
 *
 * // Remove module from cache
 * dannyUtil.deleteModuleCache('./myModule.js')
 *
 * // Load module again, enabling changes to './myModule.js'
 * myModule = require('./myModule.js')
 */
exports.deleteModuleCache = function () {
	Array.prototype.slice.call(arguments).forEach(function (path) {
		delete require.cache[fs.realpathSync(path)]
	})
}

/**
 * Removes extraneous digits from numbers resulting from operations limited by JavaScript's floating point number precision, such as `0.1 * 0.2` (which does not equal `0.02`). This limitation results from being unable to map `0.1` to a finite binary floating point number.
 *
 * @param {Number} number The number to trim.
 * @return {Number} The number trimmed.
 * @example
 * var number = 0.1 * 0.2 // -> 0.020000000000000004
 * number = dannyUtil.cleanFloat(number) // -> 0.02
 */
exports.cleanNumber = function (number) {
	// JavaScript's floating point number precision 13 digits after the decimal point
	return Number(number.toFixed(13))
}

/**
 * Converts a dash-separated string to camelCase.
 *
 * @param {String} dashedString The dash-separated string to convert.
 * @return {String} The input string in camelCase.
 * @example
 * dannyUtil.camelCase('my-long-variable-name') // -> 'myLongVariableName'
 */
exports.dashedToCamelCase = function (dashedString) {
	return dashedString.replace(/-(\w)/g, function (match, group1) {
		return group1.toUpperCase()
	})
}