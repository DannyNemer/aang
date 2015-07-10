var util = require('../util')

// Try the manual way, of going thorugh production
// Later, attempt analyzing statetable - but won't be needed

// Need to check for textual and semantic ambiguity
// need to check ruleprops to see if any differences
// term rules - a rule might be a text obj in one case and just a string elsewhere
// so will need to do actual tree construction
// try changing '[stars]' -> '[forks]' so text will be identical

// might be best to do with parser, but how to test all possibilities
// and that works in a way where it won't stop until reaching terminal, so could be

// do we need to account for ruleProps?

// must be after edit rules because after creating rules from blanks

// not going to bother with checking for text and semantics because this is about parsing performance, and if there semantics or conjugation creates something different, then that should still be changed

module.exports = function (grammar) {
	console.time('Ambiguity check')
	for (var nontermSym in grammar) {
		searchPaths(nontermSym)
	}
	console.timeEnd('Ambiguity check')

	// Search for ambiguous productions that can be built from 'sym'
	function searchPaths(sym, paths) {
		if (!paths) {
			var root = { symbol: sym }
			paths = [ {
				tree: root,
				nextNodes: [ root ],
				symsCount: 1,
				terminals: ''
			} ]
		}

		var lastPath = paths[paths.length - 1]

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
					tree: cloneTree(lastPath.tree, nextNodes),
					symsCount: lastPath.symsCount + 1
				}

				var lastNode = nextNodes.pop()
				var newNode = { symbol: RHS[0] }
				lastNode.children = [ newNode ]

				if (rule.terminal) {
					newPath.terminals = lastPath.terminals + ' ' + newNode.symbol
				} else {
					if (RHS.length === 2) {
						var secondNode = { symbol: RHS[1] }
						lastNode.children.push(secondNode)
						nextNodes.push(secondNode)
					}

					// If binary reduction, next sym added to nextNodes first\
					newPath.terminals = lastPath.terminals
					nextNodes.push(newNode)
				}


				if (nextNodes.length <= 1) {
					var nextNode = nextNodes[nextNodes.length-1]
					if (nextNode) nextNode = nextNode.symbol

					// Search for another lastPath that leads to same symbol
					// faster to iterate forward - something at hardware level
					for (var p = 0, pathsLen = paths.length; p < pathsLen; ++p) {
						var otherPath = paths[p]
						if (otherPath.nextNodes.length <= 1) {
							var otherNextNode = otherPath.nextNodes[otherPath.nextNodes.length-1]
							if (otherNextNode) otherNextNode = otherNextNode.symbol

							// Paths have identical rightmost symbols
							if (otherNextNode === nextNode && newPath.terminals === otherPath.terminals) {
								util.printWarning('Ambiguity')
								util.log(newPath.terminals.concat(nextNode), otherPath.tree, newPath.tree)
								break
							}
						}
					}

					if (p < pathsLen) continue
				}


				// symsCount count limit is random for performance
				var nextNode = nextNodes[newPath.nextNodes.length - 1]
				if (nextNode && newPath.symsCount < 8) {
					paths.push(newPath)
					searchPaths(nextNode.symbol, paths)
				}
			}
		}
	}
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
		children: node.children && node.children.map(function (childNode) {
			return cloneTree(childNode, nextNodes)
		})
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