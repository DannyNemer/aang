/**
 * Initializes the grammar rules and semantics in `grammar`, and instantiates a `StateTable` for `Parser`.
 *
 * @param {string} grammarPath The path to the grammar.
 * @returns {StateTable} Returns an instance of `StateTable` for `Parser`.
 */
module.exports = function (grammarPath) {
	var grammar = require(grammarPath)
	var StateTable = require('./StateTable')

	// Instantiate `StateTable`.
	return new StateTable(grammar)
}