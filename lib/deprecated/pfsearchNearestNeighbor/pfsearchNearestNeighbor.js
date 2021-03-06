/**
 * This implementation of `pfsearch` and `calcHeuristicCosts` only creates a single new path from the previous path's cheapest sub node, then adds the previous path back to the heap with the next cheapest sub's minimum cost. This reduces the number of paths created. Nevertheless, this decreases overall performance for indiscernible reasons.
 */

var util = require('../../util/util')
var BinaryHeap = require('./BinaryHeap')
var semantic = require('../grammar/semantic')
var calcHeuristicCosts = require('./calcHeuristicCosts')


/**
 * Uses A* path search to find the k-best parse trees in the parse forest returned by `Parser`. Also generates their semantic trees and conjugated display texts.
 *
 * @static
 * @param {Object} startNode The root node of the parse forest returned by `Parser`.
 * @param {number} k The maximum number of parse trees to find.
 * @param {boolean} [buildTrees] Specify constructing parse trees, at expense of speed, for printing.
 * @param {boolean} [printStats] Specify printing performance statistics.
 * @param {boolean} [printAmbiguity] Specify printing instances of semantic ambiguity.
 * @returns {Object[]} Returns the k-best parse trees.
 */
module.exports = function (startNode, k, buildTrees, printStats, printAmbiguity) {
	// Calculate the (admissible) heuristic estimates of the minimum costs of a subtree that can be constructed from each node.
	calcHeuristicCosts(startNode)

	// Array of all completed parse trees.
	var trees = []
	// Min-heap of all partially constructed trees.
	var heap = new BinaryHeap
	// The number of trees rejected for containing duplicate semantics or display text.
	var ambiguousTreesCount = 0

	heap.push({
		// The previously added node whose subnodes this path can expand from.
		curNode: startNode,
		// The linked list of the second nodes of previously incomplete binary rules and yet-to-conjugate text objects from insertion rules. When `path.curNode` is `undefined` after reaching a terminal symbol, inspect `nextItemList` to complete the binary rules and conjugate the text objects.
		nextItemList: undefined,
		// The number of nodes in the `nextItemList` that can produce a semantic. This excludes other nodes and yet-to-conjugate text. Used to determine if a RHS semantic is complete (no more semantics will follow it) and can be reduced with the preceding LHS semantic.
		nextNodesCount: 0,
		// The reverse linked list of yet-to-reduce semantics.
		semanticList: undefined,
		// The path's display text.
		text: '',
		// The reverse linked list of grammatical properties for yet-to-conjugate text in `nextItemList`.
		gramPropsList: undefined,
		// The cost of the path from the start node.
		costSoFar: 0,
		// The cost of the path + heuristic estimate of the minimum cost to complete the parse tree.
		cost: 0,
		// The index of the next subnode to expand in `curNode.subs`.
		subIndex: 0,
	})

	while (heap.content.length > 0) {
		// Get path with lowest cost.
		var path = heap.pop()

		var curNode = path.curNode

		// Previously reached a terminal symbol at a branch's end.
		// Perform this operation here instead of with the terminal rule in `createPaths()` to avoid operations on paths whose cost prevent them from ever being popped from `heap`.
		if (!curNode) {
			var nextItemList = path.nextItemList
			while (nextItemList) {
				var text = nextItemList.text

				// Stop when at a node.
				if (!text) break

				// Append text from insertions of the second of two RHS nodes, performing any necessary conjugation. Conjugation occurs in the nominative case, which relies on the person-number of the first branch (verb precedes subject).
				path.text += conjugateText(path, text)

				nextItemList = nextItemList.next
			}

			if (!nextItemList) {
				// No nodes remain; tree construction complete.
				// Save tree if unique: not semantically or textually identical to previous trees.
				if (treeIsUnique(trees, path, printAmbiguity)) {
					// Add new tree to array; stop parsing if is k-th tree.
					if (trees.push(path) === k) break
				} else {
					++ambiguousTreesCount
				}

				continue
			} else {
				// Get the second symbol of the most recent incomplete binary rule.
				curNode = path.curNode = nextItemList.node
				path.nextItemList = nextItemList.next

				// Allow semantic reductions down this node's branch with LHS semantics that preceded this node. This required first parsing the parent binary node's first branch (i.e., this node's sibling).
				if (nextItemList.canProduceSemantic) {
					--path.nextNodesCount
				}
			}
		}

		// This implementation creates a new path by expanding with the cheapest subnode, then returns the original path with a new `minCost` of the next cheapest subnode, which avoids creating paths that are never used. This implementation does not, however, improve performance.
		var index = path.subIndex
		var subs = curNode.subs
		var sub = subs[path.subIndex]

		// Create a new path by expanding `path` with its subnode, `sub`.
		var newPath = createPath(path, sub, sub.ruleProps)

		// Discard semantically illegal parse.
		if (newPath !== -1) {
			// If `buildTrees` is `true`, add a reverse linked list in order to construct and print parse trees for debugging at parse completion.
			if (buildTrees) {
				newPath.ruleProps = sub.ruleProps
				newPath.prev = path
			}

			heap.push(newPath)
		}

		// Prepare this path to expand again by the next cheapest subnode.
		var nextSub = subs[++path.subIndex]
		if (nextSub) {
			// Determine the path's new `minCost` without the previously cheapest subnode.
			path.cost += nextSub.minCost - sub.minCost
			heap.push(path)
		}
	}

	if (printStats) {
		util.log('Paths created:', heap.pushCount)
		util.log('Ambiguous trees:', ambiguousTreesCount)
	}

	return trees
}

