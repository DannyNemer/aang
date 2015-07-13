var util = require('../util')


module.exports = function (grammar) {
	var symsLimit = 10

	console.time('Ambiguity check')
	for (var nontermSym in grammar) {
		try {
			searchPathsInit(nontermSym)
		} catch (e) {
			if (e === -1) {
				searchPathsBuildTreesInit(nontermSym)
			} else {
				throw e
			}
		}
	}
	console.timeEnd('Ambiguity check')

	function searchPathsInit(sym) {
		var initPaths = []
		var pathTab = []
		var rules = grammar[sym]
		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]
			if (rule.insertionIdx === undefined && !rule.transposition) {
				// need terminal rules because what if it is X -> x, X -> Y -> x
				var RHS = rule.RHS

				var paths = {}

				var newPath = {
					nextNodes: [],
					nextNode: undefined,
					pathTabIdx: pathTab.push(paths) - 1,
					terminals: '',
					symsCount: 2
				}

				if (rule.terminal) {
					newPath.terminals += ' ' + RHS[0] // add space because all will begin with space
				} else {
					if (RHS.length === 2) {
						newPath.nextNodes.push(RHS[1])
					}

					newPath.nextNode = RHS[0]
				}

				initPaths.push(newPath)
			}
		}

		// only one production possible from this LHS, so no ambiguity will appear ONLY here
		if (pathTab.length === 1) return

		for (var p = 0, initPathsLen = initPaths.length; p < initPathsLen; ++p) {
			var path = initPaths[p]
			if (path.nextNode) {
				searchPaths(initPaths[p], pathTab)
			} else {
				throwIfAmbiguityExists(path, pathTab)

				pathTab[path.pathTabIdx][newPath.terminals] = [ path ]
			}
		}
	}


	function searchPaths(lastPath, pathTab) {
		var paths = pathTab[lastPath.pathTabIdx]
		var rules = grammar[lastPath.nextNode]
		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]
			if (rule.insertionIdx === undefined && !rule.transposition) {
				var RHS = rule.RHS

				var newPath = {
					nextNodes: lastPath.nextNodes,
					nextNode: undefined,
					pathTabIdx: lastPath.pathTabIdx,
					terminals: lastPath.terminals,
					symsCount: lastPath.symsCount + 1
				}

				if (rule.terminal) {
					newPath.terminals += ' ' + RHS[0]
					newPath.nextNode = newPath.nextNodes[newPath.nextNodes.length - 1]
					newPath.nextNodes = newPath.nextNodes.slice(0, -1)
				} else {
					if (RHS.length === 2) {
						newPath.nextNodes = newPath.nextNodes.slice()
						newPath.nextNodes.push(RHS[1])
					}

					newPath.nextNode = RHS[0]
				}

				if (newPath.nextNode && newPath.symsCount < symsLimit) {
					searchPaths(newPath, pathTab)
				} else {
					// only search and compare at end
					// the ambiguity can be found ealier, but it leads to too many searches
					throwIfAmbiguityExists(newPath, pathTab)

					var array = paths[newPath.terminals] || (paths[newPath.terminals] = [])
					array.push(newPath)
				}
			}
		}
	}


	function searchPathsBuildTreesInit(sym) {
		var pathTab = []
		var rules = grammar[sym]
		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]
			if (rule.insertionIdx === undefined && !rule.transposition) {
				// need terminal rules because what if it is X -> x, X -> Y -> x
				var RHS = rule.RHS

				var paths = {}

				var newPath = {
					nextNodes: [],
					tree: { symbol: sym, children: undefined },
					pathTabIdx: pathTab.push(paths) - 1,
					terminals: '',
					symsCount: 2
				}

				var lastNode = newPath.tree
				var newNode = { symbol: RHS[0], children: undefined }
				lastNode.children = [ newNode ]

				if (rule.terminal) {
					newPath.terminals += ' ' + newNode.symbol // add space because all will begin with space
				} else {
					if (RHS.length === 2) {
						var secondNode = { symbol: RHS[1], children: undefined }
						lastNode.children.push(secondNode)
						newPath.nextNodes.push(secondNode)
					}

					newPath.nextNodes.push(newNode)
				}

				paths[newPath.terminals] = [ newPath ]

				if (newPath.nextNodes.length > 0) {
					searchPathsBuildTrees(newPath, pathTab)
				}
			}
		}
	}

	function searchPathsBuildTrees(lastPath, pathTab) {
		var paths = pathTab[lastPath.pathTabIdx]
		var nextNodeSym = lastPath.nextNodes[lastPath.nextNodes.length - 1].symbol
		var rules = grammar[nextNodeSym]
		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]
			if (rule.insertionIdx === undefined && !rule.transposition) {
				var RHS = rule.RHS

				// Prevent infinite loops
				if (treeContainsRule(lastPath.tree, nextNodeSym, RHS)) continue

				var nextNodes = lastPath.nextNodes.slice()
				var newPath = {
					nextNodes: nextNodes,
					tree: cloneTree(lastPath.tree, nextNodes),
					pathTabIdx: lastPath.pathTabIdx,
					terminals: lastPath.terminals,
					symsCount: lastPath.symsCount + 1
				}

				var lastNode = nextNodes.pop()
				var newNode = { symbol: RHS[0], children: undefined }
				lastNode.children = [ newNode ]

				if (rule.terminal) {
					newPath.terminals += ' ' + newNode.symbol
				} else {
					if (RHS.length === 2) {
						var nextNodes2 = lastPath.nextNodes.slice()
						var newPath2 = {
							nextNodes: nextNodes2,
							tree: cloneTree(lastPath.tree, nextNodes2),
							pathTabIdx: lastPath.pathTabIdx,
							terminals: lastPath.terminals + ' ' + RHS[0],
							symsCount: lastPath.symsCount + 1
						}
						var lastNode2 = nextNodes2.pop()
						lastNode2.children = [ { symbol: RHS[0], children: undefined } ]
						var newNode2 = { symbol: RHS[1], children: undefined }
						lastNode2.children.push(newNode2)
						newPath2.nextNodes.push(newNode2)

						if (findAmbiguityBuildTrees(newPath2, pathTab)) {
							continue
						}

						var array = paths[newPath2.terminals] || (paths[newPath2.terminals] = [])
						array.push(newPath2)

						if (newPath2.symsCount < symsLimit) {
							searchPathsBuildTrees(newPath2, pathTab)
						}



						var secondNode = { symbol: RHS[1], children: undefined }
						lastNode.children.push(secondNode)
						newPath.nextNodes.push(secondNode)
					}

					newPath.nextNodes.push(newNode)
				}

				if (findAmbiguityBuildTrees(newPath, pathTab)) {
					continue
				}

				var array = paths[newPath.terminals] || (paths[newPath.terminals] = [])
				array.push(newPath)

				if (nextNodes.length > 0 && newPath.symsCount < symsLimit) {
					searchPathsBuildTrees(newPath, pathTab)
				}
			}
		}
	}
}

