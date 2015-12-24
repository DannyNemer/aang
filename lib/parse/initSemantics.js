var semantic = require('../grammar/semantic')

/**
 * Initializes the semantics of rules in `grammar` for parsing by replacing identical semantic functions, semantic nodes, and semantic arrays with references to a single object. The former enables semantic equality checks by object reference instead of checking their `name` properties. The latter two enables equality checks of entire semantic trees and arrays by object reference instead of having to traverse the objects.
 *
 * @param {Object} grammar The grammar to modify.
 * @returns {Object} Returns the mutated `grammar` for chaining.
 */
module.exports = function (grammar) {
	var ruleSets = grammar.ruleSets
	var semantics = grammar.semantics

	// The semantic arrays in `grammar`.
	var semanticArrayTab = []
	// The semantic nodes in `grammar`.
	var semanticNodeTab = []

	// Initialize semantics on rules by replacing identical semantics with references to the same object.
	for (var nontermSym in ruleSets) {
		var rules = ruleSets[nontermSym]

		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]

			if (rule.semantic) {
				rule.semantic = getSemanticArray(rule.semantic)
			}

			if (rule.insertedSemantic) {
				rule.insertedSemantic = getSemanticArray(rule.insertedSemantic)
			}
		}
	}

	// Initialize semantics on instances of the `requires` property by replacing them with references to instances of the same semantic.
	for (var semanticName in semantics) {
		var semanticDef = semantics[semanticName]

		if (semanticDef.requires) {
			semanticDef.requires = getSemanticNode(semanticDef.requires)
		}
	}

	// Return mutated `grammar` for chaining.
	return grammar

	/**
	 * Gets a reference to a semantic array identical to `newSemanticArray` if it already exists in `grammar`, otherwise adds `newSemanticArray` to `semanticArrayTab`. Recursively replaces the nodes in `newSemanticArray` and the nodes' properties with references to identical instances within `grammar`.
	 *
	 * @param {Object[]} newSemanticArray The semantic array to reference and recursively replace its contents with references to identical objects.
	 * @returns {Object[]} Returns a reference to the instance of `newSemanticArray` in `grammar`.
	 */
	function getSemanticArray(newSemanticArray) {
		// Replace each semantic node wtih references to the unique instance of the node within the grammar.
		for (var s = 0, semanticArrayLen = newSemanticArray.length; s < semanticArrayLen; ++s) {
			newSemanticArray[s] = getSemanticNode(newSemanticArray[s])
		}

		// Get a reference to a matching unique instance of `newSemanticArray` within the grammar, if it exists.
		for (var s = 0, semanticArrayTabLen = semanticArrayTab.length; s < semanticArrayTabLen; ++s) {
			var existingSemanticArray = semanticArrayTab[s]
			if (semantic.arraysEqual(existingSemanticArray, newSemanticArray)) return existingSemanticArray
		}

		// Add the new unique instance of `newSemanticArray`.
		semanticArrayTab.push(newSemanticArray)

		return newSemanticArray
	}

	/**
	 * Gets a reference to a semantic node identical to `newSemanticNode` if it already exists in `grammar`, otherwise adds `newSemanticNode` to `semanticNodeTab`. Recursively replaces the node's semantic function and children array, if any, with references to identical instances within `grammar`.
	 *
	 * @param {Object} newSemanticNode The semantic node to reference and recursively replace its properties with references to identical objects.
	 * @returns {Object} Returns a reference to the instance of `newSemanticArray` in `grammar`.
	 */
	function getSemanticNode(newSemanticNode) {
		// Replace each semantic function wtih references to the unique instance of the semantic within the grammar.
		newSemanticNode.semantic = semantics[newSemanticNode.semantic.name]

		if (newSemanticNode.children) {
			// Replace the children semantic array with a reference to the unique instance of the array within the grammar.
			newSemanticNode.children = getSemanticArray(newSemanticNode.children)
		}

		// Get a reference to a matching unique instance of `newSemanticNode` within the grammar, if it exists.
		for (var s = 0, semanticTabLen = semanticNodeTab.length; s < semanticTabLen; ++s) {
			var existingSemantic = semanticNodeTab[s]
			if (semantic.nodesEqual(existingSemantic, newSemanticNode)) return existingSemantic
		}

		// Add the new unique instance of `newSemanticNode`.
		semanticNodeTab.push(newSemanticNode)

		return newSemanticNode
	}
}