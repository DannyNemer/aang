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
 *   This module was a massive undertaking. All 32 cases of possible ambiguity are meticulously
 *   documented in detail in 'ambiguityTests.js'. Many algorithms were created and ensured to
 *   catch all possible ambiguous cases. Several algorithms, unique data structures, and
 *   heuristics were developed to make the construction of all possible paths and the comparison
 *   of paths as fast as possible. Many trials and errors. It was well over 100 hours of arduous
 *   research and development.
 *
 * Options
 *   -n, --tree-sym-limit  The maximum number of symbols permitted in the construction of a path
 *                         when searching for ambiguity, limiting processing time. This bound is
 *                         necessary, as the grammar permits paths of infinite length and
 *                         combination.                                               [default: 9]
 *   -c, --complete-trees  Specify requiring parse trees to completely reduce, with no nonterminal
 *                         symbols remaining to parse, to be examined for ambiguity. This yields
 *                         output that can be easier to understand, however, requires a greater
 *                         `--tree-sym-limit` value than otherwise to find the same instances of
 *                         ambiguity.                                    [boolean] [default: true]
 *   -a, --find-all        Specify finding every distinct pair of ambiguous trees instead of one
 *                         instance per each pair of rules. Often, this is superfluous for
 *                         determining the necessary changes to make to the grammar. This can be
 *                         helpful, however, as the grammatical change required might not be in a
 *                         root rule, but rather in a subsequent rule only demonstrated when used
 *                         with this root rule. For certain cases with `--find-all`, such as
 *                         recursive rules (i.e., a rule whose RHS contains the LHS), an excessive
 *                         number of ambiguity instances are printed.                    [boolean]
 *   -s, --semantic-check  Specify checking every path for illegal semantics when forcefully and
 *                         completely reduced (i.e., reduced irrespective of parsing state and
 *                         semantic argument requirements). This exposes illegal semantics that
 *                         should be detected and discarded earlier.                     [boolean]
 *   -t, --use-test-rules  Specify replacing the grammar with the ambiguous test rules, defined
 *                         and documented in 'ambiguityTests.js', to check the accuracy of this
 *                         algorithm.                                                    [boolean]
 *   -q, --quiet           Specify suppressing program output.                           [boolean]
 *   -h, --help            Display this screen.                                          [boolean]
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
		'  This module was a massive undertaking. All 32 cases of possible ambiguity are meticulously documented in detail in \'ambiguityTests.js\'. Many algorithms were created and ensured to catch all possible ambiguous cases. Several algorithms, unique data structures, and heuristics were developed to make the construction of all possible paths and the comparison of paths as fast as possible. Many trials and errors. It was well over 100 hours of arduous research and development.',
	].join('\n'))
	.updateStrings({
		'Options:': util.colors.bold('Options'),
	})
	.options({
		'n': {
			alias: 'tree-sym-limit',
			description: 'The maximum number of symbols permitted in the construction of a path when searching for ambiguity, limiting processing time. This bound is necessary, as the grammar permits paths of infinite length and combination.',
			requiresArg: true,
			default: 9,
		},
		'c': {
			alias: 'complete-trees',
			description: 'Specify requiring parse trees to completely reduce, with no nonterminal symbols remaining to parse, to be examined for ambiguity. This yields output that can be easier to understand, however, requires a greater `--tree-sym-limit` value than otherwise to find the same instances of ambiguity.',
			type: 'boolean',
			default: true,
		},
		'a': {
			alias: 'find-all',
			description: 'Specify finding every distinct pair of ambiguous trees instead of one instance per each pair of rules. Often, this is superfluous for determining the necessary changes to make to the grammar. This can be helpful, however, as the grammatical change required might not be in a root rule, but rather in a subsequent rule only demonstrated when used with this root rule. For certain cases with `--find-all`, such as recursive rules (i.e., a rule whose RHS contains the LHS), an excessive number of ambiguity instances are printed.',
			type: 'boolean',
		},
		's': {
			alias: 'semantic-check',
			description: 'Specify checking every path for illegal semantics when forcefully and completely reduced (i.e., reduced irrespective of parsing state and semantic argument requirements). This exposes illegal semantics that should be detected and discarded earlier.',
			type: 'boolean',
		},
		't': {
			alias: 'use-test-rules',
			description: 'Specify replacing the grammar with the ambiguous test rules, defined and documented in \'ambiguityTests.js\', to check the accuracy of this algorithm.',
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
		if (isNaN(argv.treeSymLimit)) {
			throw 'TypeError: \'--tree-sym-limit\' must be a number'
		}

		if (argv.useTestRules && argv.treeSymLimit < 9) {
			throw 'Error: \'--tree-sym-limit\' must be >= 9 when passing \'--use-test-rules\''
		}

		return true
	})
	// Fail on unrecognized arguments.
	.strict()
	.wrap(Math.min(yargs.terminalWidth(), 95))
	.argv

// Modify stack trace format (when printing) to color function names and not surround file paths with parentheses.
util.prettifyStackTrace()

var semantic = require('../grammar/semantic')

// If `--test-rules` is passed, use the ambiguous test rules to check the accuracy of this algorithm.
var grammar = argv.useTestRules ? require('./ambiguityTests') : require('../grammar.json')

// Initialize the semantics of rules in `grammar` for parsing by replacing identical semantic functions, semantic nodes, and semantic arrays with references to the same object.
require('../parse/initSemantics')(grammar)

var ruleSets = grammar.ruleSets

util.time('Ambiguity check')

// Do not inspect transpositions because any ambiguity they create is evident in the original rules from which they were derived. Remove rules to avoid checking each rule multiple times within the recrusive function, `buildPath()`.
deleteTranspositionRules(ruleSets)

// Construct all possible paths from `nontermSym`.
for (var nontermSym in ruleSets) {
	searchPaths(nontermSym)
}

if (argv.useTestRules) {
	util.logSuccess('All tests passed.')
}

util.log('Tree symbols limit:', argv.treeSymLimit)
util.timeEnd('Ambiguity check')
util.countEndAll()

/**
 * Checks for ambiguity created by `nontermSym`'s rules. Compares paths created by each rule from `nontermSym` to paths created by `nontermSym`'s other rules. Does not compare paths produced by the same initial rule because if ambiguity exists there, then it is caused by another symbol.
 *
 * Initializes the paths from ``nontermSym`, but calls `buildPath()` to recursively expand the paths.
 *
 * @private
 * @static
 * @param {string} nontermSym The nonterminal symbol from which to search for ambiguity.
 */
function searchPaths(nontermSym) {
	// The rules produced by `nontermSym` from which to expand.
	var rules = ruleSets[nontermSym]
	var rulesLen = rules.length

	// Exit if there is only one (non-transposition) rule produced by `nontermSym` because at least two rules are required for ambiguity to exist.
	// If `--semantic-check` is `true`, then build and inspect every path.
	if (!argv.semanticCheck && rulesLen === 1) return

	// The store of all paths from `nontermSym`. Each index contains a set of arrays of paths, one set for each rule from `nontermSym`. Each set is a map of terminal strings to the arrays of paths.
	var pathTab = []

	var rootPath = {
		// The previous symbol whose rules this path can expand from.
		curSym: undefined,
		// The linked list of yet-to-parse second nodes of previous binary rules and yet-to-conjugate text objects of previous insertion rules. When `curSym` is `undefined` after reaching a terminal symbol, inspect `nextItemList` to complete the binary rules and conjugate the text objects.
		nextItemList: undefined,
		// The reverse linked list of yet-to-reduce semantics.
		semanticList: undefined,
		// The path's display text.
		text: [],
		// The reverse linked list of person-number properties to conjugate text objects.
		personNumberList: undefined,
		// The grammatical properties to conjugate text of terminal rules in `curNode.subs`.
		gramProps: undefined,
		// The string of terminal symbols in this path.
		terminals: '',
		// The number of symbols used by this path, to ensure below `--tree-sym-limit`.
		symCount: 1,
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
	if (!argv.semanticCheck) {
		findAmbiguity(pathTab)
	}
}

/**
 * Recursively constructs all possible expansions of `prevPath` using `rule`, which was produced by its rightmost nonterminal symbol. Adds the new paths to `pathSets` for use by `findAmbiguity()` to search for ambiguous pairs.
 *
 * @private
 * @static
 * @param {Object} pathSets The map of terminal strings to arrays of paths for a single root rule that produced `prevPath`.
 * @param {Object} prevPath The path to expand.
 * @param {Object} rule The rule with which to expand `prevPath`.
 */
function buildPath(pathSets, prevPath, rule) {
	// Create a new path by expanding `prevPath` with one of its productions, `rule`.
	var newPath = createPath(prevPath, rule)

	// Discard if semantically illegal parse.
	if (newPath === -1) return

	// If `--semantic-check` is `true`, then check every path for illegal semantics when forcefully and completely reduced (i.e., reduced irrespective of parsing state and semantic argument requirements). This exposes illegal semantics that should be detected and discarded earlier.
	if (argv.semanticCheck && completeSemanticTree(newPath.semanticList, newPath) === -1) {
		return
	}

	// Add new path to set of paths from this root rule with these terminal symbols.
	// `--complete-trees` specifies only examining completely-reduced parse trees.
	if (!argv.completeTrees || !newPath.curSym) {
		var paths = pathSets[newPath.terminals]
		if (paths) {
			paths.push(newPath)
		} else {
			pathSets[newPath.terminals] = [ newPath ]
		}
	}

	// If the path has not reached all terminal symbols (i.e., has a `curSym`), and is below `--tree-sym-limit` (otherwise will build infinite paths), then continue to expand path.
	if (newPath.curSym && newPath.symCount < argv.treeSymLimit) {
		// The rules produced by `newPath.curSym` from which to expand.
		var rules = ruleSets[newPath.curSym]
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
 * @private
 * @static
 * @param {Object} prevPath THe previous path from which to expand.
 * @param {Object} rule The produced by rule `prevPath`'s last symbol.
 * @returns {Object|number}Returns the new path if semantically legal, else `-1`.
 */
function createPath(prevPath, rule) {
	var prevNextItemList = prevPath.nextItemList

	var newPath = {
		// The previous symbol whose rules this path can expand from.
		curSym: undefined,
		// The linked list of yet-to-parse second nodes of previous binary rules and yet-to-conjugate text objects of previous insertion rules. When `curSym` is `undefined` after reaching a terminal symbol, inspect `nextItemList` to complete the binary rules and conjugate the text objects.
		nextItemList: prevPath.nextItemList,
		// The reverse linked list of yet-to-reduce semantics.
		semanticList: undefined,
		// The path's display text.
		text: prevPath.text,
		// The reverse linked list of person-number properties to conjugate text objects.
		personNumberList: prevPath.personNumberList,
		// The grammatical properties to conjugate text of terminal rules in `curNode.subs`.
		gramProps: undefined,
		// The string of terminal symbols in this path.
		terminals: prevPath.terminals,
		// The number of symbols used by this path excluding `<blank>`, to ensure below `--tree-sym-limit`.
		symCount: prevPath.symCount + (rule.insertedSymIdx === undefined ? rule.RHS.length : 1),
		// The path's RHS symbols. Combines with `prev` to form a reverse linked list from which to construct a path's parse tree graph representation.
		rule: rule,
		// The pointer to the previous path. This is used by `linkedListToGraph()` to construct a parse tree graph representation from this path.
		prev: prevPath,
	}

	// Nonterminal rule.
	if (!rule.isTerminal) {
		// Append `rule`'s semantics, if any, to `prevPath.semanticList`.
		newPath.semanticList = appendSemantic(prevPath.semanticList, prevNextItemList ? prevNextItemList.symCount : 0, rule)

		// Discard if semantically illegal parse.
		if (newPath.semanticList === -1) return -1

		// The next nonterminal symbol this path can expand from.
		newPath.curSym = rule.RHS[0]

		// The grammatical properties (`case`, `tense`, and `acceptedTense`) used to conjugate terminal rules produced by `newPath.curNode` (and its sibling node if this is a binary rule). Only occurs on nonterminal rules.
		newPath.gramProps = rule.gramProps

		// Append person-number property to linked list for conjugation of next terminal symbol if it is a verb.
		if (rule.personNumber) {
			var nextItemListSize = prevNextItemList ? prevNextItemList.size : -1
			var prev = prevPath.personNumberList

			newPath.personNumberList = {
				// The person-number property for conjugation.
				personNumber: rule.personNumber,
				// The number of items in `newPath.nextItemList` at the position of the person-number property's definition in the parse tree. Used to determine if the following branches, which are associated with this person-number property, are complete and that this property can conjugate any successive terminal symbols for verbs.
				nextItemListSize: nextItemListSize,
				// The previous person-number property, not saved if for a previously completed subtree.
				prev: prev && prev.nextItemListSize <= nextItemListSize ? prev : undefined,
			}
		}

		// Non-edit rule.
		if (rule.insertedSymIdx === undefined) {
			if (rule.RHS.length === 2) {
				// All binary rules are nonterminal rules. Prepend the second RHS symbol to `nextItemList`, and complete the rule after completing the branch produced by the first RHS symbol.
				if (prevNextItemList) {
					newPath.nextItemList = {
						// The second symbol of this binary rule to parse after completing the first symbol's branch.
						sym: rule.RHS[1],
						// The path's grammatical properties (`case`, `tense`, and `acceptedTense`) used to conjugate terminal rules produced by `node`.
						gramProps: newPath.gramProps,
						// The number of symbols in the `nextItemList` that can produce a semantic. This excludes other symbols and yet-to-conjugate text. Used to determine if a RHS semantic is complete (no more semantics will follow it) and can be reduced with the preceding LHS semantic.
						// If `rule.secondRHSCanProduceSemantic` is `false`, then there will never be a semantic down the second branch of this binary rule, and a RHS semantic in the first branch can freely reduce with any preceding LHS semantic found before this rule. Else, prevent the first branch's RHS semantic(s) from reducing with LHS semantics found before this rule.
						symCount: prevNextItemList.symCount + Number(rule.secondRHSCanProduceSemantic),
						// The number of items in `nextItemList`.
						size: prevNextItemList.size + 1,
						// The next item that follows after completing this branch, created from the previous binary or insertion rule.
						next: prevNextItemList,
					}
				} else {
					newPath.nextItemList = {
						sym: rule.RHS[1],
						gramProps: newPath.gramProps,
						symCount: Number(rule.secondRHSCanProduceSemantic),
						size: 1,
					}
				}
			}
		}

		// Insertion rule.
		// Insertions only exist on nonterminal rules because they can only be built from binary rules. This might change if we enable terminal symbols to be in a RHS with another terminal or nonterminal symbol (or multiple).
		else {
			// Insertions always have text. Edit rules can be made from insertions and lack text, but they behave as normal rules (with `insertedSymIdx`).
			if (rule.insertedSymIdx === 1) {
				// Will conjugate text after completing first branch in this binary reduction. Used in nominative case, which relies on person-number in the first branch (verb precedes subject).
				if (prevNextItemList) {
					newPath.nextItemList = {
						// The display text to append after completing the first branch and determining the person-number property for conjugation, if necessary.
						text: rule.text,
						// The number of nodes in the `nextItemList` that can produce a semantic. This excludes other nodes and yet-to-conjugate text. Used to determine if a RHS semantic is complete (no more semantics will follow it) and can be reduced with the preceding LHS semantic.
						symCount: prevNextItemList.symCount,
						// The number of items in `nextItemList`.
						size: prevNextItemList.size + 1,
						// The next item that follows after completing this branch, created from the previous binary or insertion rule.
						next: prevNextItemList,
					}
				} else {
					newPath.nextItemList = {
						text: rule.text,
						symCount: 0,
						size: 1,
					}
				}
			} else {
				// Copy `newPath.text` to avoid mutating the array shared with multiple paths.
				newPath.text = newPath.text.slice()

				// Append text, if any, to the previous path's text, performing any necessary person-number conjugation.
				// Do not pass the parent rule's `gramProps` because that conjugation was performed during the insertion rule's compilation.
				newPath.text.push(conjugateText(rule.text, newPath.personNumberList))
			}
		}
	}

	// Terminal rule.
	else {
		// Append `sub`'s RHS semantics, if any, to `prevPath.semanticList` and then reduce up to the first incompletely reduced node.
		newPath.semanticList = reduceSemanticTree(prevPath.semanticList, prevNextItemList ? prevNextItemList.symCount : 0, rule.semantic)

		// Discard if semantically illegal parse.
		// This prevents certain instances of ambiguity from being printed. Although those parse trees would also be discarded in `pfsearch`, they are still being constructed by `Parser` and their offending rules should be examined.
		if (newPath.semanticList === -1) return -1

		// Append terminal symbol.
		newPath.terminals += ' ' + rule.RHS[0]

		// Prevent copying `newPath.text` multiple times.
		var textCopied = false

		// Append terminal rule text, if any; otherwise it is a stop word.
		if (rule.text) {
			// Copy `newPath.text` to avoid mutating the array shared with multiple paths.
			newPath.text = newPath.text.slice()
			textCopied = true

			newPath.text.push(conjugateText(rule.text, newPath.personNumberList, prevPath.gramProps, rule.tense))
		} else if (rule.isPlaceholder) {
			newPath.text = newPath.text.slice()
			textCopied = true

			// Add placeholder terminal symbol, which normally is be replaced with input.
			newPath.text.push(rule.RHS[0])
		}

		// The most recent yet-to-parse node of a previous binary rule or a yet-to-conjugate text object of a previous insertion rule.
		var nextItemList = newPath.nextItemList

		// The most recent person-number property.
		var personNumberList = newPath.personNumberList

		// After reaching the end of a branch, get the next node in `newPath.nextItemList` while conjugating any preceding inserted text objects. In `pfsearch`, this operation occurs right before expanding a path instead of when the terminal rule is reached, as here, to avoid work on paths whose cost prevents them from ever being popped from the min-heap.
		while (nextItemList) {
			var text = nextItemList.text

			// Stop at a node.
			if (!text) break

			if (!textCopied) {
				// Copy `newPath.text` to avoid mutating the array shared with multiple paths.
				newPath.text = newPath.text.slice()
				textCopied = true
			}

			// Remove person-number properties for previously completed subtrees.
			personNumberList = unwindPersonNumberList(personNumberList, nextItemList.size)

			// Append text from insertions of the second of two RHS symbols, performing any necessary conjugation. Conjugation occurs in the nominative case, which relies on the person-number of the first branch (verb precedes subject).
			// Do not pass the parent rule's `gramProps` because that conjugation was performed in the compilation of the insertion rule.
			newPath.text.push(conjugateText(text, personNumberList))

			nextItemList = nextItemList.next
		}

		if (nextItemList) {
			// Get the second symbol of the most recent incomplete binary rule.
			newPath.curSym = nextItemList.sym
			newPath.nextItemList = nextItemList.next

			// Remove person-number properties for previously completed subtrees.
			newPath.personNumberList = unwindPersonNumberList(personNumberList, nextItemList.size)

			// The path's grammatical properties (`case`, `tense`, and `acceptedTense`) used to conjugate the second symbol of this binary rule, if applicable (i.e., a terminal rule).
			newPath.gramProps = nextItemList.gramProps
		} else {
			// No symbols remain.
			newPath.nextItemList = undefined
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
 * @private
 * @static
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
					return a.symCount - b.symCount
				})

				// Compare paths among this pair of root rules which have identical terminal rules.
				for (var p = 0, pathsALen = pathsA.length; p < pathsALen; ++p) {
					var pathA = pathsA[p]
					var curSym = pathA.curSym
					var nextItemList = pathA.nextItemList

					for (var o = 0; o < pathsBLen; ++o) {
						var pathB = pathsB[o]

						// `terminals`, `curSym`, and `nextItemList` together are the rightmost symbols of the root symbol. If no nonterminal symbols remain to be reduced (as is always true with `--complete-trees`), then the rightmost symbols form what would be the parse input.
						if (pathB.curSym === curSym && nextSymsEqual(pathB.nextItemList, nextItemList)) {
							// Save the following properties to prevent repeating the operations for multiple comparisons.
							if (!pathA.textAndSyms) {
								// Completely reduce semantic trees irrespective of parsing state and semantic argument requirements. This is necessary for comparisons.
								pathA.semanticTree = completeSemanticTree(pathA.semanticList, pathA)

								// Discard if semantic is illegal.
								if (pathA.semanticTree === -1) continue

								// Concatenate each path's display texts, text arrays of yet-to-reduce insertion rules, and yet-to-reduce nonterminal symbols. Merge adjacent strings to properly compare text items spanning multiple terminal rules; e.g., XY -> "x" "y" equals Z -> "x y".
								// Include yet-to-reduce nonterminal symbols to prevent merging non-adjacent insertion texts. These nonterminal symbols have already been identified as identical to the other path.
								pathA.textAndSyms = concatTextAndNextSyms(pathA)
							}

							// Save the following properties to prevent repeating the operations for multiple comparisons.
							if (!pathB.textAndSyms) {
								// Completely reduce semantic trees irrespective of parsing state and semantic argument requirements.
								pathB.semanticTree = completeSemanticTree(pathB.semanticList, pathB)

								// Discard if semantic is illegal.
								if (pathB.semanticTree === -1) continue

								// Concatenate each path's display texts, text arrays of yet-to-reduce insertion rules, and yet-to-reduce nonterminal symbols.
								pathB.textAndSyms = concatTextAndNextSyms(pathB)
							}

							// Check if semantic trees are identical. A pair of paths is ambiguous even if semantics of both are `undefined`.
							var semanticsEquivalent = semantic.arraysEqual(pathA.semanticTree, pathB.semanticTree)

							// Check if display texts, including yet-to-conjugate text objects and insertion texts of yet-to-reduce rules, are identical.
							var textsEquivalent = textsEqual(pathA.textAndSyms, pathB.textAndSyms)

							// A pair of paths is ambiguous when their rightmost symbols are identical and their semantics and/or identical display texts are identical.
							if (semanticsEquivalent || textsEquivalent) {
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
										util.log(util.colors.yellow('Ambiguity') + ':', util.stylize(pathA.terminals.slice(1)))
										util.log('  Text:', pathA.textAndSyms)
										util.log('  Semantic:', pathA.semanticTree === -1 ? -1 : (pathA.semanticTree ? semantic.colorString(semantic.toString(pathA.semanticTree)) : undefined))
										util.dir('  ', treeA)
										util.log()
										util.log('  Text:', pathB.textAndSyms)
										util.log('  Semantic:', pathB.semanticTree === -1 ? -1 : (pathB.semanticTree ? semantic.colorString(semantic.toString(pathB.semanticTree)) : undefined))
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
					}

					if (o < pathsBLen) break
				}

				if (p < pathsALen) break
			}
		}
	}

	// If `--test-rules` is passed, then use the ambiguous test rules to check the accuracy of this algorithm.
	if (argv.useTestRules) {
		if (!foundAmbiguity && /^\[ambig-/.test(nontermSym)) {
			util.logError('Ambiguity not found for ambiguous test rule:', util.stylize(nontermSym))
			process.exit(1)
		} else if (foundAmbiguity && /^\[unambig-/.test(nontermSym)) {
			util.logError('Ambiguity found for unambiguous test rule:', util.stylize(nontermSym))
			process.exit(1)
		}
	}
}

/**
 * Compares two paths' `nextItemList` linked lists of symbols and yet-to-conjugate text, ignoring the instances of text, to determine if the symbols are equivalent.
 *
 * @private
 * @static
 * @param {Object} a The `nextItemList` list to compare.
 * @param {Object} b The other `nextItemList` list to compare.
 * @returns {boolean} Returns `true` if the lists' symbols, ignoring instances of text, are equivalent, else `false`.
 */
function nextSymsEqual(a, b) {
	// Ignore instances of yet-to-conjugate text.
	while (a && !a.sym) {
		a = a.next
	}

	// Ignore instances of yet-to-conjugate text.
	while (b && !b.sym) {
		b = b.next
	}

	// Same linked list items or both `undefined`; i.e., reached the ends of both lists without finding a difference.
	if (a === b) return true

	// One of the lists is longer than the other.
	if (!a || !b) return false

	// Check if symbols are identical.
	if (a.sym !== b.sym) return false

	// Examine previous item in list.
	return nextSymsEqual(a.next, b.next)
}

/**
 * Compares two paths' `nextItemList` linked lists of symbols and yet-to-conjugate text, ignoring the instances of symbols, to determine if the text values are equivalent.
 *
 * This function was deprecated in favor of comparing the paths' output of `concatTextAndNextSyms()`
 *
 * @private
 * @static
 * @param {Object} a The `nextItemList` list to compare.
 * @param {Object} b The other `nextItemList` list to compare.
 * @returns {boolean} Returns `true` if the lists' text, ignoring instances of symbols, are equivalent, else `false`.
 */
function nextTextsEqual(a, b) {
	// Ignore instances of yet-to-reduce symbols.
	while (a && !a.text) {
		a = a.next
	}

	// Ignore instances of yet-to-reduce symbols.
	while (b && !b.text) {
		b = b.next
	}

	// Same linked list items or both `undefined`; i.e., reached the ends of both lists without finding a difference.
	if (a === b) return true

	// One of the lists is longer than the other.
	if (!a || !b) return false

	// Check if text values are identical.
	if (!textsEqual(a.text, b.text)) return false

	// Examine previous item in list.
	return nextTextsEqual(a.next, b.next)
}

/**
 * Concatenates a path's display text, text arrays of yet-to-reduce insertion rules, and yet-to-reduce nonterminal symbols. Merges adjacent strings to properly compare text items spanning multiple terminal rules; e.g., XY -> "x" "y" equals Z -> "x y".
 *
 * The display text can include unconjugated text objects because a path's root symbol can occur after where the necessary grammatical property occurs.
 *
 * Includes yet-to-reduce nonterminal symbols to prevent merging non-adjacent insertion texts. These nonterminal symbols have already been identified as identical to the other path being compared with this path.
 *
 * @private
 * @static
 * @param {Object} path The path whose value to concatenate.
 * @returns {Array} Returns a new array with concatenated values.
 */
function concatTextAndNextSyms(path) {
	// Do not mutate `text` because it can be shared with other paths.
	var items = path.text.slice()

	// Include yet-to-reduce nonterminal symbols to prevent merging non-adjacent insertion texts.
	if (path.curSym) {
		items.push(path.curSym)
	}

	var item = path.nextItemList
	while (item) {
		var itemText = item.text

		if (itemText instanceof Array) {
			// Merge contents of insertion text arrays.
			Array.prototype.push.apply(items, itemText)
		} else {
			// Include yet-to-reduce nonterminal symbols and text arrays of yet-to-reduce insertion rules.
			items.push(item.sym || itemText)
		}

		item = item.next
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
 * @private
 * @static
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
 * @private
 * @static
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

		// Insertion rule.
		else if (rule.insertedSymIdx !== undefined) {
			var node = prevNodes.pop() || {}
			node.symbol = rule.RHS[0]

			var parNode = {
				symbol: undefined
			}

			if (rule.semantic) {
				parNode.semantic = semantic.toString(rule.semantic)
			}

			if (rule.insertedSemantic) {
				parNode.insertedSemantic = semantic.toString(rule.insertedSemantic)
			}

			// Arrange properties to display insertions in order.
			if (rule.insertedSymIdx === 1) {
				parNode.children = [ node ]
				parNode.text = rule.text
				parNode.insertedBlank = rule.RHS.length === 2
			} else {
				parNode.text = rule.text
				parNode.children = [ node ]
			}

			prevNodes.push(parNode)
		}

		// Non-edit unary nonterminal rule.
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

			parNode.children = [ node ]

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
 * @private
 * @static
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
 * @private
 * @static
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
 * @private
 * @static
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
 * @private
 * @static
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
 * Fails if resulting semantic is illegal (e.g., duplicates within a RHS semantic), and then returns `-1`.
 *
 * @private
 * @static
 * @param {Object} prevSemantic The previous path's semantic linked list.
 * @param {number} nextSymCount The number of symbols in the previous path's `nextItemList` that can produce a semantic. Used to determine if a RHS semantic is complete (no more semantics will follow it) and can be reduced with the preceding LHS semantic.
 * @param {Object} ruleProps The nonterminal rule's rule properties.
 * @param {Object[]} [ruleProps.semantic] The new nonterminal rule's semantic, if any.
 * @param {boolean} [ruleProps.semanticIsRHS] Specify `ruleProps.semantic` is a RHS semantic.
 * @param {Object[]} [ruleProps.insertedSemantic] A RHS semantic of an insertion rule which also contains LHS semantic.
 * @param {boolean} [ruleProps.rhsCanProduceSemantic] Specify the new nonterminal rule's RHS symbol can produce a semantic.
 * @returns {Object|number} Returns the semantic linked list if appendage is semantically legal, else `-1`.
 */
function appendSemantic(prevSemantic, nextSymCount, ruleProps) {
	// If `ruleProps.insertedSemantic` exists, then it is a RHS semantic and `ruleProps.semantic` also exists and is a LHS semantic.
	if (ruleProps.insertedSemantic) {
		return {
			// The RHS semantic.
			semantic: ruleProps.insertedSemantic,
			isRHS: true,
			prev: {
				// The LHS semantic.
				semantic: ruleProps.semantic,
				// The number of yet-to-parse second nodes of previous binary rules that produce semantics. Used to determine if the branches that follow this semantic are complete and that this semantic may be reduced with a RHS semantic.
				nextSymCount: nextSymCount,
				prev: prevSemantic,
			}
		}
	}

	if (ruleProps.semantic) {
		// `ruleProps.semantic` is RHS (i.e., reduced).
		if (ruleProps.semanticIsRHS) {
			if (prevSemantic) {
				if (!ruleProps.rhsCanProduceSemantic) {
					// No semantics can follow this node/branch. Hence, the rule's semantic can be reduced with the preceding LHS semantic before parsing the RHS nodes. This enables finding and discarding semantically illegal parses earlier than otherwise.
					return reduceSemanticTree(prevSemantic, nextSymCount, ruleProps.semantic)
				}

				if (prevSemantic.isRHS) {
					// Merge RHS (i.e., reduced) semantic with previous semantic if also reduced.
					var newRHSSemantic = semantic.mergeRHS(prevSemantic.semantic, ruleProps.semantic)

					// Discard if RHS is semantically illegal (e.g., contains duplicates).
					if (newRHSSemantic === -1) return -1

					return {
						// The RHS semantic.
						semantic: newRHSSemantic,
						isRHS: true,
						prev: prevSemantic.prev,
					}
				}

				// Check if reducing `ruleProps.semantic` with LHS `prevSemantic` and merging the resulting semantic with RHS `prevSemantic.prev` will produce an illegal semantic.
				if (isIllegalSemanticReduction(prevSemantic, ruleProps.semantic)) {
					return -1
				}
			}

			return {
				// The RHS semantic.
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
			// The LHS semantic.
			semantic: ruleProps.semantic,
			// The number of yet-to-parse second nodes of previous binary rules that produce semantics. Used to determine if the branches that follow this semantic are complete and that this semantic may be reduced with a RHS semantic.
			nextSymCount: nextSymCount,
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
 * Fails if resulting semantic is illegal (e.g., duplicates within a RHS semantic), and then returns `-1`.
 *
 * @private
 * @static
 * @param {Object} prevSemantic The previous path's semantic linked list.
 * @param {number} nextSymCount The number of symbols in the previous path's `nextItemList` that can produce a semantic. Used to determine if a RHS semantic is complete (no more semantics will follow it) and can be reduced with the preceding LHS semantic.
 * @param {Object[]} [newRHSSemantic] The terminal rules' RHS semantic.
 * @returns {Object|number} Returns the reduced semantic linked list if reduction is semantically legal, else `-1`.
 */
function reduceSemanticTree(prevSemantic, nextSymCount, newRHSSemantic) {
	// Reduce the semantic tree up to a LHS semantic whose parse node has a second child node (i.e., a second branch) yet to be reduced.
	while (prevSemantic) {
		// Merge RHS semantics.
		if (prevSemantic.isRHS) {
			if (newRHSSemantic) {
				newRHSSemantic = semantic.mergeRHS(prevSemantic.semantic, newRHSSemantic)

				// Discard if RHS is semantically illegal (e.g., contains duplicates).
				if (newRHSSemantic === -1) return -1
			} else {
				newRHSSemantic = prevSemantic.semantic
			}
		}

		// Reduce the LHS semantic after parsing the right-most branch that follows the semantic.
		else if (nextSymCount <= prevSemantic.nextSymCount) {
			// A semantic function without arguments - currently can only be `intersect()`.
			// This will need to be modified if we incorporate semantic functions that don't require arguments.
			if (!newRHSSemantic) return -1

			newRHSSemantic = semantic.reduce(prevSemantic.semantic, newRHSSemantic)

			// Discard if reduction is semantically illegal (e.g., LHS forbids multiple arguments but RHS is multiple semantics).
			if (newRHSSemantic === -1) return -1
		}

		// Check if reducing `newRHSSemantic` with LHS `prevSemantic` and merging the resulting semantic with RHS `prevSemantic.prev` will produce an illegal semantic.
		else if (newRHSSemantic && isIllegalSemanticReduction(prevSemantic, newRHSSemantic)) {
			return -1
		}

		// Stop at a LHS semantic whose parse node has yet-to-reduce child nodes.
		else {
			break
		}

		prevSemantic = prevSemantic.prev
	}

	if (newRHSSemantic) {
		return {
			// The RHS semantic.
			semantic: newRHSSemantic,
			isRHS: true,
			prev: prevSemantic,
		}
	} else {
		return prevSemantic
	}
}

/**
 * Checks if reducing `newRHSSemantic` with LHS `prevSemantic` and merging the resulting semantic with RHS `prevSemantic.prev` will produce an illegal semantic.
 *
 * LHS `prevSemantic` cannot reduce with `newRHSSemantic` because another semantic can come and merge with `newRHSSemantic` as a RHS array. If `prevSemantic` has a `maxParams` of `1`, and will be copied for each semantic within the semantic array to contain `newRHSSemantic`, then checks if that semantic will be illegal when merged with `prevSemantic.prev`.
 *
 * Example:
 * repositories-liked(me)  // `prevSemantic.prev`
 * -> repositories-liked() // `prevSemantic`
 *    -> 'me'              // `newRHSSemantic`
 *       -> ? - Normally, must wait to inspect '?'. Instead, this check discover the reduced semantic will
 *              be illegal.
 *
 * @private
 * @static
 * @param {Object} prevSemantic The previous path's semantic linked list, ending with a LHS semantic.
 * @param {Object[]} newRHSSemantic The new RHS semantic.
 * @returns {boolean} Returns `true` if the resulting semantic will be illegal, else `false`.
 */
function isIllegalSemanticReduction(prevSemantic, newRHSSemantic) {
	var prevSemanticNode = prevSemantic.semantic[0]

	// Check if `prevSemantic` will be copied for each of its RHS semantics (because it has a `maxParams` of `1`), and `prevSemantic.prev` is reduced.
	if (prevSemanticNode.semantic.maxParams === 1 && prevSemantic.prev && prevSemantic.prev.isRHS) {
		var prevPrevSemanticArray = prevSemantic.prev.semantic
		var prevPrevSemanticArrayLen = prevPrevSemanticArray.length

		for (var s = 0; s < prevPrevSemanticArrayLen; ++s) {
			var prevPrevSemanticNode = prevSemantic.prev.semantic[s]

			// Check if `prevSemantic` and `prevSemantic.prev` have the same root semantic function.
			if (prevSemanticNode.semantic === prevPrevSemanticNode.semantic) {
				// Check if `prevSemantic` + `newRHSSemantic` and `prevSemantic.prev` will be semantically illegal.
				// If not, can not reduce `prevSemantic` + `newRHSSemantic`, merge with `prevSemantic.prev`, and copy `prevSemantic` for the future semantics, as will eventually happen. This is because it is possible no semantics will come down this branch, which cannot be determined in advance, and the copied function will remain illegally empty.
				if (semantic.isIllegalRHS(prevPrevSemanticNode.children, newRHSSemantic)) {
					// Discard semantically illegal RHS (e.g., will contain duplicates).
					return true
				}
			}
		}
	}

	return false
}

/**
 * Completely reduces a semantic tree irrespective of parsing state and semantic argument requirements. Used to print the semantics of a pair of ambiguous paths, which are not always completely reduced.
 *
 * @private
 * @static
 * @param {Object} semanticList The path's semantic linked list to forcefully reduce.
 * @param {Object} path The path of `semanticList` for error reporting.
 * @returns {Object[]|number|undefined} Returns a semantic array of the reduced semantic tree if parsing succeeds, `-1` if there is a semantic error, or `undefined` if there is no `semanticList` to begin with.
 */
function completeSemanticTree(semanticList, path) {
	if (!semanticList) return

	var prevSemantic = semanticList.semantic
	semanticList = semanticList.prev

	// Forcefully reduce the semantic tree irrespective of whether RHS semantics have been reduced.
	while (semanticList) {
		if (semanticList.isRHS) {
			// Merge RHS semantics.
			prevSemantic = semantic.mergeRHS(semanticList.semantic, prevSemantic)

			// Throw an exception if RHS is semantically illegal to report illegal semantics that should be detected and discarded earlier.
			if (prevSemantic === -1) {
				util.logError('Illegal semantic that should have been prevented earlier.')
				util.log('Text:', concatTextAndNextSyms(path))
				util.dir(linkedListToGraph(path))
				util.log()
				throw new Error('Semantic error')
			}
		} else {
			var lhsSemantic = semanticList.semantic

			// Discard if the RHS semantic is fewer semantic arguments than the LHS semantic's `minParams` requires, which is due to not completing the parse. Check this before `semantic.reduce()` which throws an exception for this error.
			if (lhsSemantic[0].semantic.minParams > prevSemantic.length) {
				return -1
			}

			// Reduce LHS semantic.
			prevSemantic = semantic.reduce(lhsSemantic, prevSemantic)

			// Discard if reduction is semantically illegal (e.g., LHS forbids multiple arguments but RHS is multiple semantics).
			if (prevSemantic === -1) return -1
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
 * If `text` is an `Array`, then it is being conjugated after completing an insertion rule's single branch which determines the person-number required for the nominative case in the second (inserted) branch (verb precedes subject).
 *
 * Conjugation will fail when the root symbol of `path` occurs after where the necessary person-number property occurs, then returns `textObj`. This does not occur in a normal parse which begins at the start symbol.
 *
 * @private
 * @static
 * @param {string|Object|Array} text The rule's text string not needing conjugation, text object to conjugate, or array of text strings and objects to conjugate.
 * @param {Object} personNumberList The reverse linked list of person-number properties for conjugating `text`.
 * @param {Object} [gramProps] The previous path's (i.e, the parent nonterminal rule's) grammatical properties (`case`, `tense`, and `acceptedTense`) for conjugating `text`.
 * @param {string} [inputTense] The terminal symbol's `tense` property to check against the previous path's (i.e, the parent nonterminal rule's) `acceptedTense` property and determine if the terminal symbol seen in input is an (optionally) acceptable form of the associated verb, `text`.
 * @returns {string|Object|Array} Returns `text`, conjugated if the necessary person-number property exists.
 */
function conjugateText(text, personNumberList, gramProps, inputTense) {
	var textConstructor = text.constructor

	if (textConstructor === String) {
		// No conjugation.
		return text
	}

	if (textConstructor === Object) {
		// Conjugate `text`, which contains a term's inflected forms, if the necessary grammatical property exists.
		return conjugateTextObject(text, personNumberList, gramProps, inputTense)
	}

	// Conjugate `text`, which is an insertion's array of text strings and yet-to-conjugate text objects. This array will never contains other arrays.
	var textArray = []

	for (var t = 0, textLen = text.length; t < textLen; ++t) {
		// Do not pass `gramProps` or `inputTense`, which are only for terminal rules (i.e., not insertions).
		textArray.push(conjugateText(text[t], personNumberList))
	}

	// This array is flattened in `concatTextAndNextSyms()` (which yields fewer operations than if concatenated to `path.text` here).
	return textArray
}

/**
 * Conjugates `textObj` to a term's correct inflection according to the parent rule's grammatical properties or the path's previous person-number property.
 *
 * Conjugation will fail when the root symbol of `path` occurs after where the necessary person-number property occurs, then returns `textObj`. This does not occur in a normal parse which begins at the start symbol.
 *
 * @private
 * @static
 * @param {Object} textObj The text object, containing a term's different inflected forms, to conjugate.
 * @param {Object} personNumberList The reverse linked list of person-number properties for conjugating `textObj`.
 * @param {Object} [gramProps] The previous path's (i.e, the parent nonterminal rule's) grammatical properties (`case`, `tense`, and `acceptedTense`) for conjugating `textObj`.
 * @param {string} [inputTense] The terminal symbol's `tense` property to check against the previous path's (i.e., the parent nonterminal rule's) `acceptedTense` property and determine if the terminal symbol seen in input is an (optionally) acceptable form of the associated verb, `textObj`.
 * @returns {string|Object} Returns the conjugated string if the necessary person-number property exists, else `textObj`.
 */
function conjugateTextObject(textObj, personNumberList, gramProps, inputTense) {
	if (gramProps) {
		// Conjugate for required verb tense. E.g., "(repos I have) liked".
		// Must occur before person-number check, otherwise "[have] [like]" yields "have like" instead of "have liked".
		var tense = gramProps.tense
		if (tense && textObj[tense]) {
			return textObj[tense]
		}

		// If the input terminal symbol is of a tense which the parent rule optionally accepts, then accept it. E.g., "(repos I) like/liked".
		if (inputTense && gramProps.acceptedTense === inputTense && textObj[inputTense]) {
			return textObj[inputTense]
		}

		// Conjugate for required grammatical case. E.g., "(repos) I (like)".
		var gramCase = gramProps.case
		if (gramCase && textObj[gramCase]) {
			return textObj[gramCase]
		}
	}

	if (!personNumberList) {
		// No conjugation possible because the path's root symbol occurs after where the necessary person-number property occurs.
		return textObj
	}

	// Conjugate for required person-number. E.g., "(repos I) like", "(repos Danny) likes".
	if (personNumberList && textObj[personNumberList.personNumber]) {
		return textObj[personNumberList.personNumber]
	}

	// Conjugation failed.
	util.logError('Failed to conjugate:', textObj, personNumberList, gramProps)
	process.exit(1)
}

/**
 * Removes person-number properties from `personNumberList` that belong to previously completed subtrees.
 *
 * Person-number properties conjugate terminal symbols for verbs that follow each property's definition. When person-number properties are added to `personNumberList`, they are assigned the corresponding size of `nextItemList` when at that position in the parse tree. When parsing a subsequent person-number property, it is added to the front of `personNumberList` and conjugates any verbs within the previous property's subtree. When multiple person-number properties occur within the same subtree (i.e., same binary and insertion rules exist between them and the start node), the most recent property takes precedence.
 *
 * Later, when the size of the path's `nextItemList` is greater than or equal to the size associated with a property (following a branch's completion), then that property's subtree has completed and the person-number properties which followed it (via subnodes) are removed. That initial property remains at the front of `personNumberList` and can conjugate subsequent verbs outside its subtree (as intended).
 *
 * @private
 * @static
 * @param {Object} personNumberList The reverse linked list of person-number properties.
 * @param {number} nextItemListSize The number of items in the path's `nextItemList`.
 * @returns {Object} Returns the person-number list with properties for completed subtree removed.
 */
function unwindPersonNumberList(personNumberList, nextItemListSize) {
	var personNumberItem = personNumberList
	while (personNumberItem) {
		// If the current size of the path's `personNumberList` is greater than or equal to the size when at a person-number property's definition position in the parse tree, then the property's subtree has completed and the person-number properties which followed it (via subnodes) are removed. This person-number property remains and can conjugate subsequent verbs outside its subtree (as intended).
		if (nextItemListSize >= personNumberItem.nextItemListSize) {
			return personNumberItem
		}

		personNumberItem = personNumberItem.prev
	}

	// Return original list if the most recent person-number property still applies to subsequent verbs.
	return personNumberList
}

/**
 * Deletes the transposition rules from the grammar's rules, `ruleSets`.
 *
 * Do not inspect transpositions because any ambiguity they create is evident in the original rules from which they were derived.
 *
 * @private
 * @static
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