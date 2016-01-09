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
	var stateTable = new StateTable(grammar)

	// The map of tokens to entities in `grammar` for matching input lexical tokens to terminal rules for specified entity categories.
	stateTable.entitySets = grammar.entitySets
	// The array of integer symbols in `grammar` for matching integers in the input query to terminal rules for integers with specified value bounds.
	stateTable.intSymbols = grammar.intSymbols
	// The array of deletables in `grammar` for constructing additional parse trees with the specified input tokens deleted at a cost.
	stateTable.deletables = grammar.deletables

	return stateTable
}