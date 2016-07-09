var util = require('../util/util')
var grammarUtil = require('./grammarUtil')


// Instruct `util.getModuleCallerLocation()` to skip the `NSymbol` module when searching the call stack for `NSymbol` instantiation file paths used in error reporting.
util.skipFileInLocationRetrieval()

/**
 * The map of the grammar's nonterminal symbols to rule arrays.
 *
 * @type {Object.<string, Object[]>}
 */
NSymbol._ruleSets = {}

/**
 * The map of `NSymbol` names to definition lines (file-path + line-number). For use in error messages.
 *
 * @type {Object.<string, string>}
 */
NSymbol._defLines = {}

/**
 * Creates a nonterminal symbol and adds it to the grammar.
 *
 * @constructor
 * @param {...string} [nameTokens] The tokens to hyphenate for the new nonterminal symbol name.
 */
function NSymbol() {
	// Check if constructor invoked without `new` keyword.
	if (!(this instanceof NSymbol)) {
		var newNSymbol = Object.create(NSymbol.prototype)
		NSymbol.apply(newNSymbol, arguments)
		return newNSymbol
	}

	// Hyphenate and format provided name tokens for the nonterminal symbol name.
	this.name = '[' + grammarUtil.formatStringForName(grammarUtil.hyphenate.apply(null, arguments)) + ']'

	// Check if `this.name` exists in `NSymbol._defLines` before appending it to `NSymbol._defLines`.
	if (grammarUtil.isDuplicateName(this.name, NSymbol._defLines, 'nonterminal symbol')) {
		throw new Error('Duplicate nonterminal symbol name')
	}

	// Save instantiation file path and line number for error reporting.
	NSymbol._defLines[this.name] = util.getModuleCallerLocation()

	// The array of rules `this.name` produces.
	this.rules = NSymbol._ruleSets[this.name] = []
}

/**
 * The RHS `NSymbol` wrapper parameterization, for use in `nonterminalRuleSchema.rhs` with `NSymbol.prototype.newNonterminalRule()`, to specify properties specific to the wrapped RHS `symbol`.
 *
 * @typedef {Object} RHSSymbolWrapper
 * @property {NSymbol} symbol The RHS nonterminal symbol.
 */
var rhsSymbolWrapperSchema = {
	symbol: { type: [ NSymbol ], required: true },
}

/**
 * Creates a nonterminal rule from `options` and appends it to `this.rules`.
 *
 * Each item in `options.rhs` must be one of the following:
 * 1. An `NSymbol` instance.
 * 2. An object of the form `RHSSymbolWrapper`.
 *
 * `options.rhs` can not contain more than two symbols; i.e., only permits unary and binary nonterminal rules.
 *
 * `options.transpositionCost` requires `options.rhs` be an ordered pair (i.e., binary).
 *
 * @memberOf NSymbol
 * @param {Object} options The options object.
 * @param {(NSymbol|RHSSymbolWrapper)[]} options.rhs The RHS symbols this rule produces, as documented above.
 * @param {number} options.transpositionCost Specify `createEditRules` can create a transposition rule with this cost penalty that recognizes the reverse order of the ordered pair `options.rhs` in input and corrects their order when parsing (i.e., swaps the order of the display text the two RHS symbols produce).
 * @returns {NSymbol} Returns this `NSymbol` instance.
 */
var nonterminalRuleSchema = {
	rhs: { type: Array, arrayType: [ NSymbol, Object ], required: true },
	transpositionCost: Number,
}

NSymbol.prototype.addNonterminalRule = function (options) {
	if (util.illFormedOpts(nonterminalRuleSchema, options) || isIllFormedNonterminalRuleOptions(options)) {
		throw new Error('Ill-formed nonterminal rule')
	}

	var newNonterminalRule = {
		// Map `options.rhs` to the nonterminal symbol names for writing grammar to output.
		rhs: options.rhs.map(nonterminalRHSSymbolToName),
		// Enable `createEditRules` to create a transposition rule with this cost penalty that recognizes the reverse order of the ordered pair `options.rhs` in input and corrects their order when parsing (i.e., swaps the order of the display text the two RHS symbols produce).
		transpositionCost: options.transpositionCost,
	}

	// Extend, validate, and append `newNonterminalRule` to `this.rules`.
	this._addRule(newNonterminalRule)

	return this
}

