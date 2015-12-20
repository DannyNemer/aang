/**
 * Initializes the grammar rules and semantics in `grammar`, and instantiates a `StateTable` for `Parser`.
 *
 * @param {string} grammarPath The path to the grammar.
 * @returns {StateTable} Returns an instance of `StateTable` for `Parser`.
 */
module.exports = function (grammarPath) {
	var grammar = require(grammarPath)
	var StateTable = require('./StateTable')

	// Initialize the semantics of rules in `grammar` for parsing by replacing identical semantic functions, semantic nodes, and semantic arrays with references to the same object.
	require('./initSemantics')(grammar)

	// Initialize the entities in `grammar` for parsing by replacing multiple instances of the same entity with references to the same object.
	require('./initEntities')(grammar.entitySets)

	// Instantiate `StateTable`.
	return new StateTable(grammar.ruleSets, grammar.startSymbol, grammar.blankSymbol)
}