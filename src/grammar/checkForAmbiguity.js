var util = require('../util')
var ambigSymbols = []

// Find instances of ambiguity in the grammar
// - Ambiguity exists when different sets of productions produce the same RHS symbols
// - Does not account for rule properties that might distinguish the parse trees (e.g., semantics, gramProps)
// --- E.g., if a parse tree produces the same RHS but different semantics, then that should be changed
// - Does not examine edit-rules (i.e., insertions or transpositions)
// --- Ambiguity from insertions (i.e., same output produced with different insertions) is unavoidable; depends input (i.e., possible insertions always different)
// --- Ambiguity from transpositions is prevented at rule creation (i.e., prevents what would be duplicate)
//
// @param {Object} grammar - Grammar following processing in createEditRules.js
module.exports = function (grammar) {
	// Arbitrary limit on number of symbols in a tree while searching for ambiguity
	// - Limited for reasonable processing time
	var symsLimit = 10

console.time('Ambiguity check')
	// Construct all possible trees from 'nontermSym'
	for (var nontermSym in grammar) {
		try {
			if (ambigSymbols.indexOf(nontermSym) !== -1) continue
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


	// Search for ambiguity in productions built from `sym`
	//
	// @param {String} sym - Nonterminal symbol
	// @param {Object} paths - Mapping of strings of terminal symbols to arrays of all different sets of productions (i.e., paths) that generate that string. Those paths are distinguished by their next nonterminal symbol.
	// @param {Object} lastPath - Path upon which to
	// @param {String} lastTerminals - Concatenation of terminal symbols in `lastPath`'s tree, separated by spaces
	// @param {Number} symsCount
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
						if (ambigSymbols.indexOf(RHS[1]) !== -1) continue
						newPath.nextNodes.push(RHS[1])
					}

					if (ambigSymbols.indexOf(RHS[0]) !== -1) continue
					newPath.nextNode = RHS[0]
				}


				var array = paths[newTerminals] || (paths[newTerminals] = [])
				// Search for another lastPath that leads to same symbol
				// faster to iterate forward - something at hardware level
				throwIfAmbiguityExists(newPath, array)

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
						if (ambigSymbols.indexOf(RHS[1]) !== -1) continue
						var secondNode = { symbol: RHS[1] }
						lastNode.children.push(secondNode)
						nextNodes.push(secondNode)
					}

					// If binary reduction, next sym added to nextNodes first\
					var newTerminals = lastTerminals
					if (ambigSymbols.indexOf(RHS[0]) !== -1) continue
					nextNodes.push(newNode)
				}

				var array = paths[newTerminals] || (paths[newTerminals] = [])
				// Search for another lastPath that leads to same symbol
				// faster to iterate forward - something at hardware level
				if (ambiguityExistsBuildTrees(newPath, array, newTerminals)) {
					continue
				}

				array.push(newPath)
				// symsCount count limit is random for performance
				var nextNode = nextNodes[nextNodes.length - 1]
				if (nextNode && symsCount < symsLimit) {
					searchPathsAndBuildTrees(nextNode.symbol, paths, newPath, newTerminals, symsCount)
				}
			}
		}
	}
}

function throwIfAmbiguityExists(newPath, paths) {
	var nextNode = newPath.nextNode
	var nextNodes = newPath.nextNodes

	for (var p = 0, pathsLen = paths.length; p < pathsLen; ++p) {
		var otherPath = paths[p]

		// Paths have identical rightmost symbols
		if (otherPath.nextNode === nextNode && util.arraysMatch(otherPath.nextNodes, nextNodes)) {
			// found ambiguity, run aggain building trees for debug
			throw -1
		}
	}
}

// Check for ambiguity
function ambiguityExistsBuildTrees(newPath, paths, terminals) {
	var nextNodes = newPath.nextNodes
	var nextNodesLen = nextNodes.length

	for (var p = 0, pathsLen = paths.length; p < pathsLen; ++p) {
		var otherPath = paths[p]
		var otherNextNodes = otherPath.nextNodes
		var otherNextNodesLen = otherNextNodes.length

		if (otherNextNodesLen === nextNodesLen) {
			for (var n = 0; n < nextNodesLen; ++n) {
				if (nextNodes[n].symbol !== otherNextNodes[n].symbol) break
			}

			if (n === nextNodesLen) {
				util.printWarning('Ambiguity')

				var root = diffTrees(otherPath.tree, newPath.tree)
				ambigSymbols.push(root)
				console.log(ambigSymbols)
				console.log('ROOT', root)

				var str = nextNodes.reduce(function (str, node) {
					return str + ' ' + node.symbol
				}, terminals)

				// util.log(str, otherPath.tree, newPath.tree)
				return true
			}
		}
	}

	return false
}

function diffTrees(a, b) {
	if (a.symbol !== b.symbol) return false

	var aChildren = a.children
	var bChildren = b.children

	if (!aChildren && !bChildren) return true

	if (aChildren && bChildren && aChildren.length === bChildren.length) {
		for (var n = aChildren.length; n-- > 0;) {
			var result = diffTrees(aChildren[n], bChildren[n])
			if (result === false) {
				util.log(a, b)
				return a.symbol
			}
			if (result === true) continue
			return result
		}

		return true
	}

	util.log(getTreeBottom(a), a, b)
	return a.symbol
	// return false
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
	// Recreate each node
	var newNode = {
		symbol: node.symbol,
		// Performance is hurt when not defining properties at object instantiation
		children: undefined
	}

	// Recreate each node's children
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

// *Unused*
// Return the rightmost symbols in the tree
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

// *Unused*
// Return true if trees are identical
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