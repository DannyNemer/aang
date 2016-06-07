var util = require('../util/util')
var g = require('./grammar')
var grammarUtil = require('./grammarUtil')


/**
 * The map of integer symbols to object specifying value ranges.
 *
 * @type {Object.<string, Object[]>}
 */
exports._intSymbols = []

/**
 * The map of integer terminal symbols names to definition lines (file-path + line-number). For use in error messages.
 *
 * @type {Object.<string, string>}
 */
exports._defLines = {}

/**
 * Creates a unique terminal symbol that recognizes integers in input within the specified range.
 *
 * @param {Object} options The options object.
 * @param {number} [options.min=0] The minimum value of integers this symbol can accept.
 * @param {number} [options.max=Number.MAX_SAFE_INTEGER] The maximum value of integers this symbol can accept.
 * @returns {string} Returns the new terminal symbol.
 */
var intSymbolSchema = {
	// The minimum value of integers this symbol can accept.
	min: Number,
	// The maximum value of integers this symbol can accept. Defaults to `Number.MAX_SAFE_INTEGER`.
	max: Number,
}

exports.new = function (options) {
	if (util.illFormedOpts(intSymbolSchema, options) || isIllFormedIntSymbolOptions(options)) {
		throw new Error('Ill-formed integer symbol')
	}

	if (options.min === undefined) {
		options.min = 0
	}

	// If `options.max` is `undefined`, set to `Number.MAX_SAFE_INTEGER`.
	// - `Infinity` is saved as a string when serialized in `JSON.stringify()`.
	if (options.max === undefined) {
		options.max = Number.MAX_SAFE_INTEGER
	}

	var symbol = '<int:' + options.min + '-' + options.max + '>'

	// Check if an integer symbol of the same range already exists.
	if (grammarUtil.isDuplicateName(symbol, exports._defLines, 'integer symbol')) {
		throw new Error('Duplicate integer symbol')
	}

	// Save instantiation file path and line number for error reporting.
	exports._defLines[symbol] = util.getModuleCallerLocation()

	// Save terminal symbol with maximum and minimum properties.
	exports._intSymbols.push({
		name: symbol,
		min: options.min,
		max: options.max,
	})

	return symbol
}

/**
 * Checks if `options`, which was passed to `intSymbol.new()`, is ill-formed. If so, prints an error.
 *
 * @private
 * @static
 * @param {Object} options The `intSymbol.new()` options object to inspect.
 * @returns {boolean} Returns `true` if `options` is ill-formed, else `false`.
 */
function isIllFormedIntSymbolOptions(options) {
	// For now, prevent negative integer lower bounds. Enables `matchTerminalRules` to use the absolute value of negative input integers, which would otherwise prevent any matches because negative integers are unlikely to be within any accepted ranges.
	if (options.min < 0) {
		util.logErrorAndPath('Integer `min` bound less than 0:', options)
		return true
	}

	if (options.max < options.min) {
		util.logErrorAndPath('Integer `max` bound less than its `min` bound:', options)
		return true
	}

	return false
}

/**
 * Sorts integer symbols by increasing minimum value and then by increasing maximum value.
 *
 * `sortGrammar()` in `grammar` invokes this method at the end of grammar generation.
 *
 * @static
 */
exports.sortIntSymbols = function () {
	exports._intSymbols.sort(function (intA, intB) {
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