var util = require('../util')


// we start from a single symbol because must ensure that the ambiguous pair can exist in the same tree
// - wait, that isn't true, right?
// eventually will reach [start]
// if we made a new category with diff name but same term symbols, we won't see problem until [start]

// depth - tells inspect how many times to recurse while formatting the object. <- symsLimit
// printAll - When enabled, print every unique pair of ambiguous trees instead of printing at most one pair (for each unique pair of rules from the initial nonterminal symbol).

// Can find ambiguity in terminal rules: X -> x, X -> Y -> x

// Y -> a | b
// Z -> a | b
// X -> Y Z
// ambiguity imposible within a binary function, only within a single nonterminal symbol
// which is why we start at every nonterminal symbol and only compare to rules in a different initial path
// otherwise, it is due to ambiguity within another symbol
var ambigPairs = []

var optsSchema = {
	symsLimit: Number,
	printOutput: { type: Boolean, optional: true },
	printAll: { type: Boolean, optional: true },
	useTestRules: { type: Boolean, optional: true },
}

module.exports = function (grammar, opts) {
	if (util.illFormedOpts(optsSchema, opts)) {
		return
	}

	if (opts.useTestRules) {
		// Delete existing rules
		for (var sym in grammar) {
			delete grammar[sym]
		}

		require('./ambiguityExamples')
	}

	var symsLimit = opts.symsLimit

	if (opts.printOutput) {
		console.log('symLimit:', symsLimit)
		console.time('Ambiguity check')
	}

	// Each instance of ambiguity in the grammar is modeled by a distinct pair of rules from the a given nonterminal symbol. The previous implementation printed the same instance of ambiguity multiple times.
	for (var nontermSym in grammar) {
		// > 95% spent in this func
		searchPathsInit(nontermSym)
		if (ambigPairs.length) {
			if (opts.printOutput) console.log(ambigPairs)
			searchPathsBuildTreesInit(nontermSym)
			ambigPairs = []
		} else if (opts.useTestRules && nontermSym.indexOf('ambig') === 1) {
			// Ensures this algorithm finds all possible forms of ambiguity
			util.printErr('Ambiguity not found in test rule', nontermSym)
		}
	}

	if (opts.printOutput) console.timeEnd('Ambiguity check')


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
					nextSyms: [],
					nextSym: undefined,
					pathTabIdx: pathTab.push(paths) - 1,
					terminals: '',
					symsCount: 2
				}

				if (rule.terminal) {
					newPath.terminals += ' ' + RHS[0] // add space because all will begin with space
				} else {
					if (RHS.length === 2) {
						newPath.nextSyms.push(RHS[1])
					}

					newPath.nextSym = RHS[0]
				}


				paths[newPath.terminals] = [ newPath ]
				if (newPath.nextSym) {
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
		// ~75%% of searchPaths() time
		findAmbiguity(pathTab)
	}


	function searchPaths(lastPath, pathTab) {
		var paths = pathTab[lastPath.pathTabIdx]
		var lastNextNode = lastPath.nextSym
		var rules = grammar[lastNextNode]
		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]
			if (rule.insertionIdx === undefined && !rule.transposition) {
				var RHS = rule.RHS

				var newPath = {
					nextSyms: lastPath.nextSyms,
					nextSym: undefined,
					pathTabIdx: lastPath.pathTabIdx,
					terminals: lastPath.terminals,
					symsCount: lastPath.symsCount + 1,
				}

				if (rule.terminal) {
					newPath.terminals += ' ' + RHS[0]
					newPath.nextSym = newPath.nextSyms[newPath.nextSyms.length - 1]
					newPath.nextSyms = newPath.nextSyms.slice(0, -1)
				} else {
					// Prevent recursive rules, where the RHS includes the LHS symbol, in path search. Recursive rules are permitted for the initial nonterminal symbol of a search (where ambiguity can exist).
					// Any instance of ambiguity demonstrated by a recursive rule (excluding for the root nonterminal symbol) can be represented with a different production because all nonterminal symbols with a recursive rule require a stop case (an error is thrown in grammar construction if otherwise).
					var firstRHS = RHS[0]
					if (lastNextNode === firstRHS) continue

					if (RHS.length === 2) {
						var secondRHS = RHS[1]
						if (lastNextNode === secondRHS) continue
						newPath.nextSyms = newPath.nextSyms.slice()
						newPath.nextSyms.push(secondRHS)
					}

					newPath.nextSym = firstRHS
				}

				var pathSet = paths[newPath.terminals]
				if (pathSet) {
					pathSet.push(newPath)
				} else {
					paths[newPath.terminals] = [ newPath ]
				}

				if (newPath.nextSym && newPath.symsCount < symsLimit) {
					searchPaths(newPath, pathTab)
				}
			}
		}
	}

	// check all at end, faster than every time, except in cases with ambiguity which can stop paths early, but net gain

	// need to add everytime and search everytime, because there are some ambigPairs that exist ealier but aren't shown at end because when they are both at their symsCount limit they aren't the same (they need a bigger limit)
	// the instance that showed this doesn't matter in prev implemntation (poss-users), because it just needed to find one and the buildTree would search every one
	// need to check everyone because of this

	// cannot stop searching a path we know to have ambiguity, so longer then, but faster for all cases without where never stop early
	// faster than searching after every reduction

	// Search for ambiguity after constructing all paths
	// Previously searched for ambiguity after constructing each path, and preventing further construction of a path if ambiguity existed. It is about ~17% faster, however, to search all paths at once even without preventing additional construction from an ambiguous path.

	// tried sorting by nextSymsLen and breaking when too long, an went from 8.5 -> 7.5
	// tried sorting be nextSym alphabetically and no perf difference
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
						var nextSym = pathA.nextSym
						var nextSyms = pathA.nextSyms

						for (var o = 0; o < pathsBLen; ++o) {
							var pathB = pathsB[o]

							if (pathB.nextSym === nextSym && util.arraysMatch(pathB.nextSyms, nextSyms)) {
								ambigPairs.push([a, b])
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
		var initPaths = []
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
					symsCount: 2,
					ambigPathTabIdxes: []
				}

				// When constructing parse trees, each initial path has an array of `pathTab` indexes of the paths with which it is ambiguous.
				// Only build paths for the symbol's rules that are in a pair of rules generating ambiguity
				for (var a = 0, ambigPairsLen = ambigPairs.length; a < ambigPairsLen; ++a) {
					var ambigPair = ambigPairs[a]
					var idx = ambigPair.indexOf(newPath.pathTabIdx)
					if (idx !== -1) {
						// ambiguity exists that includes this path
						newPath.ambigPathTabIdxes.push(ambigPair[Number(!idx)])
					}
				}

				if (newPath.ambigPathTabIdxes.length === 0) continue

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
					initPaths.push(newPath)
				}
			}
		}

		// create all path sets first before searching, otherwise will try to check for comparisons with pathIdex that do not exist
		if (opts.printAll) ammbigs = []
		for (var p = 0, initPathsLen = initPaths.length; p < initPathsLen; ++p) {
			searchPathsBuildTrees(initPaths[p], pathTab)
		}
	}

	function searchPathsBuildTrees(lastPath, pathTab) {
		// stop searching after printing for each pair of rules producing ambiguity
		if (lastPath.ambigPathTabIdxes.length === 0) return

		var paths = pathTab[lastPath.pathTabIdx]
		var nextNodeSym = lastPath.nextNodes[lastPath.nextNodes.length - 1].symbol
		var rules = grammar[nextNodeSym]
		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]
			if (rule.insertionIdx === undefined && !rule.transposition) {
				var RHS = rule.RHS

				// Prevent recurisve rules (infinite loops)
				// We could instead use treeContainsRule(), and output more (perf barely hurt), but best be consitent with what we find in searchPaths()
				if (nextNodeSym === RHS[0] || nextNodeSym === RHS[1]) continue

				var nextNodes = lastPath.nextNodes.slice()
				var newPath = {
					nextNodes: nextNodes,
					tree: cloneTree(lastPath.tree, nextNodes),
					pathTabIdx: lastPath.pathTabIdx,
					terminals: lastPath.terminals,
					symsCount: lastPath.symsCount + 1,
					// The array is shared with all subsequent paths built from the initial path
					ambigPathTabIdxes: lastPath.ambigPathTabIdxes,
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

				// Need to save path even if ambiguous, because other paths yet to be built may be ambiguous to this path
				// Can add before findAmbiguityBuildTrees because the search does not look in this `paths`
				var pathSet = paths[newPath.terminals]
				if (pathSet) {
					pathSet.push(newPath)
				} else {
					paths[newPath.terminals] = [ newPath ]
				}

				if (findAmbiguityBuildTrees(newPath, pathTab)) {
					// stop searching after printing for each pair of rules producing ambiguity
					if (lastPath.ambigPathTabIdxes.length === 0) return
					// do not `continue` because:
					// X -> Z
					// X -> Y -> Z = ambig
					// X -> a
					// X -> Y -> Z -> a = ambig with line2, which would have been stopped
					// different forms of the same path can be ambiguous with other things
					// a successive version of a path can be ambiguous with a different path than the earlier version
				}

				if (nextNodes.length > 0 && newPath.symsCount < symsLimit) {
					searchPathsBuildTrees(newPath, pathTab)
				}
			}
		}
	}

	function findAmbiguityBuildTrees(newPath, pathTab) {
		var foundAmbiguity = false

		var nextNodes = newPath.nextNodes
		var nextNodesLen = nextNodes.length

		var ambigPathTabIdxes = newPath.ambigPathTabIdxes
		for (var a = 0, ambigPathTabIdxesLen = ambigPathTabIdxes.length; a < ambigPathTabIdxesLen; ++a) {
			var pathsForTerms = pathTab[ambigPathTabIdxes[a]][newPath.terminals]
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
						// When finding an instance of ambiguity, remove the `pathTab` index from the other path's array
						// This stops all other paths in the search (from the same initial paths) from checking for ambiguity with the removed index (or stops path construction if no indexes remain).

						if (!opts.printAll) {
							ambigPathTabIdxes.splice(a, 1)
							otherPath.ambigPathTabIdxes.splice(otherPath.ambigPathTabIdxes.indexOf(newPath.pathTabIdx), 1)
							--a
							--ambigPathTabIdxesLen
						}

						if (opts.printOutput) {
							// Parse trees must be cloned before removing their rightmost symbols because a path can be ambiguous with two other paths at different depths (the first instance of ambiguity can remove rightmost symbols needed for the second instance).
							var otherPathTree = cloneTree(otherPath.tree, [])
							var newPathTree = cloneTree(newPath.tree, [])
							// Remove identical parts of pair of ambiguous trees
							diffTrees(otherPathTree, newPathTree)

							// After finding an ambiguous pair of trees and removing their identical rightmost symbols, check if an identical pair of trees has already been printed; otherwise, print and add the pair to the `ambigPairs` array.
							if (opts.printAll) {
								if (pairIsDuplicate(otherPathTree, newPathTree)) return true
								ambigPairs.push([ otherPathTree, newPathTree ])
							}

							// Print paths by index of initial nonterminal rule to maintain order
							// Nearly always, `otherPath` has lower index because it was built before `newPath`. However, if `otherPath` has only one production, then it was built in the init() function and can have a higher index than `newPath` which has more than one production
							util.printWarning('Ambiguity')
							if (newPath.pathTabIdx < otherPath.pathTabIdx) {
								util.log(newPathTree, otherPathTree)
							} else {
								util.log(otherPathTree, newPathTree)
							}
						}

						// A path can be ambiguous with other paths (in different pathSet)
						// If a pair of ambiguous paths both are ambiguous with a second path, they both would be stopped here and not print this additional case of ambiguity
						// can only be ambigious with one path per pathTabIdx, otherwise it is due to ambiguity within a subnode from that path -> i.e., that ambiguity within a different nonterminal symbol
						foundAmbiguity = true
						break
					}
				}
			}
		}

		return foundAmbiguity
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