function throwIfAmbiguityExists(newPath, pathTab) {
	var nextNode = newPath.nextNode
	var nextNodes = newPath.nextNodes

	for (var t = 0, pathTabLen = pathTab.length; t < pathTabLen; ++t) {
		if (t === newPath.pathTabIdx) continue
		var pathsForTerms = pathTab[t][newPath.terminals]
		if (!pathsForTerms) continue

		for (var p = 0, pathsLen = pathsForTerms.length; p < pathsLen; ++p) {
			var otherPath = pathsForTerms[p]

			if (otherPath.nextNode === nextNode && util.arraysMatch(otherPath.nextNodes, nextNodes)) {
				// found ambiguity, run aggain building trees for debug
				// console.log(newPath.terminals, nextNodes)
				throw -1
			}
		}
	}
}

function findAmbiguityBuildTrees(newPath, pathTab) {
	var nextNodes = newPath.nextNodes
	var nextNodesLen = nextNodes.length

	for (var t = 0, pathTabLen = pathTab.length; t < pathTabLen; ++t) {
		if (t === newPath.pathTabIdx) continue
		var pathsForTerms = pathTab[t][newPath.terminals]
		if (!pathsForTerms) continue

		for (var p = 0, pathsLen = pathsForTerms.length; p < pathsLen; ++p) {
			var otherPath = pathsForTerms[p]
			var otherNextNodes = otherPath.nextNodes
			var otherNextNodesLen = otherNextNodes.length

			if (otherNextNodesLen === nextNodesLen) {
				for (var n = 0; n < nextNodesLen; ++n) {
					if (nextNodes[n].symbol !== otherNextNodes[n].symbol) break
				}

				if (n === nextNodesLen) {
					util.printWarning('Ambiguity')

					var str = newPath.terminals
					for (var n = nextNodesLen; n-- > 0;) {
						str += ' ' + nextNodes[n].symbol
					}

					util.log(str, otherPath.tree, newPath.tree)
					return true // try with allowing to continue to search whole loop
				}
			}
		}
	}

	return false
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