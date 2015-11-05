/**
 * Initializes the grammar rules and semantics in 'grammar.json', and instantiates a `StateTable` for `Parser`.
 *
 * @returns {Object} Returns an instance of `StateTable` for `Parser`.
 */
module.exports = (function () {
	var grammar = require('../grammar.json')
	var StateTable = require('./StateTable')

	// Initialize the semantics of rules in `grammar` for parsing by replacing identical semantic functions, semantic nodes, and semantic arrays with references to the same object.
	require('./initSemantics')(grammar)

	// Instantiate `StateTable`.
	return new StateTable(grammar.ruleSets, grammar.startSymbol, grammar.blankSymbol)
}())