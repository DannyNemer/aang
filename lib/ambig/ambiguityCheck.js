/**
 * Usage
 *   node ambiguityCheck [options]
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
 *   -t, ---use-test-rules  Specify replacing the grammar with the ambiguous test rules, defined
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
			alias: 'use-test-rules',
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

		if (argv.useTestRules && argv.treeSymsLimit < 9) {
			throw 'Error: \'--tree-syms-limit\' must be >= 9 when passing \'--use-test-rules\''
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
var grammar = argv.useTestRules ? require('./ambiguityExamples') : require('../grammar.json')

// Initialize the semantics of rules in `grammar` for parsing by replacing identical semantic functions, semantic nodes, and semantic arrays with references to the same object.
require('../parser/initSemantics.js')(grammar)

var ruleSets = grammar.ruleSets

util.time('Ambiguity check')

// Do not inspect transpositions because any ambiguity they create is evident in the original rules from which they were derived. Remove rules to avoid checking each rule multiple times within the recrusive function, `buildPath()`.
deleteTranspositionRules(ruleSets)

// Construct all possible paths from `nontermSym`.
for (var nontermSym in ruleSets) {
	searchPaths(nontermSym)
}

util.timeEnd('Ambiguity check')
util.log('Tree symbols limit:', argv.treeSymsLimit)
util.countEndAll()

/**
 * Checks for ambiguity created by `nontermSym`'s rules. Compares paths created by each rule from `nontermSym` to paths created by `nontermSym`'s other rules. Does not compare paths produced by the same initial rule because if ambiguity exists there, then it is caused by another symbol.
 *
 * Initializes the paths from ``nontermSym`, but calls `buildPath()` to recursively expand the paths.
 *
 * @param {string} nontermSym The nonterminal symbol from which to search for ambiguity.
 */
function searchPaths(nontermSym) {
	// The rules produced by `nontermSym` from which to expand.
	var rules = ruleSets[nontermSym]
	var rulesLen = rules.length

	// Exit if there is only one (non-transposition) rule produced by `nontermSym` because at least two rules are required for ambiguity to exist.
	if (rulesLen === 1) return

	// The store of all paths from `nontermSym`. Each index contains a set of arrays of paths, one set for each rule from `nontermSym`. Each set is a map of terminal strings to the arrays of paths.
	var pathTab = []

	var rootPath = {
		// The previous symbol whose rules this path can expand from.
		nextSym: undefined,
		// The reverse linked list of the second symbols of previously incomplete binary rules and yet-to-conjugate text objects from insertion rules. After reaching a terminal symbol, inspect `nextSyms` to complete the binary rules and conjugate the text objects.
		nextSyms: undefined,
		// The number of elements in `nextSyms` excluding yet-to-conjugate text. Marks when a LHS semantic is visited, to determine when the semantic can be reduced after completely reducing its rule's RHS.
		nextSymsCount: 0,
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
		rule: { RHS: [ nontermSym ] },
		// The pointer to the previous path. This is used by `linkedListToGraph()` to construct a parse tree graph representation from this path.
		prev: undefined,
	}

	for (var r = 0; r < rulesLen; ++r) {
		// Paths produced by each root rule of `nontermSym` are stored in separate sets of paths. Those sets map strings of terminal symbols to arrays of paths.
		var pathSets = {}
		pathTab.push(pathSets)

		// Recursively construct all possible expansions of `rootPath` using this rule, and add the new paths to `pathTab` for use by `findAmbiguity()` will use to search for ambiguous pairs.
		buildPath(pathSets, rootPath, rules[r])
	}

	// Search for ambiguity after constructing all paths.
	findAmbiguity(pathTab)
}

/**
 * Recursively constructs all possible expansions of `prevPath` using `rule`, which was produced by its rightmost nonterminal symbol. Adds the new paths to `pathSets` for use by `findAmbiguity()` to search for ambiguous pairs.
 *
 * @param {Object} pathSets The map of terminal strings to arrays of paths for a single root rule that produced `prevPath`.
 * @param {Object} prevPath The path to expand.
 * @param {Object} rule The rule with which to expand `prevPath`.
 */
