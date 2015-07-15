var util = require('../util')

var ambigs

// we start from a single symbol because must ensure that the ambiguous pair can exist in the same tree
// - wait, that isn't true, right?
// eventually will reach [start]
// if we made a new category with diff name but same term symbols, we won't see problem until [start]

// depth - tells inspect how many times to recurse while formatting the object. <- symsLimit
module.exports = function (grammar, symsLimit, printOutput) {
	if (printOutput) {
		console.log('symLimit:', symsLimit)
		console.time('Ambiguity check')
	}

	// Each instance of ambiguity in the grammar is modeled by a distinct pair of rules from the a given nonterminal symbol. The previous implementation printed the same instance of ambiguity multiple times.
	for (var nontermSym in grammar) {
		ambigs = []
		// > 95% spent in this func
		searchPathsInit(nontermSym)
		if (ambigs.length) {
			if (printOutput) console.log(ambigs)
			searchPathsBuildTreesInit(nontermSym)
		}
	}

	if (printOutput) console.timeEnd('Ambiguity check')


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


				pathTab[newPath.pathTabIdx][newPath.terminals] = [ newPath ]
				if (newPath.nextNode) {
					initPaths.push(newPath)
				}
			}
		}

		// only one production possible from this LHS, so no ambiguity will appear ONLY here
		// check pathTab, not initpaths, in case comparing a sym with terminal and nonterminal rules
		if (pathTab.length === 1) return

		for (var p = 0, initPathsLen = initPaths.length; p < initPathsLen; ++p) {
			searchPaths(initPaths[p], pathTab)
		}

		// Search for ambiguity after constructing all paths
		findAmbiguity(pathTab)
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

				var array = paths[newPath.terminals] || (paths[newPath.terminals] = [])
				array.push(newPath)

				if (newPath.nextNode && newPath.symsCount < symsLimit) {
					searchPaths(newPath, pathTab)
				}
			}
		}
	}

	// check all at end, faster than every time, except in cases with ambiguity which can stop paths early, but net gain

	// need to add everytime and search everytime, because there are some ambigs that exist ealier but aren't shown at end because when they are both at their symsCount limit they aren't the same (they need a bigger limit)
	// the instance that showed this doesn't matter in prev implemntation (poss-users), because it just needed to find one and the buildTree would search every one
	// need to check everyone because of this

	// cannot stop searching a path we know to have ambiguity, so longer then, but faster for all cases without where never stop early
	// faster than searching after every reduction

	// Search for ambiguity after constructing all paths
	// Previously searched for ambiguity after constructing each path, and preventing further construction of a path if ambiguity existed. It is about ~17% faster, however, to search all paths at once even without preventing additional construction from an ambiguous path.
	function findAmbiguity(pathTab) {
		// takes from 3s -> 2.5s
		for (var a = 0, pathTabLen = pathTab.length; a < pathTabLen; ++a) {
			var pathSetsA = pathTab[a]
			for (var b = a + 1; b < pathTabLen; ++b) {
				var pathSetsB = pathTab[b]

				for (var terminals in pathSetsA) {
					var pathsB = pathSetsB[terminals]
					if (!pathsB) continue
					var pathsBLen = pathsB.length

					var pathsA = pathSetsA[terminals]
					for (var p = 0, pathsALen = pathsA.length; p < pathsALen; ++p) {
						var pathA = pathsA[p]
						var nextNode = pathA.nextNode
						var nextNodes = pathA.nextNodes

						for (var o = 0; o < pathsBLen; ++o) {
							var pathB = pathsB[o]

							if (pathB.nextNode === nextNode && util.arraysMatch(pathB.nextNodes, nextNodes)) {
								ambigs.push([a, b])
								break
							}
						}

						if (o < pathsBLen) break
					}

					if (p < pathsALen) break
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
					// Only build paths for the symbol's rules that are in a pair of rules generating ambiguity
					for (var a = 0, ambigsLen = ambigs.length; a < ambigsLen; ++a) {
						if (ambigs[a].indexOf(newPath.pathTabIdx) !== -1) {
							// ambiguity exists that includes this path
							searchPathsBuildTrees(newPath, pathTab)
							break
						}
					}
				}
			}
		}
	}

	function searchPathsBuildTrees(lastPath, pathTab) {
		// stop searching after printing for each pair of rules producing ambiguity
		if (ambigs.length === 0) return

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
						var secondNode = { symbol: RHS[1], children: undefined }
						lastNode.children.push(secondNode)
						newPath.nextNodes.push(secondNode)
					}

					newPath.nextNodes.push(newNode)
				}

				if (findAmbiguityBuildTrees(newPath, pathTab)) {
					// stop searching after printing for each pair of rules producing ambiguity
					if (ambigs.length === 0) return
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

	function findAmbiguityBuildTrees(newPath, pathTab) {
		var nextNodes = newPath.nextNodes
		var nextNodesLen = nextNodes.length

		for (var t = 0, pathTabLen = pathTab.length; t < pathTabLen; ++t) {
			if (t === newPath.pathTabIdx) continue
			var pathsForTerms = pathTab[t][newPath.terminals]
			if (!pathsForTerms) continue

		// only print one instance of ambiguity for each pair of rules generating ambiguity
			for (var a = 0, ambigsLen = ambigs.length; a < ambigsLen; ++a) {
				var ambig = ambigs[a]
				if (ambig.indexOf(newPath.pathTabIdx) !== -1 && ambig.indexOf(t) !== -1) break
			}
			// already printed ambiguity for it
			if (a === ambigsLen) {
				continue
			}

			for (var p = 0, pathsLen = pathsForTerms.length; p < pathsLen; ++p) {
				var otherPath = pathsForTerms[p]
				var otherNextNodes = otherPath.nextNodes
				var otherNextNodesLen = otherNextNodes.length

				if (otherNextNodesLen === nextNodesLen) {
					for (var n = 0; n < nextNodesLen; ++n) {
						if (nextNodes[n].symbol !== otherNextNodes[n].symbol) break
					}

					if (n === nextNodesLen) {
						for (var a = 0, ambigsLen = ambigs.length; a < ambigsLen; ++a) {
							var ambig = ambigs[a]
							if (ambig.indexOf(newPath.pathTabIdx) !== -1 && ambig.indexOf(t) !== -1) {
								ambigs.splice(a, 1)
								break
								// add something to stop if none left
							}
						}

						if (printOutput) {
							util.printWarning('Ambiguity')

							var str = newPath.terminals
							for (var n = nextNodesLen; n-- > 0;) {
								str += ' ' + nextNodes[n].symbol
							}

							util.log(str, otherPath.tree, newPath.tree)
						}

						return true // try with allowing to continue to search whole loop
					}
				}
			}
		}

		return false
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