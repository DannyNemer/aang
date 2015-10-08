/**
 * Usage
 *   node checkForAmbiguity.js [options]
 *
 * Description
 *   Finds and prints instances of ambiguity in the grammar.
 *
 *   Ambiguity exists when there are multiple paths from a single nonterminal symbol to the same rightmost
 *   symbols. When ambiguity is found, parse trees demonstrating the ambiguity are printed to demonstrate the
 *   necessary changes to make to the grammar.
 *
 *   This module was a massive undertaking. All cases of possible ambiguity are documented in detail in '
 *   ambiguityExamples.js'. Many algorithms were created and ensured to catch all possible ambiguous cases.
 *   Several algorithms and unique data structures were developed and heuristics developed to make the
 *   construction of all possible paths and the comparison of paths as fast as possible. Many trials and
 *   errors. It was over 100 hours of work.
 *
 * Options
 *   -s, --tree-syms-limit  The maximum number of symbols permitted in the construction of a path when
 *                          searching for ambiguity, limiting processing time. This bound is necessary, as
 *                          the grammar permits paths of infinite length and combination.       [default: 14]
 *   -a, --find-all         Often, this superfluous for determining the necessary changes to make to the
 *                          grammar; though, can be helpful as the change needed might be in a subsequent
 *                          rule produced by the rule at the root of an instance of ambiguity. For certain
 *                          cases with `--find-all`, such as recursive rules (i.e., a rule whose RHS contains
 *                          the LHS), an excessive number of ambiguity instances are printed.       [boolean]
 *   -t, --test-rules       Specify replacing the grammar with the ambiguous test rules, defined and
 *                          documented in 'ambiguityExamples.js', to check the accuracy of this algorithm.
 *                                                                                                  [boolean]
 *   -q, --quiet            Specify suppressing program output.                                     [boolean]
 *   -h, --help             Display this screen.                                                    [boolean]
 */

var util = require('../util/util')
var yargs = require('yargs')

var argv = yargs
	.usage([
		util.colors.bold('Usage'),
		'  node $0 [options]',
		'',
		util.colors.bold('Description'),
		'  Finds and prints instances of ambiguity in the grammar.',
		'',
		'  Ambiguity exists when there are multiple paths from a single nonterminal symbol to the same rightmost symbols. When ambiguity is found, parse trees demonstrating the ambiguity are printed to demonstrate the necessary changes to make to the grammar.',
		'',
		'  This module was a massive undertaking. All cases of possible ambiguity are documented in detail in \'ambiguityExamples.js\'. Many algorithms were created and ensured to catch all possible ambiguous cases. Several algorithms and unique data structures were developed and heuristics developed to make the construction of all possible paths and the comparison of paths as fast as possible. Many trials and errors. It was over 100 hours of work.',
	].join('\n'))
	.updateStrings({
		'Options:': util.colors.bold('Options'),
	})
	.options({
		's': {
			alias: 'tree-syms-limit',
			description: 'The maximum number of symbols permitted in the construction of a path when searching for ambiguity, limiting processing time. This bound is necessary, as the grammar permits paths of infinite length and combination.',
			default: 14,
		},
		'a': {
			alias: 'find-all',
			description: 'Specify finding every distinct pair of ambiguous trees instead of one instance per each pair of rules.',
			description: 'Often, this superfluous for determining the necessary changes to make to the grammar; though, can be helpful as the change needed might be in a subsequent rule produced by the rule at the root of an instance of ambiguity. For certain cases with `--find-all`, such as recursive rules (i.e., a rule whose RHS contains the LHS), an excessive number of ambiguity instances are printed.',
			type: 'boolean',
		},
		't': {
			alias: 'test-rules',
			description: 'Specify replacing the grammar with the ambiguous test rules, defined and documented in \'ambiguityExamples.js\', to check the accuracy of this algorithm.',
			type: 'boolean',
		},
		'q': {
			alias: 'quiet',
			description: 'Specify suppressing program output.',
			type: 'boolean',
		},
	})
	.help('h', 'Display this screen.').alias('h', 'help')
	.check(function (argv, options) {
		if (isNaN(argv.treeSymsLimit)) {
			throw 'TypeError: \'--tree-syms-limit\' must be a number'
		}

		return true
	})
	// Fail on unrecognized arguments.
	.strict()
	.wrap(Math.min(yargs.terminalWidth(), 106))
	.argv