// do not need to rmove duplicates
// just do not print
// if there is a future duplicate, it will be found on the earlier instance and not waste a comparison on the next
// if not restricting printing of ambigPairs to pairs, then use this to prvent printing duplicates

// return true if pair of ambiguous trees already exists (after having been diff-ed)
function pairIsDuplicate(treeA, treeB) {
	for (var a = 0, ambigPairsLen = ambigPairs.length; a < ambigPairsLen; ++a) {
		var ambigPair = ambigPairs[a]

		if (nodesMatch(ambigPair[0], treeA) && nodesMatch(ambigPair[1], treeB)) {
			return true
		}

		if (nodesMatch(ambigPair[0], treeB) && nodesMatch(ambigPair[1], treeA)) {
			return true
		}
	}
}

// trim portions of rules that are different (bottom-most)
// some branches won't find that symbol (different down to terminal rule)
function diffTrees(a, b) {
	var aInvertedTerms = invertTree(a)
	var bInvertedTerms = invertTree(b)

	// If there is a different number of terminal symbols (i.e., branches), use the minimum length and diff as much of the trees as possible
	// EX: X -> A -> "a"   X -> "a b"
	//       -> B -> "b"
	var termsLen = Math.min(aInvertedTerms.length, bInvertedTerms.length)
	for (var n = 0; n < termsLen; ++n) {
		var nodeObjA = aInvertedTerms[n]
		var nodeObjB = bInvertedTerms[n]
		if (!nodeObjA || !nodeObjB) break

		while (nodesMatch(nodeObjA.par.node, nodeObjB.par.node)) {
			nodeObjA = nodeObjA.par
			nodeObjB = nodeObjB.par
		}

		// also, if no mathc, avoid printing `undefined` for `children` for terminals
		delete nodeObjA.node.children
		delete nodeObjB.node.children
	}
}

// Return an array of objects holding all of the terminal symbols with pointers to their parents
function invertTree(node, terminals) {
	if (!terminals) terminals = []

	var nodeObj = {
		node: node,
		par: undefined
	}

	var childNodes = node.children
	if (childNodes) {
		for (var c = 0, childNodesLen = childNodes.length; c < childNodesLen; ++c) {
			var childObj = invertTree(childNodes[c], terminals)
			childObj.par = nodeObj
		}
	} else {
		terminals.push(nodeObj)
	}

	// we do not need to do the last one, connecting to the root

	// return terminals on base call
	return arguments[1] ? nodeObj : terminals
}

// Return true if trees are identical
function nodesMatch(a, b) {
	if (a.symbol !== b.symbol) return false

	var aChildren = a.children
	var bChildren = b.children

	if (!aChildren && !bChildren) return true

	if (aChildren && bChildren && aChildren.length === bChildren.length) {
		for (var n = aChildren.length; n-- > 0;) {
			if (!nodesMatch(aChildren[n], bChildren[n])) return false
		}

		return true
	}

	return false
}

// *Unused*
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