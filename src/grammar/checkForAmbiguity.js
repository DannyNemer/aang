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

		// Build grammar of example ambiguous rules
		require('./ambiguityExamples')
	}

	var symsLimit = opts.symsLimit

	if (opts.printOutput) console.time('Ambiguity check')

	// Each instance of ambiguity in the grammar is modeled by a distinct pair of rules from the a given nonterminal symbol. The previous implementation printed the same instance of ambiguity multiple times.
	for (var nontermSym in grammar) {
		var ambigPairs = []
		searchPathsInit(nontermSym)
		if (ambigPairs.length) {
			if (opts.printOutput) {
				// temporary to see if find in searchPaths but never print in searchPathsBuildTree
				// if (opts.useTestRules) console.log(nontermSym)
				// console.log(ambigPairs)
			}

			searchPathsBuildTreesInit(nontermSym)
		} else if (opts.useTestRules && nontermSym.indexOf('ambig') === 1) {
			// Ensures this algorithm finds all possible forms of ambiguity
			util.printErr('Ambiguity not found in test rule', nontermSym)
		}
	}

	if (opts.printOutput) console.timeEnd('Ambiguity check')


	function searchPathsInit(sym) {
		var pathTab = []
		var rules = grammar[sym]

		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]
			if (rule.insertionIdx === undefined && !rule.transposition) {
				// need terminal rules because what if it is X -> x, X -> Y -> x
				var RHS = rule.RHS
				var RHSLen = RHS.length

				var newPath = {
					nextSyms: [],
					nextSym: undefined,
					terminals: '',
					symsCount: 1 + RHSLen,
				}

				if (rule.terminal) {
					newPath.terminals += ' ' + RHS[0] // add space because all will begin with space
				} else {
					if (RHSLen === 2) {
						newPath.nextSyms.push(RHS[1])
					}

					newPath.nextSym = RHS[0]
				}

				var pathSets = {}
				pathSets[newPath.terminals] = [ newPath ]
				pathTab.push(pathSets)
			}
		}

		// only one rule possible from this LHS, so no ambiguity will appear ONLY here
		// check pathTab, not initpaths, in case comparing a sym with terminal and nonterminal rules
		var pathTabLen = pathTab.length
		if (pathTabLen === 1) return

		for (var p = 0; p < pathTabLen; ++p) {
			var pathSets = pathTab[p]
			for (var term in pathSets) { // will always be only one
				var path = pathSets[term][0] // will only be 1

				if (path.nextSym) {
					searchPaths(path, pathSets)
				}
			}
		}

		// Search for ambiguity after constructing all paths
		findAmbiguity(pathTab)
	}

	// only compare paths with paths not made from same init path, so ambiguity it always found in the first rule from the same init symbol
	function searchPaths(lastPath, pathSets) {
		var lhsSym = lastPath.nextSym
		var rules = grammar[lhsSym]
		var lastNextSyms = lastPath.nextSyms

		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]
			if (rule.insertionIdx === undefined && !rule.transposition) {
				var RHS = rule.RHS
				var RHSLen = RHS.length

				var newPath = {
					nextSyms: lastNextSyms,
					nextSym: undefined,
					terminals: lastPath.terminals,
					symsCount: lastPath.symsCount + RHSLen,
				}

				if (rule.terminal) {
					newPath.terminals += ' ' + RHS[0]
					newPath.nextSym = lastNextSyms[lastNextSyms.length - 1]
					newPath.nextSyms = lastNextSyms.slice(0, -1)
				} else {
					if (RHSLen === 2) {
						newPath.nextSyms = lastNextSyms.slice()
						newPath.nextSyms.push(RHS[1])
					}

					newPath.nextSym = RHS[0]
				}

				var paths = pathSets[newPath.terminals]
				if (paths) {
					paths.push(newPath)
				} else {
					pathSets[newPath.terminals] = [ newPath ]
				}

				if (newPath.nextSym && newPath.symsCount < symsLimit) {
					searchPaths(newPath, pathSets)
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
	function findAmbiguity(pathTab) {
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
								// Must break if printAll (in addition to if not printAll), because then it will just keep printing the same pairs. Instead, it should just find a match, continue building until finding a pair again.
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
		var rules = grammar[sym]

		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]
			if (rule.insertionIdx === undefined && !rule.transposition) {
				// need terminal rules because what if it is X -> x, X -> Y -> x
				var RHS = rule.RHS
				var RHSLen = RHS.length

				var pathSets = {}
				var newPath = {
					nextNodes: [],
					tree: { symbol: sym, children: undefined },
					pathTabIdx: pathTab.push(pathSets) - 1,
					terminals: '',
					symsCount: 1 + RHSLen,
					ambigPathTabIdxes: [],
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
					if (RHSLen === 2) {
						var secondNode = { symbol: RHS[1], children: undefined }
						lastNode.children.push(secondNode)
						newPath.nextNodes.push(secondNode)
					}

					newPath.nextNodes.push(newNode)
				}

				pathSets[newPath.terminals] = [ newPath ]
			}
		}

		// create all path sets first before searching, otherwise will try to check for comparisons with pathIdex that do not exist
		if (opts.printAll) ambigPairs = []

		// do not need to check terminal rules (no nextNode) for ambiguiuty (by adding to initPaths), because their ambig partner, which must be nonterminal (otherwise duplicate), will find it
		for (var p = 0, pathTabLen = pathTab.length; p < pathTabLen; ++p) {
			var pathSets = pathTab[p]
			for (var term in pathSets) { // will always be only one
				var path = pathSets[term][0] // will only be 1

				if (path.nextNodes.length) {
					searchPathsBuildTrees(path, pathTab)
				}
			}
		}
	}

	function searchPathsBuildTrees(lastPath, pathTab) {
		// stop searching after printing for each pair of rules producing ambiguity
		if (lastPath.ambigPathTabIdxes.length === 0) return

		var paths = pathTab[lastPath.pathTabIdx]
		var lhsSym = lastPath.nextNodes[lastPath.nextNodes.length - 1].symbol
		var rules = grammar[lhsSym]

		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]
			if (rule.insertionIdx === undefined && !rule.transposition) {
				var RHS = rule.RHS
				var RHSLen = RHS.length

				var nextNodes = lastPath.nextNodes.slice()
				var newPath = {
					nextNodes: nextNodes,
					tree: cloneTree(lastPath.tree, nextNodes),
					pathTabIdx: lastPath.pathTabIdx,
					terminals: lastPath.terminals,
					symsCount: lastPath.symsCount + RHSLen,
					// The array is shared with all subsequent paths built from the initial path
					ambigPathTabIdxes: lastPath.ambigPathTabIdxes,
				}

				var lastNode = nextNodes.pop()
				var newNode = { symbol: RHS[0], children: undefined }
				lastNode.children = [ newNode ]

				if (rule.terminal) {
					newPath.terminals += ' ' + newNode.symbol
				} else {
					if (RHSLen === 2) {
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
							var pairIsDuplicate = false
							if (opts.printAll) {
								if (pairExists(otherPathTree, newPathTree)) {
									pairIsDuplicate = true
								} else {
									ambigPairs.push([ otherPathTree, newPathTree ])
								}
							}

							// Print paths by index of initial nonterminal rule to maintain order
							// Nearly always, `otherPath` has lower index because it was built before `newPath`. However, if `otherPath` has only one rule, then it was built in the init() function and can have a higher index than `newPath` which has more than one rule
							if (!pairIsDuplicate) {
								util.printWarning('Ambiguity')
								if (newPath.pathTabIdx < otherPath.pathTabIdx) {
									util.log(newPathTree, otherPathTree)
								} else {
									util.log(otherPathTree, newPathTree)
								}
							}
						}

						// Do not `return` because a path can be ambiguous with other paths (in a different pathSet).
						// Though, when a path is ambiguous with multiple other paths, calling `return` here will sometimes be ok if the other respective paths find the ambiguity later. This depends on the ordering of the rules in the grammar.
						// If a pair of ambiguous paths both are ambiguous with a second path, they both would be stopped here and not print this additional case of ambiguity.
						foundAmbiguity = true
						// Cannot stop if `printAll` because multiple paths within the same `pathSet` can be found ambiguous with `newPath`.
						// - If a single path is ambiguous with multiple paths from the same start rule (`pathSet`), then that other start rule is ambiguous.
						// It would be reasonable to `break` and not print the superfluous cases (caused by ambiguity within another symbol). Based on the ordering of the start rules in the grammar, however, these same ambiguous path pairs could be found at different times and thus cannot stopped in the same way. Hence, to avoid inconsistency due to ordering of the start rules in the grammar, always show the ambiguity and do not break.
						// S -> X-or-X-dup -> X -> x  (other ambig)  S -> X-or-X-dup -> X-dup -> x
						// S -> X -> x                     =>        S -> X -> x
						if (!opts.printAll) break
					}
				}
			}
		}

		return foundAmbiguity
	}

	// return true if pair of ambiguous trees already exists (after having been diff-ed)
	// used when `printAll`
	function pairExists(treeA, treeB) {
		for (var a = 0, ambigPairsLen = ambigPairs.length; a < ambigPairsLen; ++a) {
			var ambigPair = ambigPairs[a]
			var otherTreeA = ambigPair[0]
			var otherTreeB = ambigPair[1]

			if (nodesMatch(otherTreeA, treeA) && nodesMatch(otherTreeB, treeB)) {
				return true
			}

			if (nodesMatch(otherTreeA, treeB) && nodesMatch(otherTreeB, treeA)) {
				return true
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

	if (aChildren && bChildren) {
		var aChildrenLen = aChildren.length
		if (aChildrenLen === bChildren.length) {
			for (var n = 0; n < aChildrenLen; n++) {
				if (!nodesMatch(aChildren[n], bChildren[n])) return false
			}

			return true
		}
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