var semantic = require('../grammar/semantic')

// If `--test-rules` is passed, use the ambiguous test rules to check the accuracy of this algorithm.
var ruleSets = argv.testRules ? require('./ambiguityExamples') : require('../grammar.json').ruleSets

if (argv.quiet) util.time('Ambiguity check')

// Construct all possible paths from `nontermSym`.
for (var nontermSym in ruleSets) {
	searchPaths(nontermSym)
}

if (argv.quiet) util.timeEnd('Ambiguity check')

/**
 * Check for ambiguity created by a nonterminal symbol's rules. Compares paths created by each rules from the symbol to paths created by the other rules. Does not compare paths produced by the same initial rule, because if ambiguity exists there, then it is caused by another symbol.
 *
 * Initializes the paths from the nonterminal symbol, but calls `buildPaths()` to recursively expand the paths.
 *
 * @param {string} nontermSym The nonterminal symbol from which to search for ambiguity.
 */
function searchPaths(nontermSym) {
	// The store of all paths from `nontermSym`. Each index contains a set of arrays of paths, one set for each rule from `nontermSym`. Each set is a map of terminal strings to the arrays of paths.
	var pathTab = []
	// First node for parse tree construction.
	var rootNode = { RHS: [ nontermSym ] }
	// The rules `nontermSym` produces.
	var rules = ruleSets[nontermSym]

	for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
		var rule = rules[r]

		// Do not inspect edit rules because any ambiguity it creates is shows in the original rules from which they are derived. Insertions do enable ambiguous trees, though it is unavoidable and dependent on input.
		if (rule.insertionIdx === undefined && !rule.isTransposition) {
			var RHS = rule.RHS
			var RHSLen = RHS.length

			var newPath = {
				// The symbol this path can expand from.
				nextSym: undefined,
				// The reverse linked list of the second symbols of previously incomplete binary rules.
				nextSyms: undefined,
				// The number of elements in `nextSyms`. Marks when a LHS semantic is visited, to determine when the semantic can be reduced after completely parsing its rule's RHS.
				nextSymsLength: 0,
				// The reverse linked list of yet-to-be-reduced semantics.
				semantics: undefined,
				// The string of terminal symbols in this path.
				terminals: '',
				// The umber of symbols used by this path, to ensure below `--tree-syms-limit`.
				symsCount: 1 + RHSLen,
				// The reverse linked list to convert the path's rules (i.e., the sets of RHS symbols) to a parse tree.
				RHS: RHS,
				// The pointer to the previous path for constructing a parse tree graph representation.
				prev: rootNode,
			}

			var newSemantic = rule.semantic
			if (newSemantic) {
				if (rule.semanticIsRHS) {
					newPath.semantics = {
						semantic: newSemantic,
						isRHS: true,
					}
				} else {
					newPath.semantics = {
						semantic: newSemantic,
						nextSymsLength: newPath.nextSymsLength,
					}
				}
			}

			if (rule.isTerminal) {
				// Prepend with a space because all will begin with space.
				newPath.terminals += ' ' + RHS[0]
			} else {
				if (RHSLen === 2) {
					// Return to second symbol in binary rule after completing the first symbol's branch.
					newPath.nextSyms = {
						sym: RHS[1],
					}

					++newPath.nextSymsLength
				}

				newPath.nextSym = RHS[0]
			}

			// Paths produced by each rule of `nontermSym` is stored in a separate set of paths. That set maps strings of terminal symbols to arrays of paths.
			var pathSets = {}

			// Create an array of paths with this string of terminal symbols.
			pathSets[newPath.terminals] = [ newPath ]
			pathTab.push(pathSets)
		}
	}

	// Exit if there is only one (non-edit) rule produced by `nontermSym` because at least two rules are required for ambiguity to exist.
	var pathTabLen = pathTab.length
	if (pathTabLen === 1) return

	// Expand all paths created by `nontermSym`'s rules.
	for (var p = 0; p < pathTabLen; ++p) {
		var pathSets = pathTab[p]

		// There is one paths for each `pathTab` index.
		for (var term in pathSets) {
			var path = pathSets[term][0]

			if (path.nextSym) {
				buildPaths(pathSets, path)
			}
		}
	}

	// Search for ambiguity after constructing all paths.
	findAmbiguity(pathTab)
}

