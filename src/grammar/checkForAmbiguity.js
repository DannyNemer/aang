var util = require('../util')


// Find instances of ambiguity in the grammar
// - Ambiguity exists when different sets of productions produce the same RHS symbols
// - Does not account for rule properties that might distinguish the parse trees (e.g., semantics, gramProps)
// --- E.g., if a parse tree produces the same RHS but different semantics, then that should be changed
// - Does not examine edit-rules (i.e., insertions or transpositions)
// --- Ambiguity from insertions (i.e., same output produced with different insertions) is unavoidable; depends input (i.e., possible insertions always different)
// --- Ambiguity from transposition is prevented at rule creation (i.e., prevents what would be duplicate)
//
// @param {Object} grammar - Grammar following createEditRules.js
module.exports = function (grammar) {
	// Arbitrary limit on number of symbols in a tree while searching for ambiguity
	// - Limited for reasonable processing time
	var symsLimit = 10

	console.time('Ambiguity check')
	// Construct all possible trees from 'nontermSym'
	for (var nontermSym in grammar) {
		try {
			searchPaths(nontermSym)
		} catch (e) {
			// Found ambiguity; search paths from this symbol again while constructing parse trees for debugging
			if (e === -1) {
				searchPathsAndBuildTrees(nontermSym)
			} else {
				throw e
			}
		}
	}
	console.timeEnd('Ambiguity check')


	// Search for ambiguous productions that can be built from 'sym'

	// @param {String} sym
	// @param {Object} paths
	// @param {Object} lastPath -
	// @param {String} lastTerminals - Concatenation of terminal symbols in `lastPath`'s tree, separated by spaces
	function searchPaths(sym, paths, lastPath, lastTerminals, symsCount) {
		// first function call
		if (!paths) {
			lastPath = {
				nextNodes: [],
				nextNode: sym,
			}
			// store paths by their terminal symbols, so search for duplicates among only those with same terminals
			paths = {}
			lastTerminals = ''
			paths[lastTerminals] = [ lastPath ]
			symsCount = 1
		}

		var rules = grammar[sym]
		symsCount++
		// faster to iterate forward - something at hardware level
		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]
			// Ignore edit-rules
			if (rule.insertionIdx === undefined && !rule.transposition) {
				var RHS = rule.RHS

				var newPath = {
					nextNodes: lastPath.nextNodes,
					nextNode: undefined,
				}
				var newTerminals = lastTerminals

				if (rule.terminal) {
					newTerminals += ' ' + RHS[0]
					newPath.nextNode = newPath.nextNodes[newPath.nextNodes.length - 1]
					newPath.nextNodes = newPath.nextNodes.slice(0, -1)
				} else {
					if (RHS.length === 2) {
						newPath.nextNodes = newPath.nextNodes.slice()
						newPath.nextNodes.push(RHS[1])
					}

					newPath.nextNode = RHS[0]
				}

				var array = paths[newTerminals] || (paths[newTerminals] = [])
				if (newPath.nextNodes.length === 0) {
					// Search for another lastPath that leads to same symbol
					// faster to iterate forward - something at hardware level
					if (ambiguityExists(newPath, array)) {
						continue
					}
				}

				array.push(newPath)
				// symsCount count limit is random for performance
				if (newPath.nextNode && symsCount < symsLimit) {
					searchPaths(newPath.nextNode, paths, newPath, newTerminals, symsCount)
				}
			}
		}
	}


	function searchPathsAndBuildTrees(sym, paths, lastPath, lastTerminals, symsCount) {
		if (!paths) {
			paths = {}
			lastPath = {
				tree: { symbol: sym },
			}
			lastPath.nextNodes = [ lastPath.tree ]
			symsCount = 1
			lastTerminals = ''
			paths[lastTerminals] = [ lastPath ]
		}


		symsCount++
		var rules = grammar[sym]
		// faster to iterate forward - something at hardware level
		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]
			if (rule.insertionIdx === undefined && !rule.transposition) {
				var RHS = rule.RHS

				// Prevent infinite loops
				if (treeContainsRule(lastPath.tree, sym, RHS)) continue

				var nextNodes = lastPath.nextNodes.slice()
				var newPath = {
					nextNodes: nextNodes,
					tree: cloneTree(lastPath.tree, nextNodes)
				}

				var lastNode = nextNodes.pop()
				var newNode = { symbol: RHS[0] }
				lastNode.children = [ newNode ]

				if (rule.terminal) {
					var newTerminals = lastTerminals + ' ' + newNode.symbol
				} else {
					if (RHS.length === 2) {
						var secondNode = { symbol: RHS[1] }
						lastNode.children.push(secondNode)
						nextNodes.push(secondNode)
					}

					// If binary reduction, next sym added to nextNodes first\
					var newTerminals = lastTerminals
					nextNodes.push(newNode)
				}

				var array = paths[newTerminals] || (paths[newTerminals] = [])
				var nextNodesLen = nextNodes.length
				if (nextNodesLen <= 1) {
					// Search for another lastPath that leads to same symbol
					// faster to iterate forward - something at hardware level
					if (ambiguityExistsBuildTrees(newPath, array, newTerminals)) {
						continue
					}
				}

				array.push(newPath)
				// symsCount count limit is random for performance
				var nextNode = nextNodes[nextNodesLen - 1]
				if (nextNode && symsCount < symsLimit) {
					searchPathsAndBuildTrees(nextNode.symbol, paths, newPath, newTerminals, symsCount)
				}
			}
		}
	}
}

