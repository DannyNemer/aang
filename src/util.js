// Project-agnostic utility functions

var fs = require('fs')
var colors = require('colors/safe')


// Checks if an opts Object matches a schema
// Used for simulating static functions arguments (type checking and parameter count)

// Example opts schema:
// {
// 	cost: Number,                            Must be of type Number
// 	RHS: { type: Array },                    Must be of type Array (identical to previous parameter)
// 	RHS: { type: Array, arrayType: String }, Must be Array containing only String
// 	name: { type: String optional: true },   Parameter can me omitted
// 	personNumber: [ '1', 'pl', '3sg' ]       Must be one of pre-defined values
// }
exports.illFormedOpts = function (schema, opts) {
	// Check if missing a required opts parameter
	var schemaProps = Object.keys(schema)
	for (var i = 0, schemaPropsLen = schemaProps.length; i < schemaPropsLen; ++i) {
		var prop = schemaProps[i]
		var val = schema[prop]

		if (!val.optional && !opts.hasOwnProperty(prop)) {
			return exports.printErrWithLine('Missing \'' + prop + '\' property')
		}
	}

	var optsProps = Object.keys(opts)
	for (var i = 0, optsPropsLen = optsProps.length; i < optsPropsLen; ++i) {
		var prop = optsProps[i]

		// Unrecognized property
		if (!schema.hasOwnProperty(prop)) {
			return exports.printErrWithLine('Unrecognized property', prop)
		}

		var optsVal = opts[prop]
		var schemaVal = schema[prop]
		var schemaPropType = schemaVal.type || schemaVal

		// Accidentally passed an undefined object; ex: undefined, [], [ 1, undefined ]
		if (optsVal === undefined || (Array.isArray(optsVal) && (optsVal.length === 0 || optsVal.indexOf(undefined) !== -1))) {
			return exports.printErrWithLine('undefined ' + prop, optsVal)
		}

		// Schema contains an Array of pre-defined accepted values
		if (Array.isArray(schemaPropType)) {
			// Unrecognized value for parameter with pre-defined values
			if (schemaPropType.indexOf(optsVal) === -1) {
				exports.printErr('Unrecognized value for ' + prop, optsVal)
				console.log('     Accepted values for ' + prop + ':', schemaPropType)
				console.log(exports.getLine())
				return true
			}
		} else {
			// Passed value of incorrect type; ex: LHS: String, RHS: Array
			if (optsVal.constructor !== schemaPropType) {
				return exports.printErrWithLine('\'' + prop + '\' not of type ' + schemaPropType.name, optsVal)
			}

			// Passed Array contains elements not of arrayType (if arrayType is defined)
			if (Array.isArray(optsVal) && schemaVal.arrayType && !optsVal.every(function (el) { return el.constructor === schemaVal.arrayType })) {
				return exports.printErrWithLine('\'' + prop + '\' not an array of type ' + schemaVal.arrayType.name, optsVal)
			}
		}
	}
}