/**
 * Construct all possible expansions of a path by its rightmost nonterminal symbol. Add the new paths to the `pathTab` to search for ambiguity.
 *
 * @param {Object} pathSets The map of terminal strings to arrays of paths for a single root rule that produced `prevPath`.
 * @param {Object} prevPath The path to expand.
 */
function buildPaths(pathSets, prevPath) {
	// The subsequent paths that can be made to expand `prevPath`.
	var rules = ruleSets[prevPath.nextSym]
	var prevNextSyms = prevPath.nextSyms

	for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
		var rule = rules[r]

		// Do not inspect edit rules because any ambiguity it creates is shows in the original rules from which they are derived. Insertions do enable ambiguous trees, though it is unavoidable and dependent on input.
		if (rule.insertionIdx === undefined && !rule.isTransposition) {
			var RHS = rule.RHS
			var RHSLen = RHS.length

			var newPath = {
				// The symbol this path can expand from.
				nextSym: undefined,
				// The reverse linked list of the second symbols of previously incomplete binary rules.
				nextSyms: prevNextSyms,
				// The number of elements in `nextSyms`. Marks when a LHS semantic is visited, to determine when the semantic can be reduced after completely parsing its rule's RHS.
				nextSymsLength: prevPath.nextSymsLength,
				// The reverse linked list of yet-to-be-reduced semantics.
				semantics: undefined,
				// The string of terminal symbols in this path.
				terminals: prevPath.terminals,
				// The umber of symbols used by this path, to ensure below `--tree-syms-limit`.
				symsCount: prevPath.symsCount + RHSLen,
				// The reverse linked list to convert the path's rules (i.e., the sets of RHS symbols) to a parse tree.
				RHS: RHS,
				// The pointer to the previous path for constructing a parse tree graph representation.
				prev: prevPath,
			}

			var newSemantic = rule.semantic

			if (rule.isTerminal) {
				var newSemanticList = reduceSemanticTree(prevPath.semantics, prevPath.nextSymsLength, newSemantic)

				// Discard semantically illegal parse.
				// This prevents certain instances of ambiguity from being printed. Although those parse trees would also be discarded in `forestSearch()`, they are still being constructed by `Parser` and their offending rules should be examined.
				if (newSemanticList === -1) continue

				newPath.semantics = newSemanticList

				// Append terminal symbol.
				newPath.terminals += ' ' + RHS[0]

				// After reaching the end of a branch, go the second symbol of the most recent binary rule.
				if (prevNextSyms) {
					newPath.nextSym = prevNextSyms.sym
					newPath.nextSyms = prevNextSyms.next
					--newPath.nextSymsLength
				}
			} else {
				if (newSemantic) {
					if (rule.semanticIsRHS) {
						newPath.semantics = {
							semantic: newSemantic,
							isRHS: true,
							prev: prevPath.semantics,
						}
					} else {
						// Discard new LHS semantic if `prevSemantic` is RHS, is identical to `newSemantic`, and multiple instances of the semantic are forbidden
						var prevSemantic = prevPath.semantics
						if (prevSemantic && prevSemantic.isRHS && semantic.isForbiddenMultiple(prevSemantic.semantic, newSemantic)) {
							return -1
						}

						newPath.semantics = {
							semantic: newSemantic,
							nextSymsLength: prevPath.nextSymsLength,
							prev: prevSemantic,
						}
					}
				} else {
					newPath.semantics = prevPath.semantics
				}

				if (RHSLen === 2) {
					// If rule is binary, add the second RHS symbol to the list of `nextSyms`. The rule will resume after completing the branch produced by the first RHS symbol.
					// A linked list is faster than an array, which would require cloning the array before modifying it to avoid mutating the resource shared amongst paths.
					newPath.nextSyms = {
						sym: RHS[1],
						next: prevNextSyms,
					}

					++newPath.nextSymsLength
				}

				// Next nonterminal symbol to expand.
				newPath.nextSym = RHS[0]
			}

			// Add new path to set of paths from this root rule with these terminal symbols.
			var paths = pathSets[newPath.terminals]
			if (paths) {
				paths.push(newPath)
			} else {
				pathSets[newPath.terminals] = [ newPath ]
			}

			// If the path has not reached all terminal symbols (i.e., has a `nextSym`), and is below `--tree-syms-limit` (otherwise will build infinite paths), then continue to expand path.
			if (newPath.nextSym && newPath.symsCount < argv.treeSymsLimit) {
				buildPaths(pathSets, newPath)
			}
		}
	}
}

