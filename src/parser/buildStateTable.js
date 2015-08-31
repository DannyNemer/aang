var util = require('../util')
var fs = require('fs')

/**
 * Initialize the grammar and semantics, and instantiate the StateTable used in parsing.
 *
 * @param {string} inputFilePath The file path of the input file containing the grammar, semantics, and entities.
 * @param {string} stateTablePath The file path of the StateTable module.
 * @returns {Object} The StateTable used in parsing.
 */
module.exports = function (inputFilePath, stateTablePath) {
	// Resolve relative paths
	inputFilePath = fs.realpathSync(inputFilePath)
	stateTablePath = fs.realpathSync(stateTablePath)

	// If loaded, remove input file from cache to force reload after removing `grammar` and `semantics` below
	util.deleteModuleCache(inputFilePath)
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
	// Reload StateTable module to enable any changes (after removing it from cache)
	return new (require(stateTablePath))(grammar, inputFile.startSymbol)
}