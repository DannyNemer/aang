/**
 * Usage
 *   node checkForAmbiguity.js [options]
 *
 * Description
 *   Finds and prints instances of ambiguity in the grammar.
 *
 *   Ambiguity exists if multiple paths exist to the same rightmost symbols, and the resulting
 *   semantic trees and/or display texts are indistinguishable. If ambiguity is found among a pair
 *   of paths, prints the parse trees, semantic trees, and display texts for those paths to show
 *   the necessary changes to make to the grammar
 *
 *   This module was a massive undertaking. All cases of possible ambiguity are documented in
 *   detail in 'ambiguityExamples.js'. Many algorithms were created and ensured to catch all
 *   possible ambiguous cases. Several algorithms and unique data structures were developed and
 *   heuristics developed to make the construction of all possible paths and the comparison of
 *   paths as fast as possible. Many trials and errors. It was over 100 hours of work.
 *
 * Options
 *   -s, --tree-syms-limit  The maximum number of symbols permitted in the construction of a path
 *                          when searching for ambiguity, limiting processing time. This bound is
 *                          necessary, as the grammar permits paths of infinite length and
 *                          combination.                                              [default: 6]
 *   -c, --complete-trees   Specify requiring parse trees to completely reduce, with no
 *                          nonterminal symbols remaining to parse, to be examined for ambiguity.
 *                          This yields output that can be easier to understand, however, requires
 *                          a greater `--tree-syms-limit` value than otherwise to find the same
 *                          instances of ambiguity.                                      [boolean]
 *   -a, --find-all         Specify finding every distinct pair of ambiguous trees instead of one
 *                          instance per each pair of rules. Often, this is superfluous for
 *                          determining the necessary changes to make to the grammar. This can be
 *                          helpful, however, as the grammatical change required might not be in a
 *                          root rule, but rather in a subsequent rule only demonstrated when used
 *                          with this root rule. For certain cases with `--find-all`, such as
 *                          recursive rules (i.e., a rule whose RHS contains the LHS), an
 *                          excessive number of ambiguity instances are printed.         [boolean]
 *   -t, --test-rules       Specify replacing the grammar with the ambiguous test rules, defined
 *                          and documented in 'ambiguityExamples.js', to check the accuracy of
 *                          this algorithm.                                              [boolean]
 *   -q, --quiet            Specify suppressing program output.                          [boolean]
 *   -h, --help             Display this screen.                                         [boolean]
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
		'  Ambiguity exists if multiple paths exist to the same rightmost symbols, and the resulting semantic trees and/or display texts are indistinguishable. If ambiguity is found among a pair of paths, prints the parse trees, semantic trees, and display texts for those paths to show the necessary changes to make to the grammar',
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
			requiresArg: true,
			default: 6,
		},
		'c': {
			alias: 'complete-trees',
			description: 'Specify requiring parse trees to completely reduce, with no nonterminal symbols remaining to parse, to be examined for ambiguity. This yields output that can be easier to understand, however, requires a greater `--tree-syms-limit` value than otherwise to find the same instances of ambiguity.',
			type: 'boolean',
		},
		'a': {
			alias: 'find-all',
			description: 'Specify finding every distinct pair of ambiguous trees instead of one instance per each pair of rules. Often, this is superfluous for determining the necessary changes to make to the grammar. This can be helpful, however, as the grammatical change required might not be in a root rule, but rather in a subsequent rule only demonstrated when used with this root rule. For certain cases with `--find-all`, such as recursive rules (i.e., a rule whose RHS contains the LHS), an excessive number of ambiguity instances are printed.',
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
	.wrap(Math.min(yargs.terminalWidth(), 95))
	.argv

// Prevent surrounding file paths with parentheses in stack traces.
util.excludeParenthesesInStackTrace()

var semantic = require('../grammar/semantic')

// If `--test-rules` is passed, use the ambiguous test rules to check the accuracy of this algorithm.
var grammar = argv.testRules ? require('./ambiguityExamples') : require('../grammar.json')

// Initialize the semantics of rules in `grammar` for parsing by replacing identical semantic functions, semantic nodes, and semantic arrays with references to the same object.
require('../parser/initSemantics.js')(grammar)

var ruleSets = grammar.ruleSets

util.time('Ambiguity check')

// Construct all possible paths from `nontermSym`.
for (var nontermSym in ruleSets) {
	searchPaths(nontermSym)
}

util.log('Tree symbols limit:', argv.treeSymsLimit)
util.timeEnd('Ambiguity check')

/**
 * Checks for ambiguity created by `nontermSym`'s rules. Compares paths created by each rule from `nontermSym` to paths created by `nontermSym`'s other rules. Does not compare paths produced by the same initial rule because if ambiguity exists there, then it is caused by another symbol.
 *
 * Initializes the paths from ``nontermSym`, but calls `buildPaths()` to recursively expand the paths.
 *
 * @param {string} nontermSym The nonterminal symbol from which to search for ambiguity.
 */