/**
 * Finds and prints ambiguity created by paths produced by `nontermSym`. Ambiguity exists if multiple paths exist to the same rightmost symbols. If ambiguity is found among a pair of paths, prints the parse trees for those paths.
 *
 * Compares paths produced by different root rules, where `nontermSym` is the root symbol. Does not compare paths from the same root rule, because any ambiguity that exists there is caused by a symbol other than this root symbol.
 *
 * By default, print only one instance of ambiguity found between a pair of root rules. If `--find-all` is passed, then print every distinct pair of ambiguous trees found. Often, the former (and default) is sufficient for determining the necessary changes to the ruleSets, though the latter can be helpful as the change required might not the root rule, but rather a sub rule only demonstrated when used with this root rule. For certain cases, such as recursive rules (i.e., a rule whose RHS contains the LHS), `findAll` will print too much.
 *
 * Function is called after construction all possible paths produced by `nontermSym`.
 *
 * @param {Object} pathTab The set of paths produced by `nontermSym`.
 */
function findAmbiguity(pathTab) {
	var foundAmbiguity = false

	// If `--find-all` is passed, then track distinct pairs of ambiguous trees to prevent printing the same instance of ambiguity multiple times when found in multiple pairs of trees.
	if (argv.findAll) {
		var ambigPairs = []
	}

	// Check for ambiguity among pairs of paths created by different root rules.
	for (var a = 0, pathTabLen = pathTab.length; a < pathTabLen; ++a) {
		var pathSetsA = pathTab[a]

		for (var b = a + 1; b < pathTabLen; ++b) {
			var pathSetsB = pathTab[b]

			// Check each set of paths produced from this root rule (i.e., index `a` of `pathTab`) organized by their terminal symbols.
			for (var terminals in pathSetsA) {
				var pathsB = pathSetsB[terminals]

				// Check if paths exist from this root rule (i.e., index `b` of `pathTab`) with these terminal symbols.
				if (!pathsB) continue

				var pathsBLen = pathsB.length
				var pathsA = pathSetsA[terminals]

				// Sort paths by decreasing size to print the smallest (and simplest) pair of ambiguous trees for this pair of root rules. (When `--find-all` is omitted and ambiguity exists, only a single (i.e., the first found) pair of ambiguous trees is printed for each pair of root rules.)
				pathsA.sort(function (a, b) {
					return a.symsCount - b.symsCount
				})

				// Compare paths among this pair of root rules which have identical terminal rules.
				for (var p = 0, pathsALen = pathsA.length; p < pathsALen; ++p) {
					var pathA = pathsA[p]
					var nextSym = pathA.nextSym
					var nextSyms = pathA.nextSyms

					for (var o = 0; o < pathsBLen; ++o) {
						var pathB = pathsB[o]

						// A pair of paths is ambiguous when `terminals`, `nextSym`, and `nextSyms` are identical.
						if (pathB.nextSym === nextSym && listsEqual(pathB.nextSyms, nextSyms)) {
							foundAmbiguity = true

							// Do not print if benchmarking this algorithm's performance.
							if (argv.quiet) break

							// Convert a reverse linked list of path nodes, each containing the RHS symbols a rule used in the path's construction, to a parse tree.
							var treeA = pathToTree(pathA)
							var treeB = pathToTree(pathB)

							// Remove the rightmost portions of the pair of trees that the pair have in common. This trims the trees up to the portions created by the rules causing the ambiguity.
							diffTrees(treeA, treeB)

							// Print instance of ambiguity if either are true:
							// 1) `--find-all` is omitted: Then, this is the first (and last) instance of ambiguity found to have been created by this pair of root rules.
							// 2) `--find-all` is passed and this instance of ambiguity has not been seen: Confirmed by checking if this pair, after being processed by `diffTrees()`, already exists in previously seen pairs in `ambigPairs`. The same instance of ambiguity can be found in multiple pairs of trees when the pairs are distinguished by rules that come after the rules creating ambiguity.
							if (!argv.findAll || !pairExists(ambigPairs, treeA, treeB)) {
								util.logWarning('Ambiguity:')
								util.dir('  ', 'Semantic:', completeSemanticTree(pathA.semantics), treeA, '')
								util.dir('  ', 'Semantic:', completeSemanticTree(pathB.semantics), treeB, '')

								if (argv.findAll) {
									// Save this distinct pair of ambiguous trees to prevent printing it multiple times.
									ambigPairs.push([ treeA, treeB ])
								} else {
									// Only print one instance of ambiguity for this pair of root rules.
									break
								}
							}
						}
					}

					if (o < pathsBLen) break
				}

				if (p < pathsALen) break
			}
		}
	}

	// If `--test-rules` is passed, then use ambiguous test rules to check the accuracy of this algorithm, print an error message if a symbol's ambiguity is not found.
	if (!foundAmbiguity && argv.testRules && nontermSym.indexOf('ambig') === 1) {
		util.logError('Ambiguity not found in test rule:', nontermSym)
	}
}

