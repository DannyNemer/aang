/**
 * Initializes the grammar and semantics in 'aang.json', and instantiate the `StateTable` for `Parser`.
 *
 * @returns {Object} Returns an instance of `StateTable` for `Parser`.
 */
module.exports = (function () {
	var inputFile = require('../aang.json')
	var StateTable = require('./StateTable')

	var grammar = inputFile.grammar
	var semantics = inputFile.semantics
	var semanticArgNodes = {}

	// Instead of initializing each rule's semantics as a new `Object`, initialize all semantic functions from the input file and use pointers for each rule's semantics. This allows semantics to be compared by pointers instead of the `name` property.
	Object.keys(grammar).forEach(function (sym) {
		grammar[sym].forEach(function (rule) {
			if (rule.semantic) mapSemantic(rule.semantic)
			if (rule.insertedSemantic) mapSemantic(rule.insertedSemantic)
		})
	})

	function mapSemantic(semanticArray) {
		semanticArray.forEach(function (semanticNode, i) {
			if (semanticNode.children) {
				semanticNode.semantic = semantics[semanticNode.semantic.name]
				mapSemantic(semanticNode.children)
			} else {
				// Share nodes for semantic arguments (no `children` property to differentiate).
				var name = semanticNode.semantic.name
				semanticArray[i] = semanticArgNodes[name] || (semanticArgNodes[name] = { semantic: semantics[name] })
			}
		})
	}

	// Instantiate `StateTable`.
	return new StateTable(grammar, inputFile.startSymbol)
}())