function searchPaths(nontermSym) {
	// The store of all paths from `nontermSym`. Each index contains a set of arrays of paths, one set for each rule from `nontermSym`. Each set is a map of terminal strings to the arrays of paths.
	var pathTab = []

	var rootPath = {
		// The previous symbol whose rules this path can expand from.
		nextSym: undefined,
		// The reverse linked list of the second symbols of previously incomplete binary rules and yet-to-conjugate text objects from insertion rules. After reaching a terminal symbol, inspect `nextSyms` to complete the binary rules and conjugate the text objects.
		nextSyms: undefined,
		// The number of elements in `nextSyms`. Marks when a LHS semantic is visited, to determine when the semantic can be reduced after completely parsing its rule's RHS.
		nextSymsLength: 0,
		// The reverse linked list of yet-to-reduce semantics.
		semantics: undefined,
		// The path's display text.
		text: [],
		// The reverse linked list of grammatical properties for yet-to-conjugate text in `nextSyms`.
		gramProps: undefined,
		// The string of terminal symbols in this path.
		terminals: '',
		// The number of symbols used by this path, to ensure below `--tree-syms-limit`.
		symsCount: 1,
		// The path's RHS symbols. Combines with `prev` to form a reverse linked list from which to construct a path's parse tree graph representation.
		RHS: [ nontermSym ],
		// The pointer to the previous path for constructing a parse tree graph representation.
		prev: undefined,
	}

	// The rules produced by `nontermSym` from which to expand.
	var rules = ruleSets[nontermSym]
	var rulesLen = rules.length
	for (var r = 0; r < rulesLen; ++r) {
		var rule = rules[r]

		// Do not inspect transpositions because any ambiguity it creates is evident in the original rules from which they are derived.
		if (!rule.isTransposition) {
			// Create a new path by expanding `prevPath` with one of its productions, `rule`.
			var newPath = createPath(rootPath, rule)

			// Discard if semantically illegal parse.
			if (newPath === -1) continue

			// Paths produced by each rule of `nontermSym` are stored in a separate set of paths. That set maps strings of terminal symbols to arrays of paths.
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

		// There is one path set for each `pathTab` index.
		for (var term in pathSets) {
			var path = pathSets[term][0]

			if (path.nextSym) {
				if (argv.completeTrees) {
					// `--complete-trees` specifies only examining completely-reduced parse trees.
					delete pathSets[term]
				}

				buildPaths(pathSets, path)
			}
		}
	}

	// Search for ambiguity after constructing all paths.
	findAmbiguity(pathTab)
}

/**
 * Construct all possible expansions of `prevPath` by its rightmost nonterminal symbol. Add the new paths to the `pathTab` for use by `findAmbiguity()` to search for ambiguous pairs.
 *
 * @param {Object} pathSets The map of terminal strings to arrays of paths for a single root rule that produced `prevPath`.
 * @param {Object} prevPath The path to expand.
 */
function buildPaths(pathSets, prevPath) {
	// The rules produced by `prevPath` from which to expand.
	var rules = ruleSets[prevPath.nextSym]
	var rulesLen = rules.length
	for (var r = 0; r < rulesLen; ++r) {
		var rule = rules[r]

		// Do not inspect transpositions because any ambiguity it creates is evident in the original rules from which they are derived.
		if (!rule.isTransposition) {
			// Create a new path by expanding `prevPath` with one of its productions, `rule`.
			var newPath = createPath(prevPath, rule)

			// Discard if semantically illegal parse.
			if (newPath === -1) continue

			// Add new path to set of paths from this root rule with these terminal symbols.
			// `--complete-trees` specifies only examining completely-reduced parse trees.
			if (!argv.completeTrees || !newPath.nextSym) {
				var paths = pathSets[newPath.terminals]
				if (paths) {
					paths.push(newPath)
				} else {
					pathSets[newPath.terminals] = [ newPath ]
				}
			}

			// If the path has not reached all terminal symbols (i.e., has a `nextSym`), and is below `--tree-syms-limit` (otherwise will build infinite paths), then continue to expand path.
			if (newPath.nextSym && newPath.symsCount < argv.treeSymsLimit) {
				buildPaths(pathSets, newPath)
			}
		}
	}
}

/**
 * Creates a new path by expanding `prevPath` with `rule`.
 *
 * @param {Object} prevPath THe previous path from which to expand.
 * @param {Object} rule The produced by rule `prevPath`'s last symbol.
 * @returns {Object|number}Returns the new path if semantically legal, else `-1`.
 */
function createPath(prevPath, rule) {
	var prevNextSyms = prevPath.nextSyms
	var RHS = rule.RHS
	var RHSLen = RHS.length

	var newPath = {
		// The previous symbol whose rules this path can expand from.
		nextSym: undefined,
		// The reverse linked list of the second symbols of previously incomplete binary rules and yet-to-conjugate text objects from insertion rules. After reaching a terminal symbol, inspect `nextSyms` to complete the binary rules and conjugate the text objects.
		nextSyms: prevNextSyms,
		// The number of elements in `nextSyms`. Marks when a LHS semantic is visited, to determine when the semantic can be reduced after completely parsing its rule's RHS.
		nextSymsLength: prevPath.nextSymsLength,
		// The reverse linked list of yet-to-reduce semantics.
		semantics: undefined,
		// The path's display text.
		text: prevPath.text,
		// The reverse linked list of grammatical properties for yet-to-conjugate text in `nextSyms`.
		gramProps: prevPath.gramProps,
		// The string of terminal symbols in this path.
		terminals: prevPath.terminals,
		// The number of symbols used by this path, to ensure below `--tree-syms-limit`.
		symsCount: prevPath.symsCount + RHSLen,
		// The path's RHS symbols. Combines with `prev` to form a reverse linked list from which to construct a path's parse tree graph representation.
		RHS: RHS,
		// The pointer to the previous path for constructing a parse tree graph representation.
		prev: prevPath,
	}

	// Nonterminal rule.
	if (!rule.isTerminal) {
		// Append `rule`'s semantics, if any, to `prevPath.semantics`.
		newPath.semantics = appendSemantic(prevPath.semantics, prevPath.nextSymsLength, rule.semantic, rule.semanticIsRHS, rule.insertedSemantic)

		// Discard if semantically illegal parse.
		if (newPath.semantics === -1) return -1

		// Next nonterminal symbol this path can expand from.
		newPath.nextSym = RHS[0]

		// Grammatical properties are only on nonterminal rules.
		if (rule.gramProps) {
			newPath.gramProps = {
				props: rule.gramProps,
				prev: prevPath.gramProps,
			}
		}

		// Non-edit rule.
		if (rule.insertionIdx === undefined) {
			if (RHSLen === 2) {
				// If rule is binary, add the second RHS symbol to the list of `nextSyms`. The rule will resume after completing the branch produced by the first RHS symbol.
				newPath.nextSyms = {
					sym: RHS[1],
					prev: prevNextSyms,
				}

				++newPath.nextSymsLength
			}
		}

		// Insertion rule.
		else {
			// Save insertion text to `RHS` for printing.
			newPath.RHS = RHS.slice()
			newPath.RHS.splice(rule.insertionIdx, 0, rule.text)

			// Insertions always have text.
			if (rule.insertionIdx === 1) {

				// Will conjugate text after completing first branch in this binary reduction. Used in nominative case, which relies on person-number in the first branch (verb precedes subject).
				newPath.nextSyms = {
					text: rule.text,
					prev: prevPath.nextSyms,
				}
			} else {
				newPath.text = conjugateText(newPath, rule.text)
			}
		}
	}

	// Terminal rule.
	else {
		// Append `sub`'s RHS semantics, if any, to `prevPath.semantics` and then reduce up to the first incompletely reduced node.
		newPath.semantics = reduceSemanticTree(prevPath.semantics, prevPath.nextSymsLength, rule.semantic)

		// Discard if semantically illegal parse.
		// This prevents certain instances of ambiguity from being printed. Although those parse trees would also be discarded in `forestSearch()`, they are still being constructed by `Parser` and their offending rules should be examined.
		if (newPath.semantics === -1) return -1

		// Append terminal symbol.
		newPath.terminals += ' ' + RHS[0]

		// Append terminal rule text, if any; otherwise it is a stop word.
		var text = rule.text
		if (text) {
			newPath.text = conjugateText(newPath, text)
		}

		// After reaching the end of a branch, go the second symbol of the most recent binary rule.
		// In `forestSearch()`, this step occurs right before expanding a path instead of when the terminal rule is reached, as here, to avoid work on paths whose cost prevents them from ever being popped from the min-heap.
		while (prevNextSyms) {
			var text = prevNextSyms.text

			// Stop when at a node.
			if (!text) break

			// Append text from insertions of the second of two RHS symbols, performing any necessary conjugation. Conjugation occurs in the nominative case, which relies on the person-number of the first branch (verb precedes subject).
			newPath.text = conjugateText(newPath, text)

			prevNextSyms = prevNextSyms.prev
		}

		if (prevNextSyms) {
			// Get the second symbol of the most recent incomplete binary rule.
			newPath.nextSym = prevNextSyms.sym
			newPath.nextSyms = prevNextSyms.prev
			--newPath.nextSymsLength
		} else {
			// No symbols remain.
			// `newPath.nextSymsLength`  equals 0.
			newPath.nextSyms = undefined
		}
	}

	return newPath
}

/**
 * Finds and prints ambiguity created by paths produced by `nontermSym`. Ambiguity exists if multiple paths exist to the same rightmost symbols, and the resulting semantic trees and/or display texts are indistinguishable. If ambiguity is found among a pair of paths, prints the parse trees, semantic trees, and display texts for those paths to show the necessary changes to make to the grammar
 *
 * Compares paths produced by different root rules, where `nontermSym` is the root symbol. Does not compare paths from the same root rule, because any ambiguity that exists there is caused by a symbol other than this root symbol.
 *
 * By default, prints only one instance of ambiguity found between a pair of root rules. If `--find-all` is `true`, then prints every distinct pair of ambiguous trees found. Often, the former is sufficient for determining the necessary changes to make to the grammar. The latter, however, can be helpful as the grammatical change required might not be in the root rule, but rather in a subsequent rule only demonstrated when used with this root rule. For certain cases with `--find-all`, such as recursive rules (i.e., a rule whose RHS contains the LHS), an excessive number of ambiguity instances are printed.
 *
 * @param {Object} pathTab The set of paths produced by a single nonterminal symbol.
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

						//  `terminals`, `nextSym`, and `nextSyms` together are the rightmost symbols of the root symbol. If no nonterminal symbols remain to be reduced (as is always true with `--complete-trees`), then the rightmost symbols form what would be the parse input.
						if (pathB.nextSym === nextSym && nextSymsEqual(pathB.nextSyms, nextSyms)) {
							// Save the output of the following path operations to prevent unnecessarily repeating them for multiple comparisons.
							if (!pathA.textAndSyms) {
								// Completely reduce semantic trees irrespective of parsing states and semantic argument requirements. This is necessary for comparisons.
								pathA.semantics = completeSemanticTree(pathA.semantics)

								// Concatenate each path's display texts, text arrays of yet-to-reduce insertion rules, and yet-to-reduce nonterminal symbols. Merge adjacent strings to properly compare text items spanning multiple terminal rules; e.g., XY -> "x" "y" equals Z -> "x y".
								// Include yet-to-reduce nonterminal symbols to prevent merging non-adjacent insertion texts. These nonterminal symbols have already been identified as identical to the other path
								pathA.textAndSyms = concatTextAndNextSyms(pathA)
							}

							if (!pathB.textAndSyms) {
								pathB.semantics = completeSemanticTree(pathB.semantics)
								pathB.textAndSyms = concatTextAndNextSyms(pathB)
							}


							// Check if semantic trees are identical.
							var semanticsEquivalent = semantic.arraysEqual(pathA.semantics, pathB.semantics)

							// Check if display texts, including yet-to-conjugate text objects and insertion texts of yet-to-reduce rules, are identical.
							var textEquivalent = textsEqual(textAndSymsA, textAndSymsB)

							// A pair of paths is ambiguous when their rightmost symbols are identical and have identical semantic trees and/or identical display text.
							if (!textEquivalent && !semanticsEquivalent) continue

							// The pair is semantically and/or textually indistinguishable.
							foundAmbiguity = true

							// Convert a reverse linked list of path nodes, each containing the RHS symbols a rule used in the path's construction, to a parse tree.
							var treeA = linkedListToGraph(pathA)
							var treeB = linkedListToGraph(pathB)

							// Remove the rightmost portions of the pair of trees that the pair have in common. This trims the trees up to the portions created by the rules causing the ambiguity.
							diffTrees(treeA, treeB)

							// Print instance of ambiguity if either are true:
							// 1) `--find-all` is omitted: Then, this is the first (and last) instance of ambiguity found to have been created by this pair of root rules.
							// 2) `--find-all` is passed and this instance of ambiguity has not been seen: Confirmed by checking if this pair, after being processed by `diffTrees()`, already exists in previously seen pairs in `ambigPairs`. The same instance of ambiguity can be found in multiple pairs of trees when the pairs are distinguished by rules that come after the rules creating ambiguity.
							if (!argv.findAll || !pairExists(ambigPairs, treeA, treeB)) {
								// Do not print if benchmarking this algorithm's performance.
								if (!argv.quiet) {
									util.log(util.colors.yellow('Ambiguity') + ':', util.stylize(pathA.terminals))
									util.log('  Text:', pathA.textAndSyms)
									util.log('  Semantic:', pathA.semantics === -1 ? -1 : (pathA.semantics ? semantic.colorString(semantic.toString(pathA.semantics)) : undefined))
									util.dir('  ', treeA)
									util.log()
									util.log('  Text:', pathB.textAndSyms)
									util.log('  Semantic:', pathB.semantics === -1 ? -1 : (pathB.semantics ? semantic.colorString(semantic.toString(pathB.semantics)) : undefined))
									util.dir('  ', treeB)
									util.log()
								}

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
	if (argv.testRules && !foundAmbiguity && nontermSym.indexOf('ambig') === 1) {
		util.logError('Ambiguity not found in test rule:', nontermSym)
	}
}

/**
 * Compares two paths' `nextSyms` linked lists of symbols and yet-to-conjugate text, ignoring the instances of text, to determine if the symbols are equivalent.
 *
 * @param {Object} a The `nextSyms` list to compare.
 * @param {Object} b The other `nextSyms` list to compare.
 * @returns {boolean} Returns `true` if the lists' symbols, ignoring instances of text, are equivalent, else `false`.
 */
function nextSymsEqual(a, b) {
	// Ignore instances of yet-to-conjugate text.
	while (a && !a.sym) {
		a = a.prev
	}

	// Ignore instances of yet-to-conjugate text.
	while (b && !b.sym) {
		b = b.prev
	}

	// Same linked list items or both `undefined`; i.e., reached the ends of both lists without finding a difference.
	if (a === b) return true

	// One of the lists is longer than the other.
	if (!a || !b) return false

	// Check if symbols are identical.
	if (a.sym !== b.sym) return false

	// Examine previous item in list.
	return nextSymsEqual(a.prev, b.prev)
}

/**
 * Compares two paths' `nextSyms` linked lists of symbols and yet-to-conjugate text, ignoring the instances of symbols, to determine if the text values are equivalent.
 *
 * This function was deprecated in favor of comparing the paths' output of `concatTextAndNextSyms()`
 *
 * @param {Object} a The `nextSyms` list to compare.
 * @param {Object} b The other `nextSyms` list to compare.
 * @returns {boolean} Returns `true` if the lists' text, ignoring instances of symbols, are equivalent, else `false`.
 */
function nextTextsEqual(a, b) {
	// Ignore instances of yet-to-reduce symbols.
	while (a && !a.text) {
		a = a.prev
	}

	// Ignore instances of yet-to-reduce symbols.
	while (b && !b.text) {
		b = b.prev
	}

	// Same linked list items or both `undefined`; i.e., reached the ends of both lists without finding a difference.
	if (a === b) return true

	// One of the lists is longer than the other.
	if (!a || !b) return false

	// Check if text values are identical.
	if (!textsEqual(a.text, b.text)) return false

	// Examine previous item in list.
	return nextTextsEqual(a.prev, b.prev)
}

/**
 * Performs a comparison between two rules' texts to determine if they are equivalent.
 *
 * The provided arguments are either a rule's text object to conjugate, array of text strings and objects to conjugate, or text string not needing conjugation.
 *
 * @param {Object|Array|string} a The rule's text to compare.
 * @param {Object|Array|string} b The other rule's text to compare.
 * @returns {boolean} Returns `true` if the text `a` and `b` are equivalent, else `false`.
 */
function textsEqual(a, b) {
	// Text items are identical strings, object or array references, or both `undefined`.
	if (a === b) return true

	// One of two is `undefined`.
	if (!a || !b) return false

	var constructorA = a.constructor
	var constructorB = b.constructor

	// Perform deep comparison of text objects.
	if (constructorA === Object && constructorB === Object) {
		return util.objectsEqual(a, b)
	}

	// Compare contents of insertion text arrays (containing text objects and strings).
	if (constructorA === Array && constructorB === Array) {
		return util.arraysEqual(a, b, textsEqual)
	}

	// Input texts are of different type or are different strings.
	return false
}

/**
 * Concatenates a path's display text, text arrays of yet-to-reduce insertion rules, and yet-to-reduce nonterminal symbols. Merges adjacent strings to properly compare text items spanning multiple terminal rules; e.g., XY -> "x" "y" equals Z -> "x y".
 *
 * Includes yet-to-reduce nonterminal symbols to prevent merging non-adjacent insertion texts. These nonterminal symbols have already been identified as identical to the other path being compared with this path.
 *
 * @param {Object} path The path whose value to concatenate.
 * @returns {Array} Returns a new array with concatenated values.
 */
function concatTextAndNextSyms(path) {
	// Do not mutate `text` because it can be shared with other paths.
	var items = path.text.slice()

	// Include yet-to-reduce nonterminal symbols to prevent merging non-adjacent insertion texts.
	if (path.nextSym) {
		items.push(path.nextSym)
	}

	var listItem = path.nextSyms
	while (listItem) {
		var listItemText = listItem.text

		if (listItemText instanceof Array) {
			// Merge contents of insertion text arrays.
			Array.prototype.push.apply(items, listItemText)
		} else {
			// Include yet-to-reduce nonterminal symbols and text arrays of yet-to-reduce insertion rules
			items.push(listItem.sym || listItemText)
		}

		listItem = listItem.prev
	}

	// Merge adjacent strings. Cannot use `Array.prototype.join()` because `items` can contain yet-to-conjugate text objects.
	for (var t = 1; t < items.length; ++t) {
		var item = items[t]
		var prevIndex = t - 1

		if (item.constructor === String && items[prevIndex].constructor === String) {
			items[prevIndex] += ' ' + item
			items.splice(t, 1)
			--t
		}
	}

	return items
}

/**
 * Converts a reverse linked list (i.e., elements only contain pointers to the previous element) of path nodes, each containing the RHS symbols a rule used in the path's construction, to a parse tree.
 *
 * @param {Object} path The path to convert.
 * @returns {Object} Returns the parse tree graph representation of `path`.
 */
function linkedListToGraph(path) {
	var prevNodes = []

	while (true) {
		var RHS = path.RHS

		if (RHS.length === 1) {
			var newNode = {
				symbol: RHS[0],
			}

			// Nonterminal symbol.
			if (ruleSets.hasOwnProperty(newNode.symbol)) {
				// Exclude `children` property to avoid printing `undefined` (i.e., solely aesthetic reasons).
				newNode.children = prevNodes.pop()

				// Stop at tree root.
				if (!path.prev) {
					return newNode
				}
			}

			prevNodes.push([ newNode ])
		} else {
			var newNodeA = {
				symbol: RHS[0],
			}

			// No children if symbol is insertion text.
			if (ruleSets.hasOwnProperty(newNodeA.symbol)) {
				newNodeA.children = prevNodes.pop()
			}

			var newNodeB = {
				symbol: RHS[1],
			}

			// No children if symbol is insertion text.
			if (ruleSets.hasOwnProperty(newNodeB.symbol)) {
				newNodeB.children = prevNodes.pop()
			}

			prevNodes.push([ newNodeA, newNodeB ])
		}

		path = path.prev
	}
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
 * Appends a new nonterminal rule's semantics to the previous path's semantic list.
 *
 * If `newSemantic` exists and is reduced (i.e., RHS), then it is merged with the previous semantic if it too is a reduced.
 *
 * If `insertedSemantic` exists, then it is a RHS semantic and `newSemantic` also exists and is a LHS semantic.
 *
 * Fails when appending a LHS semantic and the previous semantic is completely reduced (i.e., RHS), is identical to `newSemantic`, and multiple instances of the semantic are forbidden, and then returns `-1`.
 *
 * Fails when attempting to merge RHS semantics which would illegal (e.g., are duplicates), and then returns `-1`.
 *
 * @param {Object} prevSemantic The previous path's semantic linked list.
 * @param {number} prevNextSymsLen The number of `nextSyms` in the previous path. Used to determine if the rule of a LHS semantic has been completely reduced and that semantic can be reduced.
 * @param {Object[]} [newSemantic] The new nonterminal rule's semantic, if any.
 * @param {boolean} [semanticIsRHS] Specifies `newSemantic` is a RHS semantic.
 * @param {Object[]} [insertedSemantic] A RHS semantic of an insertion rule which also contains LHS semantic.
 * @returns {Object|number} Returns the semantic linked list if appendage is semantically legal, else `-1`.
 */
function appendSemantic(prevSemantic, prevNextSymsLen, newSemantic, semanticIsRHS, insertedSemantic) {
	// If `insertedSemantic` exists, then it is a RHS semantic and `newSemantic` also exists and is a LHS semantic.
	if (insertedSemantic) {
		// Discard new LHS semantic if `prevSemantic` is completely reduced (i.e., RHS), is identical to `newSemantic`, and multiple instances of the semantic are forbidden.
		if (prevSemantic && prevSemantic.isRHS && semantic.isForbiddenMultiple(prevSemantic.semantic, newSemantic)) {
			return -1
		}

		return {
			semantic: insertedSemantic,
			isRHS: true,
			prev: {
				semantic: newSemantic,
				nextSymsLength: prevNextSymsLen,
				prev: prevSemantic,
			}
		}
	}

	else if (newSemantic) {
		// `newSemantic` is RHS (i.e., reduced).
		if (semanticIsRHS) {
			if (prevSemantic && prevSemantic.isRHS) {
				// Merge RHS (i.e., reduced) semantic with previous semantic if also reduced.
				newSemantic = semantic.mergeRHS(prevSemantic.semantic, newSemantic)

				// Discard if RHS is semantically illegal (e.g., contains duplicates).
				if (newSemantic === -1) return -1

				return {
					semantic: newSemantic,
					isRHS: true,
					prev: prevSemantic.prev,
				}
			} else {
				return {
					semantic: newSemantic,
					isRHS: true,
					prev: prevSemantic,
				}
			}
		}

		// `newSemantic` is LHS.
		else {
			// Discard new LHS semantic if `prevSemantic` is completely reduced (i.e., RHS), is identical to `newSemantic`, and multiple instances of the semantic are forbidden.
			if (prevSemantic && prevSemantic.isRHS && semantic.isForbiddenMultiple(prevSemantic.semantic, newSemantic)) {
				return -1
			}

			return {
				semantic: newSemantic,
				nextSymsLength: prevNextSymsLen,
				prev: prevSemantic,
			}
		}
	}

	else {
		// No new semantic to append.
		return prevSemantic
	}
}

/**
 * Appends a terminal rule's RHS semantics, if any, to the previous path's semantic list, and then reduces the path's semantic tree up to the first incompletely reduced node.
 *
 * Merges the rule's semantic, if any, with the preceding RHS semantic(s), if any. Then reduces the RHS semantics with any preceding LHS semantics in the tree, up to a LHS semantic whose parse node has a second child node (i.e., a second branch) yet to be reduced. I.e., a LHS semantic can only be reduced after all of the RHS semantics have been found.
 *
 * Fails when attempting to merge RHS semantics which would illegal (e.g., are duplicates), and then returns `-1`.
 *
 * @param {Object} prevSemantic The semantic linked list of the previous path.
 * @param {number} prevNextSymsLen The number of `nextSyms` in the previous path. Used to determine if the rule of a LHS semantic has been completely reduced and that semantic can be reduced.
 * @param {Object[]} [newSemantic] The RHS semantic of the terminal rule, if any.
 * @returns {Object|number} Returns the reduced semantic linked list if reduction is semantically legal, else `-1`.
 */
function reduceSemanticTree(prevSemantic, prevNextSymsLen, newSemantic) {
	// Reduce the semantic tree up to a LHS semantic whose parse node has a second child node (i.e., a second branch) yet to be reduced.
	while (prevSemantic) {
		// Merge RHS semantics.
		if (prevSemantic.isRHS) {
			if (newSemantic) {
				newSemantic = semantic.mergeRHS(prevSemantic.semantic, newSemantic)

				// Discard if RHS is semantically illegal (e.g., contains duplicates).
				if (newSemantic === -1) return -1
			} else {
				newSemantic = prevSemantic.semantic
			}
		}

		// Reduce the LHS semantic after parsing the right-most branch that follows the semantic.
		else if (prevNextSymsLen <= prevSemantic.nextSymsLength) {
			// A semantic function without arguments - currently can only be `intersect()`.
			// This will need to be modified if we incorporate semantic functions that don't require arguments.
			if (!newSemantic) return -1

			newSemantic = semantic.reduce(prevSemantic.semantic, newSemantic)
		}

		// Stop at a LHS semantic whose parse node has yet-to-reduce child nodes.
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
 * Completely reduces a semantic tree irrespective of parsing state and semantic argument requirements. Used to print the semantics of a pair of ambiguous paths, which are not always completely reduced.
 *
 * @param {Object} semanticList The paths semantic tree to forcefully reduce.
 * @returns {Object[]|number|undefined} Returns a semantic array of the reduced semantic tree if parsing succeeds, `-1` if there is a semantic error`, or `undefined` if there is no `semanticList` to begin with.
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

			// Discard if RHS is semantically illegal (e.g., contains duplicates). It is possible this discards semantics that would be legal had parsing completed.
			if (prevSemantic === -1) return -1
		} else {
			// Reduce LHS semantic.
			prevSemantic = semantic.reduce(semanticList.semantic, prevSemantic)
		}

		semanticList = semanticList.prev
	}

	// Sort semantics. This normally occurs in `semantic.reduce()` when parsing, however, here the necessary LHS semantic might occur before the paths' root nonterminal symbol. Hence, this semantic tree can be multiple RHS semantics.
	return prevSemantic.sort(semantic.compare)
}

/**
 * Conjugates a rule's text, if necessary, for appending to a path.
 *
 * @param {Object} path The path with any `gramProps` items necessary for conjugation.
 * @param {Object|Array|string} text The rule's text object to conjugate, array of text strings and objects to conjugate, or text string not needing conjugation.
 * @returns {Array} Returns the text, conjugated if necessary, prepended with a space.
 */
function conjugateText(path, text) {
	// Use an array instead of a string because text cannot always be conjugated depending on the path's root symbol.
	var newTextArray = path.text.slice()
	var lastTextIndex = newTextArray.length - 1

	var textConstructor = text.constructor

	if (textConstructor === String) {
		// No conjugation.
		if (typeof newTextArray[lastTextIndex] === 'string') {
			// Concatenate adjacent strings to catch ambiguity spanning multiple terminal rules.
			// E.g., X -> "x"  equals  Z -> "x y"
			//       Y -> "y"
			newTextArray[lastTextIndex] += ' ' + text
		} else {
			newTextArray.push(text)
		}
	} else if (textConstructor === Object) {
		// Text requires conjugation.
		var conjugatedTextObject = conjugateTextObject(path, text)

		if (typeof conjugatedTextObject === 'string' && typeof newTextArray[lastTextIndex] === 'string') {
			newTextArray[lastTextIndex] += ' ' + conjugatedTextObject
		} else {
			newTextArray.push(conjugatedTextObject)
		}
	} else {
		// `text` is an insertion's array of text strings and yet-to-conjugate text objects, which contain a term's inflected forms. The array never contains other arrays.
		var conjugatedTextArray = conjugateTextArray(path, text)

		// Concatenate last text item and first of conjugated array are strings -> concatenate
		// adjacent strings are concatenated so only need to look at first
		if (typeof conjugatedTextArray[0] === 'string' && typeof newTextArray[lastTextIndex] === 'string') {
			newTextArray[lastTextIndex] += ' ' + conjugatedTextArray.shift()
		}

		Array.prototype.push.apply(newTextArray, conjugatedTextArray)
	}

	return newTextArray
}

/**
 * Conjugates an array of text strings and yet-to-conjugate text objects from an earlier insertion at RHS index 1. Called after completing an insertion rule's parse that determines the person-number required for the nominative case in the second (inserted) branch (verb precedes subject).
 *
 * Conjugation may fail if `path`'s root symbol occurs after where the necessary grammatical property occurs, in which case the corresponding text object remains in the returned array.
 *
 * @param {Object} path The path containing the grammatical properties, `path.gramProps`.
 * @param {Array} textArray The strings and yet-to-conjugate text objects, which contain a term's inflected forms.
 * @returns {Array} Returns a new instance of `textArray` with text objects conjugated if the necessary grammatical property exists.
 */
function conjugateTextArray(path, textArray) {
	var concatArray = []
	// cannot always bne conjugated
	// will concatenate adjacent strings

	for (var t = 0, textArrayLen = textArray.length; t < textArrayLen; ++t) {
		var text = textArray[t]

		if (text.constructor === Object) {
			// Text requires conjugation.
			concatArray.push(conjugateTextObject(path, text))
		} else {
			var concatArrayLastIdx = concatArray.length - 1

			if (typeof concatArray[concatArrayLastIdx] === 'string') {
				concatArray[concatArrayLastIdx] += ' ' + text
			} else {
				concatArray.push(text)
			}
		}
	}

	return concatArray
}

/**
 * Conjugates `textObj` to a term's correct inflection according to the grammatical properties in `path.gramProps`. Finds the most recent path in the reverse linked list `path.gramProps` that calls for a grammatical property in `textObj`. Removes the `gramProps` path from the list after conjugation. Does not allow for use of the same property in multiple places.
 *
 * If conjugation fails because `path`'s root symbol occurs after where the necessary grammatical property occurs, then returns `textObj`.
 *
 * @param {Object} path The path containing the grammatical properties, `path.gramProps`.
 * @param {Object} textObj The text object, containing a term's different inflected forms, to conjugate.
 * @returns {string|Object} Returns the conjugated string if conjugation is possible, else `textObj` if the path's root symbol occurs after where the necessary grammatical property occurs.
 */
function conjugateTextObject(path, textObj) {
	var gramPropsList = path.gramProps

	if (!gramPropsList) {
		// No conjugation possible because the path's root symbol occurs after where the necessary grammatical property occurs.
		return textObj
	}

	while (gramPropsList) {
		var gramProps = gramPropsList.props

		var verbForm = gramProps.verbForm
		if (verbForm && textObj[verbForm]) {
			// Remove `gramProps` from linked list and rebuild end of list up to its position.
			spliceGramPropsList(path, gramPropsList)
			return textObj[verbForm]
		}

		var personNumber = gramProps.personNumber
		if (personNumber && textObj[personNumber]) {
			// Remove `gramProps` from linked list and rebuild end of list up to its position.
			spliceGramPropsList(path, gramPropsList)
			return textObj[personNumber]
		}

		var gramCase = gramProps.gramCase
		if (gramCase && textObj[gramCase]) {
			// Rule with `gramCase` either has `personNumber` for nominative (so will be needed again), or doesn't have `personNumer` (for objective case) and can be deleted.
			if (!personNumber) {
				// Remove `gramProps` from linked list and rebuild end of list up to its position.
				spliceGramPropsList(path, gramPropsList)
			}

			return textObj[gramCase]
		}

		gramPropsList = gramPropsList.prev
	}

	util.logError('Failed to conjugate:', textObj, path.gramProps)
	throw new Error('Failed conjugation')
}

/**
 * Removes the element `gramPropsToRemove` from the linked list `path.gramProps`. The `gramProps` that will be used may not be the most recent, which requires the list to be rebuilt up to the `gramProps` used because the list elements are shared amongst paths.
 *
 * It is better to construct new portions of the linked list here, after finding the gramProps, instead of while traversing, because the list might not need splicing; e.g., a `gramCase` conjugation for a `gramProps` path that also contains a `personNumber`.
 *
 * @param {Object} path The path containing the reverse linked list, `path.gramProps`, to modify.
 * @param {Object} gramPropsToRemove The object to remove from `path.gramProps`.
 */
function spliceGramPropsList(path, gramPropsToRemove) {
	var gramPropsList = path.gramProps
	var prevGramProps

	// Rebuild `path.gramProps` up to the element to remove.
	while (gramPropsList !== gramPropsToRemove) {
		if (prevGramProps) {
			prevGramProps = prevGramProps.prev = {
				gramProps: gramPropsList.props,
			}
		} else {
			prevGramProps = path.gramProps = {
				gramProps: gramPropsList.props,
			}
		}

		gramPropsList = gramPropsList.prev
	}

	// Point the predecessor, `prev`, to the successor of the element to be removed.
	if (prevGramProps) {
		prevGramProps.prev = gramPropsToRemove.prev
	} else {
		path.gramProps = gramPropsToRemove.prev
	}
}