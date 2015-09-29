var util = require('../util')
var g = require('./grammar')


// The integer symbols, stored as { name: String, min: Number, max: Number}
exports.intSymbols = []
// A map of integer terminal symbols to creation lines; used for error reporting.
exports.creationLines = {}

/**
 * Creates a unique terminal symbol that recognizes integers in input within the specified range.
 *
 * @param {Object} opts The options object.
 * @param {number} opts.min The minimum value of integers this symbol can accept.
 * @param {number} [opts.max=Number.MAX_SAFE_INTEGER] The maximum value of integers this symbol can accept.
 * @returns {string} The new terminal symbol.
 */

// Schema for integer symbols.
var intSymbolOptsSchema = {
	// The minimum value of integers this symbol can accept.
	min: Number,
	// The maximum value of integers this symbol can accept. Defaults to `Number.MAX_SAFE_INTEGER`.
	max: { type: Number, optional: true },
}

exports.new = function (opts) {
	if (util.illFormedOpts(intSymbolOptsSchema, opts)) {
		throw new Error('Ill-formed int symbol')
	}

	// If defined, `opts.max` value must be greater than `opts.min`.
	if (opts.min >= opts.max) {
		util.logErrorAndPath('Integer `max` value must be greater than its `min` value:', opts)
		throw new Error('Ill-formed integer symbol')
	}

	// If `opts.max` is `undefined`, set to `Number.MAX_SAFE_INTEGER`.
	// - `Infinity` is saved as a string when serialized in `JSON.stringify()`.
	if (opts.max === undefined) {
		opts.max = Number.MAX_SAFE_INTEGER
	}

	var symbol = '<int:' + opts.min + '-' + opts.max + '>'

	// Check if integer symbol of the same range already exists.
	for (var i = 0, intSymbolsLen = exports.intSymbols.length; i < intSymbolsLen; ++i) {
		if (exports.intSymbols[i].name === symbol) {
			util.logError('Duplicate integer symbol:', symbol)
			util.logPathAndObject(opts, true)
			throw new Error('Duplicate integer symbol')
		}
	}

	// Save instantiation file path and line number for error reporting
	exports.creationLines[symbol] = util.getModuleCallerPathAndLineNumber()

	// Save terminal symbol with maximum and minimum properties.
	exports.intSymbols.push({
		name: symbol,
		min: opts.min,
		max: opts.max,
	})

	return symbol
}