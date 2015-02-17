// Project-agnostic utility functions

var fs = require('fs')

/*
Checks if an object 'passedOpts' matches the definition 'optsDef' of accepted Object properties and types
Used for debugging and simulating type checking

Example optsDef:
	{
		LHS: String,
		RHS: Array,
		ignoreCheck: Boolean,
		personNumber: [ '1', 'pl', '3sg' ]
	}
*/
exports.illFormedOpts = function (passedOpts, optsDef) {
	var passedOptsProps = Object.keys(passedOpts)

	for (var i = 0, passedOptsPropsLen = passedOptsProps.length; i < passedOptsPropsLen; ++i) {
		var prop = passedOptsProps[i]
		var passedVal = passedOpts[prop]
		var propDef = optsDef[prop]

		// Unrecognized property
		if (!optsDef.hasOwnProperty(prop)) {
			console.log('unrecognized prop name:', prop)
			break
		}

		// ex: undefined, [], [ 1, undefined ] - accidentally passed an undefined object
		else if (passedVal === undefined || (Array.isArray(passedVal) && (passedVal.length === 0 || passedVal.indexOf(undefined) !== -1))) {
			console.log('undefined ' + prop + ':', prop, '->', passedVal)
			break
		}

		// ex: personNumber: [ '1', 'pl', '3sg' ] - allow RegExp '|' for accepting matches to multiple options
		else if (Array.isArray(propDef) && passedVal.split('|').some(function (v) { return propDef.indexOf(v) === -1 })) {
			console.log('unrecognized prop passedVal:', prop, '->', passedVal)
			break
		}

		// ex: LHS: String
		else if (!Array.isArray(propDef) && !exports.isType(passedVal, propDef)) {
			console.log('\'' + prop + '\' not of type ' + propDef.name + ':', prop, '->', passedVal)
			break
		}
	}

	if (i < passedOptsPropsLen) {
		console.log(passedOpts)
		console.log(exports.getLine())
		return true
	}
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

// Returns true if obj is of type propTypeFunc
exports.isType = function (obj, propTypeFunc) {
	return Object.prototype.toString.call(obj).slice(8, -1) === propTypeFunc.name
}

// Returns true if arrays a and b are of the same length and same shallow-level contents
exports.arraysMatch = function (a, b) {
	var i = a.length

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
	fs.writeFileSync(filepath + '.json', JSON.stringify(obj, function (key, val) {
		// Convert RegExp to strings for JSON.stringify()
		return val instanceof RegExp ? val.source : val
	}, '\t'))
}