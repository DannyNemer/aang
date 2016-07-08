var util = require('../util/util')
var grammarUtil = require('./grammarUtil')


// Instruct `util.getModuleCallerLocation()` to skip the `NSymbol` module when searching the call stack for `NSymbol` instantiation file paths used in error reporting.
util.skipFileInLocationRetrieval()

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
}