var util = require('../util/util')
var g = require('./grammar')


// The integer symbols with specified value ranges, stored as `{ name: String, min: Number, max: Number}`.
exports.intSymbols = []
// The map of integer terminal symbols to creation-lines (file-path + line-number); used for error reporting.
exports._creationLines = {}

/**
 * Creates a unique terminal symbol that recognizes integers in input within the specified range.
 *
 * @param {Object} options The options object.
 * @param {number} options.min The minimum value of integers this symbol can accept.
 * @param {number} [options.max=Number.MAX_SAFE_INTEGER] The maximum value of integers this symbol can accept.
 * @returns {string} Returns the new terminal symbol.
 */
var intSymbolSchema = {
	// The minimum value of integers this symbol can accept.
	min: { type: Number, required: true },
	// The maximum value of integers this symbol can accept. Defaults to `Number.MAX_SAFE_INTEGER`.
	max: Number,
}

exports.new = function (options) {
	if (util.illFormedOpts(intSymbolSchema, options)) {
		throw new Error('Ill-formed int symbol')
	}

	// If defined, `options.max` value must be greater than `options.min`.
	if (options.min >= options.max) {
		util.logErrorAndPath('Integer `max` value must be greater than its `min` value:', options)
		throw new Error('Ill-formed integer symbol')
	}

	// If `options.max` is `undefined`, set to `Number.MAX_SAFE_INTEGER`.
	// - `Infinity` is saved as a string when serialized in `JSON.stringify()`.
	if (options.max === undefined) {
		options.max = Number.MAX_SAFE_INTEGER
	}

	var symbol = '<int:' + options.min + '-' + options.max + '>'

	// Check if integer symbol of the same range already exists.
	for (var i = 0, intSymbolsLen = exports.intSymbols.length; i < intSymbolsLen; ++i) {
		if (exports.intSymbols[i].name === symbol) {
			util.logError('Duplicate integer symbol:', symbol)
			util.logPathAndObject(options)
			throw new Error('Duplicate integer symbol')
		}
	}

	// Save instantiation file path and line number for error reporting.
	exports._creationLines[symbol] = util.getModuleCallerPathAndLineNumber()

	// Save terminal symbol with maximum and minimum properties.
	exports.intSymbols.push({
		name: symbol,
		min: options.min,
		max: options.max,
	})

	return symbol
}

/**
 * Sorts integer symbols by increasing minimum value and then by increasing maximum value.
 *
 * `grammar.sortGrammar()` invokes this method at the end of grammar generation.
 *
 * @static
 */
exports.sortIntSymbols = function () {
	exports.intSymbols.sort(function (intA, intB) {
		// Sort `intA` before `intB`.
		if (intA.min < intB.min) return -1

		// Sort `intA` after `intB`.
		if (intA.min > intB.min) return 1

		// Sort `intA` before `intB`.
		if (intA.max < intB.max) return -1

		// Sort `intA` after `intB`.
		if (intA.max > intB.max) return 1

		throw new Error('Integer symbols with identical ranges')
	})
}