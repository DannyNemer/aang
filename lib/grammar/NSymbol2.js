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

	return this
}

/**
 * Extends, validates, and appends `newRule` to `this.rules`.
 *
 * For use internally by `NSymbol.prototype.addNonterminalRule()` and `NSymbol.prototype.addTerminalRule()`.
 *
 * @private
 * @memberOf NSymbol
 * @param {Object} newRule The new rule to append.
 * @returns {NSymbol} Returns this `NSymbol` instance.
 */
NSymbol.prototype._addRule = function (newRule) {

// Export `NSymbol`.
module.exports = NSymbol