var util = require('../util')
var fs = require('fs')

/**
 * Initializes the grammar and semantics, and instantiate the StateTable used in parsing.
 *
 * @param {string} inputFilePath The file path of the input file containing the grammar, semantics, and entities.
 * @param {string} stateTablePath The file path of the StateTable module.
 * @returns {Object} Returns the StateTable used in parsing.
 */
module.exports = function (inputFilePath, stateTablePath) {
	// Resolve relative paths
	inputFilePath = fs.realpathSync(inputFilePath)
	stateTablePath = fs.realpathSync(stateTablePath)

	var inputFile = require(inputFilePath)
	var grammar = inputFile.grammar
	var semantics = inputFile.semantics
	var semanticArgNodes = {}

	// Instead of initializing each rule's semantics as a new Object, initialize all semantic functions from the JSON file and use pointers for each rule's semantics. This allows semantics to be compared by pointers instead of names.
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
				// Share nodes for semantic arguments (no 'children' property to differentiate)
				var name = semanticNode.semantic.name
				semanticArray[i] = semanticArgNodes[name] || (semanticArgNodes[name] = { semantic: semantics[name] })
			}
		})
	}

	// Remove grammar and semantics from cache
	delete inputFile.grammar
	delete inputFile.semantics

	// Build state table
	return new (require(stateTablePath))(grammar, inputFile.startSymbol)
}