/**
 * Checks if a pair of ambiguous trees exists in `ambigPairs`. Called when `--find-all` is passed, after the trees have been processed by `diffTrees()`, to prevent printing the same instance of ambiguity multiple times when found in multiple pairs of trees.
 *
 * @param {Object[]} ambigPairs The array of distinct pairs of ambiguous trees found so far.
 * @param {Object} treeA The first of the new pair of ambiguous trees.
 * @param {Object} treeB The second of the new pair of ambiguous trees.
 * @returns {boolean} Returns `true` if the pairs exists in `ambigPairs`, else `false`.
 */
function pairExists(ambigPairs, treeA, treeB) {
	for (var a = 0, ambigPairsLen = ambigPairs.length; a < ambigPairsLen; ++a) {
		var ambigPair = ambigPairs[a]
		var otherTreeA = ambigPair[0]
		var otherTreeB = ambigPair[1]

		if (nodesEqual(otherTreeA, treeA) && nodesEqual(otherTreeB, treeB)) {
			return true
		}

		if (nodesEqual(otherTreeA, treeB) && nodesEqual(otherTreeB, treeA)) {
			return true
		}
	}

	return false
}

/**
 * Converts a reverse linked list (i.e., elements only contain pointers to the previous element) of path nodes, each containing the RHS symbols a rule used in the path's construction, to a parse tree.
 *
 * @param {Object} path The path to convert.
 * @returns {Object} Returns the converted parse tree.
 */