/**
 * Creates a new path by expanding `prevPath` with `sub`.
 *
 * @param {Object} prevPath The previous path from which to expand.
 * @param {Object} sub The subnode of `prevPath`'s last node.
 * @param {Object} ruleProps The rule properties of `sub`.
 * @returns {Object|number} Returns the new path if semantically legal, else `-1`.
 */
function createPath(prevPath, sub, ruleProps) {
	var newCost = prevPath.costSoFar + ruleProps.cost

	var newPath = {
		// The previously added node whose subnodes this path can expand from.
		curNode: undefined,
		// The linked list of the second nodes of previously incomplete binary rules and yet-to-conjugate text objects from insertion rules. When `path.curNode` is `undefined` after reaching a terminal symbol, inspect `nextItemList` to complete the binary rules and conjugate the text objects.
		nextItemList: prevPath.nextItemList,
		// The number of nodes in the `nextItemList` that can produce a semantic. This excludes other nodes and yet-to-conjugate text. Used to determine if a RHS semantic is complete (no more semantics will follow it) and can be reduced with the preceding LHS semantic.
		nextNodesCount: prevPath.nextNodesCount,
		// The reverse linked list of yet-to-reduce semantics.
		semanticList: undefined,
		// The path's display text.
		text: prevPath.text,
		// The reverse linked list of grammatical properties for yet-to-conjugate text in `nextItemList`.
		gramPropsList: prevPath.gramPropsList,
		// The cost of the path from the start node.
		costSoFar: newCost,
		// The cost of the path + heuristic estimate of the minimum cost to complete the parse tree.
		// If rule is binary, `sub.minCost` includes cost of both RHS symbols (i.e., `sub.next`).
		// `prevPath.nextItemList.minCost` is the total heuristic cost of incomplete branches from previous binary rules.
		// Unlike the other `phsearch` implementation, `sub.minCost` include's the rule's cost.
		cost: prevPath.costSoFar + sub.minCost + (prevPath.nextItemList ? prevPath.nextItemList.minCost : 0),
		// The index of the next subnode to expand in `newPath.curNode.subs`.
		subIndex: 0,
	}

	// Nonterminal rule.
	if (sub.node.subs) {
		// Append `sub`'s semantics, if any, to `prevPath.semanticList`.
		newPath.semanticList = appendSemantic(prevPath.semanticList, prevPath.nextNodesCount, ruleProps)

		// Discard if semantically illegal parse.
		if (newPath.semanticList === -1) return -1

		// Next node whose subnodes this path can expand from.
		newPath.curNode = sub.node

		// Grammatical properties are only on nonterminal rules.
		if (ruleProps.gramProps) {
			newPath.gramPropsList = {
				props: ruleProps.gramProps,
				prev: prevPath.gramPropsList,
			}
		}

		// Non-edit rule.
		if (ruleProps.insertionIdx === undefined) {
			// All binary rules are nonterminal rules.
			var subNext = sub.next
			if (subNext) {
				newPath.nextItemList = {
					node: subNext.node,
					// The total heuristic cost of incomplete branches from previous binary rules.
					minCost: subNext.minCost + (prevPath.nextItemList ? prevPath.nextItemList.minCost : 0),
					canProduceSemantic: ruleProps.secondRHSCanProduceSemantic,
					next: prevPath.nextItemList,
				}

				// If there will never be a semantic down the second branch of this binary rule, then a RHS semantic in the first branch can freely reduce with any preceding LHS semantic found before this rule. Else, prevent the first branch's RHS semantic(s) from reducing with LHS semantics found before this rule until parsing the second branch's semantic(s).
				if (ruleProps.secondRHSCanProduceSemantic) {
					++newPath.nextNodesCount
				}
			}
		}

		// Insertion rule.
		// Insertions only exist on nonterminal rules because they can only be built from binary rules. This might iIf we enable terminal symbols to be in a RHS with another terminal or nonterminal symbol (or multiple).
		else {
			// Insertions always have text. Edit rules can be made from insertions and lack text, but they behave as normal rules (with `insertionIdx`).
			if (ruleProps.insertionIdx === 1) {
				// Will conjugate text after completing first branch in this binary reduction. Used in nominative case, which relies on person-number in the first branch (verb precedes subject).
				newPath.nextItemList = {
					text: ruleProps.text,
					minCost: prevPath.nextItemList ? prevPath.nextItemList.minCost : 0,
					next: prevPath.nextItemList,
				}
			} else {
				// Append text, if any, to the previous path's text, performing any necessary conjugation.
				newPath.text += conjugateText(newPath, ruleProps.text)
			}
		}
	}

	// Terminal rule.
	else {
		// Append `sub`'s RHS semantics, if any, to `prevPath.semanticList` and then reduce up to the first incompletely reduced node.
		newPath.semanticList = reduceSemanticTree(prevPath.semanticList, prevPath.nextNodesCount, ruleProps.semantic)

		// Discard if semantically illegal parse.
		if (newPath.semanticList === -1) return -1

		// Append text, if any, to the previous path's text, performing any necessary conjugation. No text if terminal symbol is a stop word.
		if (ruleProps.text) {
			newPath.text += conjugateText(newPath, ruleProps.text)
		}
	}

	return newPath
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
 * @param {Object} prevSemantic The previous path's semantic linked list.
 * @param {number} nextNodesCount The number of nodes in the previous path's `nextItemList` that can produce a semantic. Used to determine if a RHS semantic is complete (no more semantics will follow it) and can be reduced with the preceding LHS semantic.
 * @param {Object} ruleProps The nonterminal rule's rule properties.
 * @param {Object[]} [ruleProps.semantic] The new nonterminal rule's semantic, if any.
 * @param {boolean} [ruleProps.semanticIsRHS] Specify `ruleProps.semantic` is a RHS semantic.
 * @param {Object[]} [ruleProps.insertedSemantic] A RHS semantic of an insertion rule which also contains LHS semantic.
 * @param {boolean} [ruleProps.rhsCanProduceSemantic] Specify the new nonterminal rule's RHS symbol can produce a semantic.
 * @returns {Object|number} Returns the semantic linked list if appendage is semantically legal, else `-1`.
 */
function appendSemantic(prevSemantic, nextNodesCount, ruleProps) {
	// If `ruleProps.insertedSemantic` exists, then it is a RHS semantic and `ruleProps.semantic` also exists and is a LHS semantic.
	if (ruleProps.insertedSemantic) {
		return {
			semantic: ruleProps.insertedSemantic,
			isRHS: true,
			prev: {
				semantic: ruleProps.semantic,
				nextNodesCount: nextNodesCount,
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
					return reduceSemanticTree(prevSemantic, nextNodesCount, ruleProps.semantic)
				}

				if (prevSemantic.isRHS) {
					// Merge RHS (i.e., reduced) semantic with previous semantic if also reduced.
					var newRHSSemantic = semantic.mergeRHS(prevSemantic.semantic, ruleProps.semantic)

					// Discard if RHS is semantically illegal (e.g., contains duplicates).
					if (newRHSSemantic === -1) return -1

					return {
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
			nextNodesCount: nextNodesCount,
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
 * @param {Object} prevSemantic The previous path's semantic linked list.
 * @param {number} nextNodesCount The number of nodes in the previous path's `nextItemList` that can produce a semantic. Used to determine if a RHS semantic is complete (no more semantics will follow it) and can be reduced with the preceding LHS semantic.
 * @param {Object[]} [newRHSSemantic] The terminal rules' RHS semantic.
 * @returns {Object|number} Returns the reduced semantic linked list if reduction is semantically legal, else `-1`.
 */
function reduceSemanticTree(prevSemantic, nextNodesCount, newRHSSemantic) {
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
		else if (nextNodesCount <= prevSemantic.nextNodesCount) {
			// A semantic function without arguments - currently can only be `intersect()`.
			// This will need to be modified if we incorporate semantic functions that don't require arguments.
			if (!newRHSSemantic) return -1

			newRHSSemantic = semantic.reduce(prevSemantic.semantic, newRHSSemantic)
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
 * Conjugates a rule's text, if necessary, for appending to a path.
 *
 * `text` can be a `string` not needing conjugation, an `Object` containing a term's inflected forms, or an `Array` of text strings and yet-to-conjugate text objects.
 *
 * If `text` is an `Array`, then it is being conjugated after completing an insertion rule's single branch's reduction that determines the person-number required for the nominative case in the second (inserted) branch (verb precedes subject).
 *
 * @param {Object} path The path containing the grammatical properties for conjugation, `path.gramPropsList`.
 * @param {string|Object|Array} text The rule's text string not needing conjugation, text object to conjugate, or array of text strings and objects to conjugate.
 * @returns {string} Returns the text, conjugated if necessary, prepended with a space.
 */
function conjugateText(path, text) {
	var textConstructor = text.constructor

	if (textConstructor === String) {
		// No conjugation.
		return ' ' + text
	}

	if (textConstructor === Object) {
		// Conjugate `text`, which contains a term's inflected forms.
		return ' ' + conjugateTextObject(path, text)
	}

	// Conjugate `text`, which is an insertion's array of text strings and yet-to-conjugate text objects. This array will never contains other arrays.
	var conjugatedText = ''

	for (var t = 0, textLen = text.length; t < textLen; ++t) {
		conjugatedText += conjugateText(path, text[t])
	}

	return conjugatedText
}

/**
 * Conjugates `textObj` to a term's correct inflection according to the grammatical properties in `path.gramPropsList`. Finds the most recent path in the reverse linked list `path.gramPropsList` that calls for a grammatical property in `textObj`. Removes the `gramProps` from the list after conjugation. Does not allow for use of the same property in multiple places.
 *
 * @param {Object} path The path containing the grammatical properties for conjugation, `path.gramPropsList`.
 * @param {Object} textObj The text object, containing a term's different inflected forms, to conjugate.
 * @returns {string} Returns the conjugated text.
 */
function conjugateTextObject(path, textObj) {
	var gramPropsList = path.gramPropsList

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

	util.logError('Failed to conjugate:', textObj, path.gramPropsList)
	throw new Error('Failed conjugation')
}

/**
 * Removes the element `gramPropsToRemove` from the linked list `path.gramPropsList`. The `gramProps` that will be used may not be the most recent, which requires the list to be rebuilt up to the `gramProps` used because the list elements are shared amongst paths.
 *
 * It is better to construct new portions of the linked list here, after finding the gramProps, instead of while traversing, because the list might not need splicing; e.g., a `gramCase` conjugation for a `gramProps` path that also contains a `personNumber`.
 *
 * @param {Object} path The path containing the reverse linked list, `path.gramPropsList`, to modify.
 * @param {Object} gramPropsToRemove The object to remove from `path.gramPropsList`.
 */
function spliceGramPropsList(path, gramPropsToRemove) {
	var gramPropsList = path.gramPropsList
	var prevGramProps

	// Rebuild `path.gramPropsList` up to the element to remove.
	while (gramPropsList !== gramPropsToRemove) {
		if (prevGramProps) {
			prevGramProps = prevGramProps.prev = {
				gramProps: gramPropsList.props,
			}
		} else {
			prevGramProps = path.gramPropsList = {
				gramProps: gramPropsList.props,
			}
		}

		gramPropsList = gramPropsList.prev
	}

	// Point the predecessor, `prev`, to the successor of the element to be removed.
	if (prevGramProps) {
		prevGramProps.prev = gramPropsToRemove.prev
	} else {
		path.gramPropsList = gramPropsToRemove.prev
	}
}

/**
 * Checks if a new, completed parse tree has a unique semantic and unique display text.
 *
 * @private
 * @static
 * @param {Object[]} trees The previously completed unique parse trees to compare against.
 * @param {Object} newTree The new parse tree.
 * @param {boolean} [printAmbiguity] Specify printing instances of semantic ambiguity.
 * @returns {boolean} Returns `true` if `newTree` is unique, else `false`.
 */
function treeIsUnique(trees, newTree, printAmbiguity) {
	var semanticStr = semantic.toString(newTree.semanticList.semantic)

	// Check for duplicate semantics by comparing semantic string representations.
	// - Return `false` if new semantic is identical to previously constructed (and cheaper) tree.
	//
	// Tests show 1.18x more likely to find a matching semantic faster by iterating backward.
	for (var t = trees.length - 1; t > -1; --t) {
		var tree = trees[t]

		if (tree.semanticStr === semanticStr) {
			if (printAmbiguity) {
				util.log(util.colors.yellow('Ambiguity') + ':', semanticStr)
				util.log('  ' + tree.text, tree.cost)
				util.log(' ' + newTree.text, newTree.cost)
				util.log()
			}

			return false
		}

		if (tree.disambiguation && tree.disambiguation.indexOf(semanticStr) !== -1) {
			return false
		}
	}

	// Check for duplicate display text.
	// - If so, save new semantic to previous tree's `disambiguation` and return `false` to reject tree.
	//
	// Tests show 1.02x more likely to find a matching text faster by iterating backward.
	//
	// Checking for duplicate text in a separate loop is faster than a single loop because there are ~200x a many semantic duplicates as display text duplicates. This decreases display text comparisons by 75% by avoiding comparisons on trees that eventually fail for duplicate semantics. Tests indicate ~20% of trees constructed are unique.
	var textStr = newTree.text.slice(1) // Remove leading space.
	for (var t = trees.length - 1; t > -1; --t) {
		var tree = trees[t]

		if (tree.text === textStr) {
			if (tree.disambiguation) {
				tree.disambiguation.push(semanticStr)
			} else {
				tree.disambiguation = [ semanticStr ]
			}

			return false
		}
	}

	// Tree is unique.
	newTree.semanticStr = semanticStr
	newTree.text = textStr

	return true
}