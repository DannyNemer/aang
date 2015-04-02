// Project-agnostic utility functions

var fs = require('fs')


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
			return printOptsErr('Err: Missing \'' + prop + '\' property')
		}
	}

	var optsProps = Object.keys(opts)
	for (var i = 0, optsPropsLen = optsProps.length; i < optsPropsLen; ++i) {
		var prop = optsProps[i]
		var optsVal = opts[prop]
		var schemaVal = schema[prop]
		var schemaPropType = schemaVal.type || schemaVal

		// Unrecognized property
		if (!schemaVal) {
			return printOptsErr('Err: Unrecognized prop name:', prop)
		}

		// Accidentally passed an undefined object; ex: undefined, [], [ 1, undefined ]
		if (optsVal === undefined || (Array.isArray(optsVal) && (optsVal.length === 0 || optsVal.indexOf(undefined) !== -1))) {
			return printOptsErr('Err: undefined ' + prop + ':', optsVal)
		}

		// Schema contains an Array of pre-defined accepted values
		if (Array.isArray(schemaPropType)) {
			// Unrecognized value for parameter with pre-defined values
			if (schemaPropType.indexOf(optsVal) === -1) {
				console.log('Err: Unrecognized value for ' + prop + ':', optsVal)
				return printOptsErr('     Accepted values for ' + prop, ':', schemaPropType)
			}
		} else {
			// Passed value of incorrect type; ex: LHS: String, RHS: Array
			if (optsVal.constructor !== schemaPropType) {
				return printOptsErr('Err: \'' + prop + '\' not of type ' + schemaPropType.name + ':', optsVal)
			}

			// Passed Array contains elements not of arrayType (if arrayType is defined)
			if (Array.isArray(optsVal) && schemaVal.arrayType && !optsVal.every(function (el) { return el.constructor === schemaVal.arrayType })) {
				return printOptsErr('Err: \'' + prop + '\' not an Array of type ' + schemaVal.arrayType.name + ':', optsVal)
			}
		}
	}
}

// Prints error message (concatenation of arguments) and line from which the parent function was called
function printOptsErr() {
	console.log.apply(null, Array.prototype.slice.call(arguments))
	console.log(exports.getLine())

	return true
}


// Get line number of first item in stack trace preceding call of this function
exports.getLine = function () {
	var stack = (new Error()).stack.split('\n').slice(2)
	var callingFileName

	for (var i = 0, stackLength = stack.length; i < stackLength; ++i) {
		var line = stack[i]

		// 'line' must contain a file path
		if (!/\//.test(line)) continue

		if (!callingFileName) {
			// Ignore if getLine() called from this file
			if (line.indexOf(__filename) !== -1) continue

			// Name of file from which getLine() was called (i.e., grammar.js)
			callingFileName = line.slice(line.indexOf('/') + 1, line.indexOf(':'))
		} else if (line.indexOf(callingFileName) === -1) {
			// Remove parenthesis surrounding paths in trace for iTerm
			return line.replace(/[()]/g, '').slice(line.lastIndexOf(' ') + 1)
		}
	}

	// Could not find line in stack for file from which funciton calling getLine() was called
	console.log('sought-after line not found in stack trace (trace limited to 10 most recent')
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

// Print all passed arguments on own line, and pretty-print objects
exports.log = function () {
	Array.prototype.slice.call(arguments).forEach(function (arg) {
		// Pretty-print objects
		if (arg instanceof Object) {
			arg = JSON.stringify(arg, function (key, val) {
				// Convert RegExp to strings for JSON.stringify()
				return val instanceof RegExp ? val.source : val
			}, 2)
		}

		// Print other types normally to avoid unnecessary quotations marks from JSON.stringify()
		console.log(arg)
	})

	console.log() // Print trailing blank line
}

// Write obj to JSON file at filepath
exports.writeJSONFile = function (filepath, obj) {
	fs.writeFileSync(filepath, JSON.stringify(obj, function (key, val) {
		// Convert RegExp to strings for JSON.stringify()
		return val instanceof RegExp ? val.source : val
	}, '\t'))

	console.log('File saved:', fs.realpathSync(filepath))
}