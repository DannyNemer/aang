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
 * @memberOf NSymbol
 * @param {Object} options The options object.
 * @returns {NSymbol} Returns this `NSymbol` instance.
 */
var nonterminalRuleSchema = {

}

NSymbol.prototype.addNonterminalRule = function (options) {
	if (util.illFormedOpts(nonterminalRuleSchema, options)) {
		throw new Error('Ill-formed nonterminal rule')
	}

	var newNonterminalRule = {
	}

	// Extend, validate, and append `newNonterminalRule` to `this.rules`.
	this._addRule(newNonterminalRule)

	return this
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

	// Save rule definition line (file-path + line-number), for use in error messages. Excluded from output grammar.
	newRule.line = util.getModuleCallerLocation()

	// Append `newRule`.
	this.rules.push(newRule)

	return this
}

// Export `NSymbol`.
module.exports = NSymbol