/**
 * Checks if `options`, which was passed to `NSymbol.prototype.addNonterminalRule()`, is ill-formed. If so, prints an error.
 *
 * @private
 * @static
 * @param {Object} options The `NSymbol.prototype.addNonterminalRule()` options object to inspect.
 * @returns {boolean} Returns `true` if `options` is ill-formed, else `false`.
 */
function isIllFormedNonterminalRuleOptions(options) {
	var rhs = options.rhs
	for (var r = 0, rhsLen = rhs.length; r < rhsLen; ++r) {
		var rhsSym = rhs[r]
		if (rhsSym.constructor === Object && util.illFormedOpts(rhsSymbolWrapperSchema, rhsSym)) {
			return true
		}
	}

	if (rhsLen > 2) {
		util.logErrorAndPath('Nonterminal rule has > 2 `rhs` symbols:', options)
		return true
	}

	if (options.transpositionCost !== undefined && rhsLen !== 2) {
		util.logErrorAndPath('Nonterminal rule with `transpositionCost` does not have two `rhs` symbols:', options)
		return true
	}

	return false
}

/**
 * Maps `rhsSym`, which was passed to `NSymbol.prototype.addNonterminalRule(options)` in `options.rhs`, to its nonterminal symbol name.
 *
 * @private
 * @static
 * @param {NSymbol|RHSSymbolWrapper} rhsSym The RHS nonterminal symbol to map.
 * @returns {string} Returns the name of `rhsSym`.
 */
function nonterminalRHSSymbolToName(rhsSym) {
	if (rhsSym.constructor === NSymbol) {
		return rhsSym.name
	}

	if (rhsSym.constructor === Object) {
		return rhsSym.symbol.name
	}

	util.logErrorAndPath('Unrecognized RHS symbol type:', rhsSym)
	throw new Error('Unrecognized RHS symbol type')
}

/**
 * Creates a terminal rule from `options` and appends it to `this.rules`.
 *
 * @memberOf NSymbol
 * @param {Object} options The options object.
 * @returns {NSymbol} Returns this `NSymbol` instance.
 */
 var terminalRuleSchema = {

 }

NSymbol.prototype.addTerminalRule = function (options) {
	if (util.illFormedOpts(terminalRuleSchema, options)) {
		throw new Error('Ill-formed terminal rule')
	}

	var newTerminalRule = {
		// Specify this is a terminal rule (i.e., `options.rhs` does not produce rules).
		isTerminal: true,
	}

	// Extend, validate, and append `newTerminalRule` to `this.rules`.
	this._addRule(newTerminalRule)

	return this
}

/**
 * Extends, validates, and appends `newRule` to `this.rules`.
 *
 * Extends `newRule` with `line` property, which is the rule's definition line, for use in error messages.
 *
 * Throws an exception if this `NSymbol` instance is either a completed term sequence or a binary symbol, which forbid further addition of rules.
 *
 * Throws an exception if this `NSymbol` already produces a rule with `rhs` identical to `newRule.rhs`.
 *
 * For use internally by `NSymbol.prototype.addNonterminalRule()` and `NSymbol.prototype.addTerminalRule()`.
 *
 * Note: This method mutates `newRule`.
 *
 * @private
 * @memberOf NSymbol
 * @param {Object} newRule The new rule to append.
 * @returns {NSymbol} Returns this `NSymbol` instance.
 */
NSymbol.prototype._addRule = function (newRule) {
	if (this.isTermSequence) {
		util.logErrorAndPath('Attempting to add a rule to the completed term sequence,', util.stylize(this.name) + ':', newRule)
		throw new Error('Adding rule to completed term sequence')
	}

	if (this.isBinarySymbol) {
		util.logErrorAndPath('Attempting to add a rule to the completed binary symbol,', util.stylize(this.name) + ':', newRule)
		throw new Error('Adding rule to completed binary symbol')
	}

	// Alert if this `NSymbol` already produces a rule with identical `rhs`.
	if (this.rules.some(existingRule => util.arraysEqual(existingRule.rhs, newRule.rhs))) {
		util.logErrorAndPath('Duplicate rule:', grammarUtil.stringifyRule(this.name, newRule))
		throw new Error('Duplicate rule')
	}

	// Save rule definition line (file-path + line-number), for use in error messages. Excluded from output grammar.
	newRule.line = util.getModuleCallerLocation()

	// Append `newRule`.
	this.rules.push(newRule)

	return this
}

// Export `NSymbol`.
module.exports = NSymbol