function buildPath(pathSets, prevPath, rule) {
	// Create a new path by expanding `prevPath` with one of its productions, `rule`.
	var newPath = createPath(prevPath, rule)

	// Discard if semantically illegal parse.
	if (newPath === -1) return

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
		// The rules produced by `newPath.nextSym` from which to expand.
		var rules = ruleSets[newPath.nextSym]
		var rulesLen = rules.length

		// Recursively expand `newPath`.
		for (var r = 0; r < rulesLen; ++r) {
			buildPath(pathSets, newPath, rules[r])
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
	var newPath = {
		// The previous symbol whose rules this path can expand from.
		nextSym: undefined,
		// The reverse linked list of the second symbols of previously incomplete binary rules and yet-to-conjugate text objects from insertion rules. After reaching a terminal symbol, inspect `nextSyms` to complete the binary rules and conjugate the text objects.
		nextSyms: prevPath.nextSyms,
		// The number of elements in `nextSyms` excluding yet-to-conjugate text. Marks when a LHS semantic is visited, to determine when the semantic can be reduced after completely reducing its rule's RHS.
		nextSymsCount: prevPath.nextSymsCount,
		// The reverse linked list of yet-to-reduce semantics.
		semantics: undefined,
		// The path's display text.
		text: prevPath.text,
		// The reverse linked list of grammatical properties for yet-to-conjugate text in `nextSyms`.
		gramProps: prevPath.gramProps,
		// The string of terminal symbols in this path.
		terminals: prevPath.terminals,
		// The number of symbols used by this path, to ensure below `--tree-syms-limit`.
		symsCount: prevPath.symsCount + rule.RHS.length,
		// The path's RHS symbols. Combines with `prev` to form a reverse linked list from which to construct a path's parse tree graph representation.
		rule: rule,
		// The pointer to the previous path. This is used by `linkedListToGraph()` to construct a parse tree graph representation from this path.
		prev: prevPath,
	}

	// Nonterminal rule.
	if (!rule.isTerminal) {
		// Append `rule`'s semantics, if any, to `prevPath.semantics`.
		newPath.semantics = appendSemantic(prevPath.semantics, prevPath.nextSymsCount, rule)

		// Discard if semantically illegal parse.
		if (newPath.semantics === -1) return -1

		// Next nonterminal symbol this path can expand from.
		newPath.nextSym = rule.RHS[0]

		// Grammatical properties are only on nonterminal rules.
		if (rule.gramProps) {
			newPath.gramProps = {
				props: rule.gramProps,
				prev: prevPath.gramProps,
			}
		}

		// Non-edit rule.
		if (rule.insertionIdx === undefined) {
			if (rule.RHS.length === 2) {
				// If rule is binary, add the second RHS symbol to the list of `nextSyms`. The rule will resume after completing the branch produced by the first RHS symbol.
				newPath.nextSyms = {
					sym: rule.RHS[1],
					canProduceSemantic: rule.secondRHSCanProduceSemantic,
					prev: prevPath.nextSyms,
				}

				// If there will never be a semantic down the second branch of this binary rule, then a RHS semantic in the first branch can freely reduce with any preceding LHS semantic found before this rule. Else, prevent the first branch's RHS semantic(s) from reducing with LHS semantics found before this rule until parsing the second branch's semantic(s).
				if (rule.secondRHSCanProduceSemantic) {
					++newPath.nextSymsCount
				}
			}
		}

		// Insertion rule.
		else {
			// Insertions always have text.
			if (rule.insertionIdx === 1) {

				// Will conjugate text after completing first branch in this binary reduction. Used in nominative case, which relies on person-number in the first branch (verb precedes subject).
				newPath.nextSyms = {
					text: rule.text,
					prev: prevPath.nextSyms,
				}
			} else {
				// Copy `newPath.text` to avoid mutating the array shared with multiple paths.
				newPath.text = newPath.text.slice()
				newPath.text.push(conjugateText(newPath, rule.text))
			}
		}
	}

	// Terminal rule.
	else {
		// Append `sub`'s RHS semantics, if any, to `prevPath.semantics` and then reduce up to the first incompletely reduced node.
		newPath.semantics = reduceSemanticTree(prevPath.semantics, prevPath.nextSymsCount, rule.semantic)

		// Discard if semantically illegal parse.
		// This prevents certain instances of ambiguity from being printed. Although those parse trees would also be discarded in `forestSearch()`, they are still being constructed by `Parser` and their offending rules should be examined.
		if (newPath.semantics === -1) return -1

		// Append terminal symbol.
		newPath.terminals += ' ' + rule.RHS[0]

		// Prevent copying `newPath.text` multiple times.
		var textCopied = false

		// Append terminal rule text, if any; otherwise it is a stop word.
		var text = rule.text
		if (text) {
			// Copy `newPath.text` to avoid mutating the array shared with multiple paths.
			newPath.text = newPath.text.slice()
			textCopied = true

			newPath.text.push(conjugateText(newPath, text))
		}

		// After reaching the end of a branch, go the second symbol of the most recent binary rule.
		// In `forestSearch()`, this step occurs right before expanding a path instead of when the terminal rule is reached, as here, to avoid work on paths whose cost prevents them from ever being popped from the min-heap.
		var nextSyms = newPath.nextSyms
		while (nextSyms) {
			var text = nextSyms.text

			// Stop when at a node.
			if (!text) break

			if (!textCopied) {
				// Copy `newPath.text` to avoid mutating the array shared with multiple paths.
				newPath.text = newPath.text.slice()
				textCopied = true
			}

			// Append text from insertions of the second of two RHS symbols, performing any necessary conjugation. Conjugation occurs in the nominative case, which relies on the person-number of the first branch (verb precedes subject).
			newPath.text.push(conjugateText(newPath, text))

			nextSyms = nextSyms.prev
		}

		if (nextSyms) {
			// Get the second symbol of the most recent incomplete binary rule.
			newPath.nextSym = nextSyms.sym
			newPath.nextSyms = nextSyms.prev

			// Allow semantic reductions down this node's branch with LHS semantics that preceded this node. This required first parsing the parent binary node's first branch (i.e., this node's sibling).
			if (nextSyms.canProduceSemantic) {
				--newPath.nextSymsCount
			}
		} else {
			// No symbols remain.
			// `newPath.nextSymsCount`  equals 0.
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

						// `terminals`, `nextSym`, and `nextSyms` together are the rightmost symbols of the root symbol. If no nonterminal symbols remain to be reduced (as is always true with `--complete-trees`), then the rightmost symbols form what would be the parse input.
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
							var textsEquivalent = textsEqual(pathA.textAndSyms, pathB.textAndSyms)

							// A pair of paths is ambiguous when their rightmost symbols are identical and have identical semantic trees and/or identical display texts.
							if (!semanticsEquivalent && !textsEquivalent) continue

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
	if (argv.useTestRules && !foundAmbiguity && nontermSym.indexOf('ambig') === 1) {
		util.logError('Ambiguity not found in test rule:', nontermSym)
		throw 'Ambiguity example uncaught'
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
 * Concatenates a path's display text, text arrays of yet-to-reduce insertion rules, and yet-to-reduce nonterminal symbols. Merges adjacent strings to properly compare text items spanning multiple terminal rules; e.g., XY -> "x" "y" equals Z -> "x y".
 *
 * The display text can include unconjugated text objects because a path's root symbol can occur after where the necessary grammatical property occurs.
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
 * Converts a reverse linked list of path nodes, each containing the grammar rule used in its construction, to a graph representation.
 *
 * @param {Object} path The path to convert.
 * @returns {Object} Returns the parse tree graph representation of `path`.
 */
function linkedListToGraph(path) {
	var prevNodes = []

	while (true) {
		var rule = path.rule

		// Terminal rule.
		if (rule.isTerminal) {
			var node = {
				symbol: rule.RHS[0],
				// No `rule.text` for stop words.
				text: rule.text || '',
			}

			var parNode = {
				symbol: undefined,
				children: [ node ],
			}

			if (rule.isPlaceholder) {
				parNode.isPlaceholder = true
			}

			if (rule.semantic) {
				parNode.semantic = semantic.toString(rule.semantic)
			}

			prevNodes.push(parNode)
		}

		// Unary nonterminal rule.
		else if (rule.RHS.length === 1) {
			var node = prevNodes.pop() || {}
			node.symbol = rule.RHS[0]

			// Stop at tree root.
			if (!path.prev) {
				return node
			}

			var parNode = {
				symbol: undefined
			}

			if (rule.semantic) {
				parNode.semantic = semantic.toString(rule.semantic)
			}

			// Non-edit rule.
			if (rule.insertionIdx === undefined) {
				parNode.children = [ node ]
			}

			// Insertion rule.
			else {
				if (rule.insertedSemantic) {
					parNode.insertedSemantic = rule.insertedSemantic
				}

				// Arrange properties to display insertions in order.
				if (rule.insertionIdx === 1) {
					parNode.children = [ node ]
					parNode.text = rule.text
				} else {
					parNode.text = rule.text
					parNode.children = [ node ]
				}
			}

			prevNodes.push(parNode)
		}

		// Binary nonterminal rule.
		else {
			var nodeA = prevNodes.pop() || {}
			nodeA.symbol = rule.RHS[0]

			var nodeB = prevNodes.pop() || {}
			nodeB.symbol = rule.RHS[1]

			var parNode = {
				symbol: undefined,
				children: [ nodeA, nodeB ],
			}

			if (rule.semantic) {
				parNode.semantic = semantic.toString(rule.semantic)
			}

			prevNodes.push(parNode)
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

	while (stack.length > 0) {
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
 * Check if two nodes are equivalent. Nodes are equivalent if they have the same symbol and identical children (determined recursively).
 *
 * @param {Object} a The node to compare.
 * @param {Object} b The other node to compare.
 * @returns {boolean} Returns `true` if the nodes are equivalent, else `false`.
 */
function nodesEqual(a, b) {
	// Compare `symbol` for nodes or `text` for insertions.
	if (a.symbol !== b.symbol || a.text !== b.text) return false

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
 * If `ruleProps.semantic` exists and is reduced (i.e., RHS), then it is merged with the previous semantic if it too is reduced. Else if the previous semantic is not reduced and `ruleProps.rhsCanProduceSemantic` is `false`, then `ruleProps.semantic` is reduced with the previous semantic.
 *
 * If `ruleProps.insertedSemantic` exists, then it is a RHS semantic and `ruleProps.semantic` also exists and is a LHS semantic.
 *
 * Fails when appending a LHS semantic and the previous semantic is completely reduced (i.e., RHS), is identical to `ruleProps.semantic`, and multiple instances of the semantic are forbidden, and then returns `-1`.
 *
 * Fails when attempting to merge RHS semantics which would illegal (e.g., are duplicates), and then returns `-1`.
 *
 * @param {Object} prevSemantic The previous path's semantic linked list.
 * @param {number} nextSymsCount The number of symbols in the previous path's `nextSyms` that can produce a semantic. Used to determine if a RHS semantic is complete (no more semantics will follow it) and can be reduced with the preceding LHS semantic.
 * @param {Object} ruleProps The nonterminal rule's rule properties.
 * @param {Object[]} [ruleProps.semantic] The new nonterminal rule's semantic, if any.
 * @param {boolean} [ruleProps.semanticIsRHS] Specify `ruleProps.semantic` is a RHS semantic.
 * @param {Object[]} [ruleProps.insertedSemantic] A RHS semantic of an insertion rule which also contains LHS semantic.
 * @param {boolean} [ruleProps.rhsCanProduceSemantic] Specify the new nonterminal rule's RHS symbol can produce a semantic.
 * @returns {Object|number} Returns the semantic linked list if appendage is semantically legal, else `-1`.
 */
function appendSemantic(prevSemantic, nextSymsCount, ruleProps) {
	// If `ruleProps.insertedSemantic` exists, then it is a RHS semantic and `ruleProps.semantic` also exists and is a LHS semantic.
	if (ruleProps.insertedSemantic) {
		// Discard new LHS semantic if `prevSemantic` is completely reduced (i.e., RHS), is identical to `ruleProps.semantic`, and multiple instances of the semantic are forbidden.
		if (prevSemantic && prevSemantic.isRHS && semantic.isForbiddenMultiple(prevSemantic.semantic, ruleProps.semantic)) {
			return -1
		}

		return {
			semantic: ruleProps.insertedSemantic,
			isRHS: true,
			prev: {
				semantic: ruleProps.semantic,
				nextSymsCount: nextSymsCount,
				prev: prevSemantic,
			}
		}
	}

	if (ruleProps.semantic) {
		// `ruleProps.semantic` is RHS (i.e., reduced).
		if (ruleProps.semanticIsRHS) {
			if (prevSemantic) {
				if (prevSemantic.isRHS) {
					// Merge RHS (i.e., reduced) semantic with previous semantic if also reduced.
					var newSemantic = semantic.mergeRHS(prevSemantic.semantic, ruleProps.semantic)

					// Discard if RHS is semantically illegal (e.g., contains duplicates).
					if (newSemantic === -1) return -1

					return {
						semantic: newSemantic,
						isRHS: true,
						prev: prevSemantic.prev,
					}
				}

				if (!ruleProps.rhsCanProduceSemantic) {
					// RHS symbols cannot produce a semantic, then the rule's semantic can be reduced with the preceding LHS semantic before parsing the RHS symbols. This enables finding and discarding semantically illegal parses earlier than otherwise.
					return reduceSemanticTree(prevSemantic, nextSymsCount, ruleProps.semantic)
				}
			}

			return {
				semantic: ruleProps.semantic,
				isRHS: true,
				prev: prevSemantic,
			}
		}

		// `ruleProps.semantic` is LHS (i.e., not reduced).
		// Discard new LHS semantic if `prevSemantic` is completely reduced (i.e., RHS), is identical to `ruleProps.semantic`, and multiple instances of the semantic are forbidden.
		if (prevSemantic && prevSemantic.isRHS && semantic.isForbiddenMultiple(prevSemantic.semantic, ruleProps.semantic)) {
			return -1
		}

		return {
			semantic: ruleProps.semantic,
			nextSymsCount: nextSymsCount,
			prev: prevSemantic,
		}
	}

	// No new semantic to append.
	return prevSemantic
}

/**
 * Appends a terminal rule's RHS semantics, if any, to the previous path's semantic list, and then reduces the path's semantic tree up to the first incompletely reduced node.
 *
 * Merges the rule's semantic, if any, with the preceding RHS semantic(s), if any. Then reduces the RHS semantics with any preceding LHS semantics in the tree, up to a LHS semantic whose parse node has a second child node (i.e., a second branch) yet to be reduced. I.e., a LHS semantic can only be reduced after all of the RHS semantics have been found.
 *
 * Fails when attempting to merge RHS semantics which would illegal (e.g., are duplicates), and then returns `-1`.
 *
 * @param {Object} prevSemantic The previous path's semantic linked list.
 * @param {number} nextSymsCount The number of symbols in the previous path's `nextSyms` that can produce a semantic. Used to determine if a RHS semantic is complete (no more semantics will follow it) and can be reduced with the preceding LHS semantic.
 * @param {Object[]} [newSemantic] The RHS semantic of the terminal rule, if any.
 * @returns {Object|number} Returns the reduced semantic linked list if reduction is semantically legal, else `-1`.
 */
function reduceSemanticTree(prevSemantic, nextSymsCount, newSemantic) {
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
		else if (nextSymsCount <= prevSemantic.nextSymsCount) {
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
 * `text` can be a `string` not needing conjugation, an `Object` containing a term's inflected forms, or an `Array` of text strings and yet-to-conjugate text objects.
 *
 * If `text` is an `Array`, then it is being conjugated after completing an insertion rule's single branch's reduction that determines the person-number required for the nominative case in the second (inserted) branch (verb precedes subject).
 *
 * Conjugation will fail when the root symbol of `path` occurs after where the necessary grammatical property occurs, then returns `textObj`. This does not occur in a normal parse which begins at the start symbol.
 *
 * @param {Object} path The path containing the grammatical properties for conjugation, `path.gramProps`.
 * @param {string|Object|Array} text The rule's text string not needing conjugation, text object to conjugate, or array of text strings and objects to conjugate.
 * @returns {string|Object|Array} Returns `text`, conjugated if the necessary grammatical property exists.
 */
function conjugateText(path, text) {
	var textConstructor = text.constructor

	if (textConstructor === String) {
		// No conjugation.
		return text
	}

	if (textConstructor === Object) {
		// Conjugate `text`, which contains a term's inflected forms, if the necessary grammatical property exists
		return conjugateTextObject(path, text)
	}

	// Conjugate `text`, which is an insertion's array of text strings and yet-to-conjugate text objects. This array will never contains other arrays.
	var textArray = []

	for (var t = 0, textLen = text.length; t < textLen; ++t) {
		textArray.push(conjugateText(path, text[t]))
	}

	// This array is flattened in `concatTextAndNextSyms()` (which yields fewer operations than if concatenated to `path.text` here).
	return textArray
}

/**
 * Conjugates `textObj` to a term's correct inflection according to the grammatical properties in `path.gramProps`. Finds the most recent path in the reverse linked list `path.gramProps` that calls for a grammatical property in `textObj`. Removes the `gramProps` path from the list after conjugation. Does not allow for use of the same property in multiple places.
 *
 * Conjugation will fail when the root symbol of `path` occurs after where the necessary grammatical property occurs, then returns `textObj`. This does not occur in a normal parse which begins at the start symbol.
 *
 * @param {Object} path The path containing the grammatical properties for conjugation, `path.gramProps`.
 * @param {Object} textObj The text object, containing a term's different inflected forms, to conjugate.
 * @returns {string|Object} Returns the conjugated string if the necessary grammatical property exists, else `textObj`.
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

/**
 * Deletes the transposition rules from the grammar's rules, `ruleSets`.
 *
 * Do not inspect transpositions because any ambiguity they create is evident in the original rules from which they were derived.
 *
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules to purge.
 */
function deleteTranspositionRules(ruleSets) {
	for (var nontermSym in ruleSets) {
		var rules = ruleSets[nontermSym]

		for (var r = 0; r < rules.length; ++r) {
			if (rules[r].isTransposition) {
				// Delete rule.
				rules.splice(r, 1)
				--r
			}
		}
	}
}