function ambiguityExists(newPath, paths) {
	var nextNode = newPath.nextNode

	for (var p = 0, pathsLen = paths.length; p < pathsLen; ++p) {
		var otherPath = paths[p]

		// Paths have identical rightmost symbols
		if (otherPath.nextNode === nextNode && otherPath.nextNodes.length === 0) {
			// found ambiguity, run aggain building trees for debug
			throw -1
		}
	}

	return false
}

function ambiguityExistsBuildTrees(newPath, paths, terminals) {
	var nextNode = newPath.nextNodes[newPath.nextNodes.length-1]
	if (nextNode) nextNode = nextNode.symbol

	for (var p = 0, pathsLen = paths.length; p < pathsLen; ++p) {
		var otherPath = paths[p]
		var otherNextNodes = otherPath.nextNodes
		var otherNextNodesLen = otherNextNodes.length

		if (otherNextNodesLen <= 1) {
			var otherNextNode = otherNextNodes[otherNextNodesLen - 1]
			if (otherNextNode) otherNextNode = otherNextNode.symbol

			// Paths have identical rightmost symbols
			if (otherNextNode === nextNode) {
				util.printWarning('Ambiguity')
				util.log(terminals + ' ' + nextNode, otherPath.tree, newPath.tree)
				return true
			}
		}
	}

	return false
}

// Return true if tree contains a rule with the passed lhs and rhs symbols
function treeContainsRule(node, lhsSym, rhs) {
	var nodeChildren = node.children
	if (!nodeChildren) return false
	var nodeChildrenLen = nodeChildren.length

	if (node.symbol === lhsSym && nodeChildrenLen === rhs.length) {
		for (var n = 0; n < nodeChildrenLen; ++n) {
			if (nodeChildren[n].symbol !== rhs[n]) break
		}

		// Same lhs and rhs symbols
		if (n === nodeChildrenLen) return true
	}

	// Check children
	for (var n = 0; n < nodeChildrenLen; ++n) {
		if (treeContainsRule(nodeChildren[n], lhsSym, rhs)) return true
	}
}

// Duplicate tree so new instance can be modified
function cloneTree(node, nextNodes) {
	// Recreate each node and its children
	var newNode = {
		symbol: node.symbol,
		// Performance is hurt when not defining properties at object instantiation
		children: undefined
	}

	var nodeChildren = node.children
	if (nodeChildren) {
		var newNodeChildren = newNode.children = []
		for (var n = 0, nodeChildrenLen = nodeChildren.length; n < nodeChildrenLen; ++n) {
			newNodeChildren.push(cloneTree(nodeChildren[n], nextNodes))
		}
	}

	// Map prevNodes to point to their new, cloned versions
	var nextNodeIdx = nextNodes.indexOf(node)
	if (nextNodeIdx !== -1) {
		nextNodes[nextNodeIdx] = newNode
	}

	return newNode
}

// Return the rightmost symbols in the tree
// *Unused*
function getTreeBottom(node, path) {
	var path = path || []
	var nodeChildren = node.children

	if (nodeChildren) {
		for (var n = 0, nodeChildrenLen = nodeChildren.length; n < nodeChildrenLen; ++n) {
			getTreeBottom(nodeChildren[n], path)
		}
	} else {
		path.push(node.symbol)
	}

	return path
}

// Return true if trees are identical
// *Unused*
function treesMatch(a, b) {
	if (a.symbol !== b.symbol) return false

	var aChildren = a.children
	var bChildren = b.children

	if (!aChildren && !bChildren) return true

	if (aChildren && bChildren && aChildren.length === bChildren.length) {
		for (var n = aChildren.length; n-- > 0;) {
			if (!treesMatch(aChildren[n], bChildren[n])) return false
		}

		return true
	}

	return false
}