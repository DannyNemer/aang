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

/**
 * Previously, the ambiguity checker searched all paths from a nonterminal symbol, and if found ambiguity (i.e., identical rightmost symbols produced by different paths) would again search paths from the same symbol while constructing parse trees (for printing helpful error messages demonstrating the ambiguity). Constructing the parse trees in a second path search only after finding ambiguity improves performance. (E.g., parse trees have to be cloned for each new path.)
 * There is now a single path search. Instead of constructing trees, an array of RHS symbols is created for each path. If ambiguity is found between a pair of paths, trees are constructed from those paths' arrays of RHS symbols. This resembles a single path search that includes tree construction, but only an array of RHS symbols is maintained.
 * This results in a 16% speed reduction (and about equal performance when `printAll` is true), however, the algorithm is much easier to understand.
 */

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

		searchPathsInit(nontermSym)

		// if (opts.useTestRules && nontermSym.indexOf('ambig') === 1) {
		// 	// Ensures this algorithm finds all possible forms of ambiguity
		// 	util.printErr('Ambiguity not found in test rule', nontermSym)
		// }
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
					// The next symbol from which to expand this path.
					nextSym: undefined,
					// Second branches of binary rules
					// Linked list
					nextSyms: undefined,
					terminals: '',
					symsCount: 1 + RHSLen,
					rules: { RHS: RHS }, // linked list
				}

				if (rule.terminal) {
					newPath.terminals += ' ' + RHS[0] // add space because all will begin with space
				} else {
					if (RHSLen === 2) {
						// Return to second symbol in binary rule after completing this branch
						newPath.nextSyms = { sym: RHS[1] }
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
		var lastRules = lastPath.rules
		var lastNextSyms = lastPath.nextSyms

		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]
			if (rule.insertionIdx === undefined && !rule.transposition) {
				var RHS = rule.RHS
				var RHSLen = RHS.length

				var newPath = {
					nextSym: undefined,
					// linked list
					nextSyms: lastNextSyms,
					terminals: lastPath.terminals,
					symsCount: lastPath.symsCount + RHSLen,
					rules: { RHS: RHS, next: lastRules },
				}

				if (rule.terminal) {
					newPath.terminals += ' ' + RHS[0]

					if (lastNextSyms) {
						newPath.nextSym = lastNextSyms.sym
						newPath.nextSyms = lastNextSyms.next
					}
				} else {
					if (RHSLen === 2) {
						newPath.nextSyms = { sym: RHS[1], next: lastNextSyms }
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
		if (opts.printAll) {
			var ambigPairs = []
		}

		for (var a = 0, pathTabLen = pathTab.length; a < pathTabLen; ++a) {
			var pathSetsA = pathTab[a]

			for (var b = a + 1; b < pathTabLen; ++b) {
				var pathSetsB = pathTab[b]

				for (var terminals in pathSetsA) {
					var pathsB = pathSetsB[terminals]
					if (!pathsB) continue
					var pathsBLen = pathsB.length

					var pathsA = pathSetsA[terminals]
					// Look at most shallow paths first; adds 200ms
					// .sort(function (pathA, pathB) {
					// 	// return pathB.symsCount - pathA.symsCount
					// 	return pathA.symsCount - pathB.symsCount
					// })
					// Traverse backward to begin with (and print) more shallow paths
					// This could be just because we put recursive rules near start
					for (var p = pathsA.length; p-- > 0;) {
					// for (var p = 0, pathsALen = pathsA.length; p < pathsALen; ++p) {
						var pathA = pathsA[p]
						var nextSym = pathA.nextSym
						var nextSyms = pathA.nextSyms

						// for (var o = pathsBLen; o-- > 0;) {
						for (var o = 0; o < pathsBLen; ++o) {
							var pathB = pathsB[o]

							// WHY are we only finding similiar ones if going backward
							// That means we are matching trees that are found later
							if (pathB.nextSym === nextSym && util.arraysMatch(pathB.nextSyms, nextSyms)) {
								// This method, with the computational cost of maintaining rules
								//   old: printAll: 4% faster, not: 21% faster
								// worth easier to read?
							if (pathB.nextSym === nextSym && listsEqual(pathB.nextSyms, nextSyms)) {

								if (!opts.printOutput) break

								// Might need to always copy rules because
								// Need to always copy rules (even if !opts.printAll) because the same path can match 2 other paths (with diff start rules)

								var treeA = buildTreeFromRules(nontermSym, convertListToArray(pathA.rules))
								var treeB = buildTreeFromRules(nontermSym, convertListToArray(pathB.rules))
								diffTrees(treeA, treeB)

								if (!opts.printAll || !pairExists(ambigPairs, treeA, treeB)) {
									if (opts.printAll) ambigPairs.push([ treeA, treeB ])
									util.printWarning('Ambiguity')
									util.log(treeA, treeB)

									if (!opts.printAll) break
								}
							}

						}

						// if (o !== -1) break
						if (o < pathsBLen) break
					}

					if (p !== -1) break
					// if (p < pathsALen) break
				}
			}
		}
	}

	function buildTreeFromRules(lhsSym, rules) {
		if (lhsSym[0] === '[') {
			var ruleRHS = rules.shift()
			if (ruleRHS) {
				var newNodeChildren = []
				for (var r = 0, rhsLen = ruleRHS.length; r < rhsLen; ++r) {
					newNodeChildren.push(buildTreeFromRules(ruleRHS[r], rules))
				}

				return {
					symbol: lhsSym,
					children: newNodeChildren
				}
			}
		}

		return {
			symbol: lhsSym
		}
	}


	// return true if pair of ambiguous trees already exists (after having been diff-ed)
	// used when `printAll`
	function pairExists(ambigPairs, treeA, treeB) {
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

// Convert an inverted linked list (root node is last element) to an array
function convertListToArray(list) {
	var array = []

	while (list) {
		array.unshift(list.RHS)
		list = list.next
	}

	return array
}

// trim portions of rules that are different (bottom-most)
// some branches won't find that symbol (different down to terminal rule)
/**
 * Compares two linked lists of symbols to determine if they are equivalent.
 *
 * @param {Object} a The list to compare.
 * @param {Object} b The other list to compare.
 * @return {Boolean} `true` if the lists are equivalent, else `false`.
 */
function listsEqual(a, b) {
	if (!a && !b) return true

	if (!a || !b) return false

	if (a.sym !== b.sym) return false

	return listsEqual(a.next, b.next)
}
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