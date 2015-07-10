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

module.exports = function (grammar) {
	console.time('ambig')
	for (var nontermSym in grammar) {
		searchPaths(nontermSym)
	}
	console.timeEnd('ambig')

	function searchPaths(sym, paths) {
		if (!paths) {
			var root = { symbol: sym }
			paths = [ {
				tree: root,
				nextNodes: [ root ],
				symsCount: 1,
				terminals: []
			} ]
		}

		var lastPath = paths[paths.length - 1]

		var rules = grammar[sym]
		// faster to iterate forward - something at hardware level
		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]
			if (rule.insertionIdx === undefined && !rule.transposition) {

				// Prevent infinite loops
				if (treeContainsRule(lastPath.tree, sym, rule.RHS)) continue

				var newPath = {
					nextNodes: lastPath.nextNodes.slice(),
					terminals: lastPath.terminals.slice(),
					symsCount: lastPath.symsCount + 1
				}

				newPath.tree = cloneTree(lastPath.tree, newPath.nextNodes)
				var lastNode = newPath.nextNodes.pop()


				var newNode = {
					symbol: rule.RHS[0]
				}

				lastNode.children = [ newNode ]


				if (rule.RHS.length === 2) {
					var secondNode = {
						symbol: rule.RHS[1]
					}

					lastNode.children.push(secondNode)
					newPath.nextNodes.push(secondNode)
				}

				// If binary reduction, next sym added to nextNodes first\
				if (rule.terminal) {
					newPath.terminals.push(newNode.symbol)
				} else {
					newPath.nextNodes.push(newNode)
				}


				if (newPath.nextNodes.length <= 1) {
					var newTreeBottom = getTreeBottom(newPath.tree)

					// Search for another lastPath that leads to same symbol
					// faster to iterate forward - something at hardware level
					for (var p = 0, pathsLen = paths.length; p < pathsLen; ++p) {
						var otherPath = paths[p]
						if (otherPath.nextNodes.length <= 1) {
							// Have same RHS of whole trees
							var otherTreeBottom = getTreeBottom(otherPath.tree)
							if (util.arraysMatch(otherTreeBottom, newTreeBottom)) {
								util.printWarning('Ambiguity')
								util.log(otherTreeBottom, otherPath.tree, newPath.tree)
								break
							}
						}
					}

					if (p < pathsLen) continue
				}


				// symsCount count limit is random for performance
				var nextNode = newPath.nextNodes[newPath.nextNodes.length - 1]
				if (nextNode && newPath.symsCount < 8) {
					paths.push(newPath)
					searchPaths(nextNode.symbol, paths)
				}
			}
		}
	}
}


// unsure if this is correct by stopping just if sees same rule twice
function treeContainsRule(node, lhsSym, rhs) {
	var nodeChildren = node.children
	if (!nodeChildren) return false
	var nodeChildrenLen = nodeChildren.length

	if (node.symbol === lhsSym && nodeChildrenLen === rhs.length) {
		for (var n = nodeChildrenLen; n-- > 0;) {
			if (nodeChildren[n].symbol !== rhs[n]) break
		}

		if (n < 0) return true
	}

	for (var n = nodeChildrenLen; n-- > 0;) {
		if (treeContainsRule(nodeChildren[n], lhsSym, rhs)) return true
	}
}

function cloneTree(node, nextNodes) {
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