function pathToTree(path) {
	var prevNodes = []

	while (true) {
		var RHS = path.RHS

		if (RHS.length === 1) {
			var newNode = {
				symbol: RHS[0],
				children: undefined,
			}

			// Nonterminal symbol
			if (newNode.symbol[0] === '[') {
				newNode.children = prevNodes.pop()

				// Root symbol
				if (!path.prev) return newNode
			}

			prevNodes.push([ newNode ])
		} else {
			var newNodeA = {
				symbol: RHS[0],
				children: prevNodes.pop(),
			}

			var newNodeB = {
				symbol: RHS[1],
				children: prevNodes.pop(),
			}

			prevNodes.push([ newNodeA, newNodeB ])
		}

		path = path.prev
	}
}

/**
 * Compares two linked lists of symbols to determine if they are equivalent.
 *
 * @param {Object} a The list to compare.
 * @param {Object} b The other list to compare.
 * @returns {boolean} Returns `true` if the lists are equivalent, else `false`.
 */
function listsEqual(a, b) {
	if (!a && !b) return true

	if (!a || !b) return false

	if (a.sym !== b.sym) return false

	return listsEqual(a.next, b.next)
}

/**
 * Removes the rightmost portions of a pair of trees that the pair have in common. This trims the trees up to the portions created by the rules causing the ambiguity.
 *
 * When `--find-all` is passed, prevents printing the same instance of ambiguity multiple times when found in multiple pairs of trees. I.e., the pairs are distinguished by rules that come after the rules creating ambiguity.
 *
 * @param {Object} a The tree to compare.
 * @param {Object} b The other tree to compare.
 */
function diffTrees(a, b) {
	// Invert trees to an array of rightmost symbols that lead back to the root node.
	var invertedTreeA = invertTree(a)
	var invertedTreeB = invertTree(b)

	// If there is a different number of rightmost symbols (i.e., branches), use the minimum length to compare as much of the trees as possible.
	// EX: X -> A -> "a"   X -> "a b"
	//       -> B -> "b"
	var minTreeWidth = Math.min(invertedTreeA.length, invertedTreeB.length)
	for (var n = 0; n < minTreeWidth; ++n) {
		var nodeObjA = invertedTreeA[n]
		var nodeObjB = invertedTreeB[n]

		// Trees have a different number of branches; break when at end of narrower tree.
		if (!nodeObjA || !nodeObjB) break

		// Traverse up the branches until the two differentiate.
		while (nodesEqual(nodeObjA.par.node, nodeObjB.par.node)) {
			nodeObjA = nodeObjA.par
			nodeObjB = nodeObjB.par
		}

		// Remove the identical portion from each branch.
		delete nodeObjA.node.children
		delete nodeObjB.node.children
	}
}

/**
 * Inverts a parse tree produced by `rulesToTree()` to an array of rightmost nodes with pointers to their parent nodes, ending at the tree's root node.
 *
 * @param {Object} tree The root node of the parse tree to invert.
 * @returns {Object[]} Returns the inverted tree as an array of rightmost nodes with pointers to parents.
 */
function invertTree(tree) {
	var stack = [ { node: tree } ]
	var rightmostSyms = []

	while (stack.length) {
		var nodeObj = stack.pop()

		var childNodes = nodeObj.node.children
		if (childNodes) {
			// Iterate backward to traverse left branch first.
			for (var c = childNodes.length - 1; c > -1; --c) {
				stack.push({ node: childNodes[c], par: nodeObj })
			}
		} else {
			rightmostSyms.push(nodeObj)
		}
	}

	return rightmostSyms
}

/**
 * Determines whether two nodes are equivalent. Nodes are equivalent if they have the same symbol and identical children (determined recursively).
 *
 * @param {Object} a The node to compare.
 * @param {Object} b The other node to compare.
 * @returns {boolean} Returns `true` if the nodes are equivalent, else `false`.
 */