// Get line number of first item in stack trace preceding call of this function
// If getCallingLine, return line of where this function was called
exports.getLine = function (getCallingLine) {
	var stack = (new Error()).stack.split('\n').slice(2)
	var callingFileName = null

	for (var i = 0, stackLength = stack.length; i < stackLength; ++i) {
		var line = stack[i]

		// 'line' must contain a file path
		if (!/\//.test(line)) continue

		// Ignore if getLine() called from this file
		if (line.indexOf(__filename) !== -1) continue

		// Remove parenthesis surrounding paths in trace for iTerm
		if (getCallingLine || (callingFileName && line.indexOf(callingFileName) === -1)) {
			return line.replace(/[()]/g, '').slice(line.lastIndexOf(' ') + 1)
		}

		// Name of file from which getLine() was called (i.e., grammar.js)
		else {
			callingFileName = line.slice(line.indexOf('/') + 1, line.indexOf(':'))
		}
	}

	// Could not find line in stack for file from which funciton calling getLine() was called
	// exports.printErr('Sought-after line not found in stack trace (trace limited to 10 most recent)')
	// exports.logTrace()
}

// Returns true if arrays a and b are of the same length and same shallow-level contents
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

// Print arguments on separate lines, and pretty-print objects
exports.log = function () {
	Array.prototype.slice.call(arguments).forEach(function (arg) {
		// Print strings normally to avoid unnecessary stylization
		if (arg.constructor === String) {
			console.log(arg)
		} else {
			console.dir(arg, { depth: null, colors: true })
		}
	})

	console.log() // Print trailing blank line
}

// Print calling line and optional 'msg' to mark reaching its section
exports.assert = function (msg) {
	console.log(colors.red((msg || 'Reached') + ':'), exports.getLine(true))
}

// If value is truthy, call assert()
exports.assertTrue = function (value, msg) {
	if (value) exports.assert(msg)
}

// Count number of instances a section of code is reached, identified by 'key'
// 'key' is optional (e.g., if only need one counter)
var counts = {}
exports.count = function (key) {
	if (counts.hasOwnProperty(key)) {
		counts[key]++
	} else {
		counts[key] = 1
	}
}

// Print count of 'key'
exports.printCount = function (key) {
	var label = (key || 'count') + ':'
	if (counts.hasOwnProperty(key)) {
		console.log(label, counts[key])
		delete counts[key] // Reset count
	} else {
		console.log(label, 0)
	}
}

// Print all counters
// Will not print counters that are never reached (and never have their keys initialized)
exports.printCounts = function () {
	for (var key in counts) {
		console.log((key || 'count') + ':', counts[key])
		delete counts[key] // Reset count
	}
}

// Print like console.log(), but color first argument red, prepend 'Err:', and append ':'
exports.printErr = function () {
	var firstArg = 'Err: ' + arguments[0]
	if (arguments[1] !== undefined && firstArg[firstArg.length - 1] !== ':') {
		firstArg += ':'
	}
	arguments[0] = colors.red(firstArg)
	console.log.apply(null, arguments)
}

exports.printWarn = function () {
	var firstArg = 'Warn: ' + arguments[0]
	if (arguments[1] !== undefined && firstArg[firstArg.length - 1] !== ':') {
		firstArg += ':'
	}
	arguments[0] = colors.yellow(firstArg)
	console.log.apply(null, arguments)
}

// Prints error message (concatenation of arguments) and line from which the parent function was called
exports.printErrWithLine = function () {
	exports.printErr.apply(null, arguments)
	console.log(exports.getLine())

	return true
}

// Print stack track to current position
// Remove parentheses from error stack for iTerm open-file shortcut
exports.logTrace = function (msg) {
	if (msg) {
		console.log('Trace:', msg)
	} else {
		console.log('Trace')
	}

	// Remove lines for 'Error' and current file
	var stack = (new Error()).stack.split('\n').slice(2)

	stack.forEach(function (stackLine) {
		console.log(stackLine.replace(/[()]/g, ''))
	})
}

// Write obj to JSON file at path
exports.writeJSONFile = function (path, obj) {
	fs.writeFileSync(path, JSON.stringify(obj, function (key, val) {
		// Convert RegExp to strings for JSON.stringify()
		return val instanceof RegExp ? val.source : val
	}, '\t'))

	console.log('File saved:', fs.realpathSync(path))
}

// Execute the passed function within a try-catch statement
// Remove parentheses from error stack for iTerm open-file shortcut
exports.tryCatchWrapper = function (callback) {
	try {
		return callback()
	} catch (e) {
		console.log()

		if (e.stack) {
			e.stack.split('\n').forEach(function (stackLine) {
				console.log(stackLine.replace(/[()]/g, ''))
			})
		} else {
			console.log(e)
		}
	}
}

// Delete modules (passed as paths) from cache
exports.deleteCache = function () {
	Array.prototype.slice.call(arguments).forEach(function (path) {
		delete require.cache[fs.realpathSync(path)]
	})
}