function nodesEqual(a, b) {
	if (a.symbol !== b.symbol) return false

	var aChildren = a.children
	var bChildren = b.children

	// Identical symbols and both lack children.
	if (!aChildren && !bChildren) return true

	if (aChildren && bChildren) {
		var aChildrenLen = aChildren.length
		if (aChildrenLen === bChildren.length) {
			for (var n = 0; n < aChildrenLen; ++n) {
				if (!nodesEqual(aChildren[n], bChildren[n])) return false
			}

			// Identical symbols and children.
			return true
		}
	}

	return false
}

/**
 * Reduces a semantic tree after reaching a terminal rule (i.e, and end of a branch). Merges the rule's semantic, if any, with the preceding RHS semantic(s), if any. Then reduces the RHS semantics with any preceding LHS semantics in the tree, up to a LHS semantic whose parse node has a second child node (i.e., a second branch) yet to be parsed. I.e., a LHS semantic can only be reduced after all of the RHS semantics have been found.
 *
 * @param {Object} prevSemantic The semantics linked list of the previous path.
 * @param {number} prevNextSymsLen The number of `nextNodes` in the previous path. Used to determine if the rule of a LHS semantic has been completely parsed and that semantic can be reduced.
 * @param {Object[]} [newSemantic] The semantic of the terminal rule, if any.
 * @returns {Object|number} Returns the reduced semantics linked list if successfully parsed, else `-1`.
 */
function reduceSemanticTree(prevSemantic, prevNextSymsLen, newSemantic) {
	// Reduce the semantic tree up to a LHS semantic whose parse node has a second child node (i.e., a second branch) yet to be parsed.
	while (prevSemantic) {
		// Merge RHS semantics.
		if (prevSemantic.isRHS) {
			if (newSemantic) {
				newSemantic = semantic.mergeRHS(prevSemantic.semantic, newSemantic)

				// Discard if RHS contains duplicates.
				if (newSemantic === -1) return -1
			} else {
				newSemantic = prevSemantic.semantic
			}
		}

		// Reduce the LHS semantic after parsing the right-most branch that follows the semantic.
		else if (prevNextSymsLen <= prevSemantic.nextSymsLength) {
			// A semantic function without an argument - currently can only be `intersect()`.
			// This will need to be modified if we incorporate semantic functions that don't require arguments.
			if (!newSemantic) return -1

			newSemantic = semantic.reduce(prevSemantic.semantic, newSemantic)
		}

		// Stop at a LHS semantic whose parse node has yet-to-be-parsed child nodes.
		else {
			break
		}

		prevSemantic = prevSemantic.prev
	}

	if (newSemantic) {
		return {
			semantic: newSemantic,
			isRHS: true,
			prev: prevSemantic,
		}
	} else {
		return prevSemantic
	}
}

/**
 * Completely reduces a semantic tree irrespective of parsing state. Used to print the semantics of a pair of ambiguous paths, which are not always completely parsed.
 *
 * @param {Object} semanticList The paths semantic tree to forcefully reduce.
 * @returns {string|number|undefined} Returns a string representation of the reduced parse tree if parsing succeeds, `-1` if there is a semantic error`, or `undefined` if there is no `semanticList` to begin with.
 */
function completeSemanticTree(semanticList) {
	if (!semanticList) return

	var prevSemantic = semanticList.semantic
	semanticList = semanticList.prev

	// Forcefully reduce the semantic tree irrespective of whether RHS semantics have been reduced.
	while (semanticList) {
		if (semanticList.isRHS) {
			// Merge RHS semantics.
			prevSemantic = semantic.mergeRHS(semanticList.semantic, prevSemantic)

			// Discard if RHS contains duplicates. It is possible this discards semantics that would be legal had parsing completed.
			if (prevSemantic === -1) return -1
		} else {
			// Reduce LHS semantic.
			prevSemantic = semantic.reduce(semanticList.semantic, prevSemantic)
		}

		semanticList = semanticList.prev
	}

	// Convert semantic tree to a string representation.
	return semantic.colorString(semantic.toString(prevSemantic))
}