var util = require('../util/util')
var BinaryHeap = require('./BinaryHeap')
var semantic = require('../grammar/semantic')
var calcHeuristicCosts = require('./calcHeuristicCosts')


/**
 * Uses A* path search to find the k-best parse trees in a parse forest returned by `Parser`. Also generates their semantic trees and conjugated display texts.
 *
 * @static
 * @memberOf forestSearch
 * @param {Object} startNode The root node of the parse forest returned by `Parser`.
 * @param {number} k The maximum number of parse trees to find.
 * @param {boolean} buildDebugTrees Specify constructing parse trees at expense of speed for printing.
 * @param {boolean} printStats Specify printing performance statistics.
 * @returns {Object[]} Returns the k-best parse trees.
 */
module.exports = function (startNode, k, buildDebugTrees, printStats) {
	// Calculate the (admissible) heuristic estimates of the minimum costs of a subtree that can be constructed from each node.
	calcHeuristicCosts(startNode)

	// Array of all completed parse trees.
	var trees = []
	// Min-heap of all partially constructed trees.
	var heap = new BinaryHeap
	// The number of trees rejected for containing duplicate semantics or display text.
	var ambiguousTreesCount = 0

	heap.push({
		// The previous node whose subnodes this path can expand from.
		node: startNode,
		// The reverse linked list of the second nodes of previously incomplete binary rules and yet-to-conjugate text objects from insertion rules. When `node` is undefined after reaching a terminal symbol, inspect `nextNodes` to complete the binary rules and conjugate the text objects.
		nextNodes: undefined,
		// The number of elements in `nextNodes` excluding yet-to-conjugate text. Marks when a LHS semantic is visited, to determine when the semantic can be reduced after completely parsing its rule's RHS.
		nextNodesLen: 0,
		// The reverse linked list of yet-to-reduce semantics.
		semantics: undefined,
		// The path's display text.
		text: '',
		// The reverse linked list of grammatical properties for yet-to-conjugate text in `nextNodes`.
		gramProps: undefined,
		// The cost of the path from the start node.
		costSoFar: 0,
		// The cost of the path + heuristic estimate of the minimum cost to complete the parse tree.
		cost: 0,
	})

	while (heap.content.length > 0) {
		// Get path with lowest cost.
		var path = heap.pop()

		var node = path.node

		// Previously reached a terminal symbol at a branch's end.
		// Perform this operation here instead of with the terminal rule in `createPaths()` to avoid operations on paths whose cost prevent them from ever being popped from `heap`.
		if (!node) {
			var nextNodes = path.nextNodes
			while (nextNodes) {
				var text = nextNodes.text

				// Stop when at a node.
				if (!text) break

				// Append text from insertions of the second of two RHS nodes, performing any necessary conjugation. Conjugation occurs in the nominative case, which relies on the person-number of the first branch (verb precedes subject).
				path.text += conjugateText(path, text)

				nextNodes = nextNodes.prev
			}

			if (!nextNodes) {
				// No nodes remain; tree construction complete.
				// Save tree if unique: not semantically or textually identical to previous trees.
				if (treeIsUnique(trees, path)) {
					// Add new tree to array; stop parsing if is k-th tree.
					if (trees.push(path) === k) break
				} else {
					++ambiguousTreesCount
				}

				continue
			} else {
				// Get the second symbol of the most recent incomplete binary rule.
				node = nextNodes.node
				path.nextNodes = nextNodes.prev
				--path.nextNodesLen
			}
		}

		// Expand `path` by creating new paths from each of its subnodes.
		for (var s = 0, subs = node.subs, subsLen = subs.length; s < subsLen; ++s) {
			var sub = subs[s]
			var ruleProps = sub.ruleProps

			// Array of multiple insertions - first can be a unary reduction created by an `<empty>`.
			if (ruleProps.constructor === Array) {
				for (var r = 0, rulePropsLen = ruleProps.length; r < rulePropsLen; ++r) {
					// Create a new path by expanding `path` with its subnode, `sub`.
					var newPath = createPath(path, sub, ruleProps[r])

					// Discard semantically illegal parse.
					if (newPath === -1) continue

					// If `buildDebugTrees` is `true`, add a reverse linked list in order to construct and print parse trees for debugging at parse completion.
					if (buildDebugTrees) {
						newPath.ruleProps = ruleProps[r]
						newPath.prev = path
					}

					heap.push(newPath)
				}
			}

			else {
				// Create a new path by expanding `path` with its subnode, `sub`.
				var newPath = createPath(path, sub, ruleProps)

				// Discard semantically illegal parse.
				if (newPath === -1) continue

				// If `buildDebugTrees` is `true`, add a reverse linked list in order to construct and print parse trees for debugging at parse completion.
				if (buildDebugTrees) {
					newPath.ruleProps = ruleProps
					newPath.prev = path
				}

				heap.push(newPath)
			}
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
		// The previous node whose subnodes this path can expand from.
		node: undefined,
		// The reverse linked list of the second nodes of previously incomplete binary rules and yet-to-conjugate text objects from insertion rules. When `node` is undefined after reaching a terminal symbol, inspect `nextNodes` to complete the binary rules and conjugate the text objects.
		nextNodes: prevPath.nextNodes,
		// The number of elements in `nextNodes` excluding yet-to-conjugate text. Marks when a LHS semantic is visited, to determine when the semantic can be reduced after completely parsing its rule's RHS.
		nextNodesLen: prevPath.nextNodesLen,
		// The reverse linked list of yet-to-reduce semantics.
		semantics: undefined,
		// The path's display text.
		text: prevPath.text,
		// The reverse linked list of grammatical properties for yet-to-conjugate text in `nextNodes`.
		gramProps: prevPath.gramProps,
		// The cost of the path from the start node.
		costSoFar: newCost,
		// The cost of the path + heuristic estimate of the minimum cost to complete the parse tree.
		// If rule is binary, `sub.minCost` includes cost of both RHS symbols (i.e., `sub.next`).
		// `prevPath.nextNodes.minCost` is the total heuristic cost of incomplete branches from previous binary rules.
		cost: newCost + sub.minCost + (prevPath.nextNodes ? prevPath.nextNodes.minCost : 0),
	}

	// Nonterminal rule.
	if (sub.node.subs) {
		// Append `sub`'s semantics, if any, to `prevPath.semantics`.
		newPath.semantics = appendSemantic(prevPath.semantics, prevPath.nextNodesLen, ruleProps.semantic, ruleProps.semanticIsRHS, ruleProps.insertedSemantic)

		// Discard if semantically illegal parse.
		if (newPath.semantics === -1) return -1

		// Next node whose subnodes this path can expand from.
		newPath.node = sub.node

		// Grammatical properties are only on nonterminal rules.
		if (ruleProps.gramProps) {
			newPath.gramProps = {
				props: ruleProps.gramProps,
				prev: prevPath.gramProps,
			}
		}

		// Non-edit rule.
		if (ruleProps.insertionIdx === undefined) {
			// All binary rules are nonterminal rules.
			var subNext = sub.next
			if (subNext) {
				newPath.nextNodes = {
					node: subNext.node,
					// The total heuristic cost of incomplete branches from previous binary rules.
					minCost: subNext.minCost + (prevPath.nextNodes ? prevPath.nextNodes.minCost : 0),
					prev: prevPath.nextNodes,
				}

				++newPath.nextNodesLen
			}
		}

		// Insertion rule.
		// Insertions only exist on nonterminal rules because they can only be built from binary rules. This might iIf we enable terminal symbols to be in a RHS with another terminal or nonterminal symbol (or multiple).
		else {
			// Insertions always have text. Edit rules can be made from insertions and lack text, but they behave as normal rules (with `insertionIdx`).
			if (ruleProps.insertionIdx === 1) {
				// Will conjugate text after completing first branch in this binary reduction. Used in nominative case, which relies on person-number in the first branch (verb precedes subject).
				newPath.nextNodes = {
					text: ruleProps.text,
					minCost: prevPath.nextNodes ? prevPath.nextNodes.minCost : 0,
					prev: prevPath.nextNodes,
				}
			} else {
				// Append text, if any, to the previous path's text, performing any necessary conjugation.
				newPath.text += conjugateText(newPath, ruleProps.text)
			}
		}
	}

	// Terminal rule.
	else {
		// Append `sub`'s RHS semantics, if any, to `prevPath.semantics` and then reduce up to the first incompletely reduced node.
		newPath.semantics = reduceSemanticTree(prevPath.semantics, prevPath.nextNodesLen, ruleProps.semantic)

		// Discard if semantically illegal parse.
		if (newPath.semantics === -1) return -1

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
 * If `newSemantic` exists and is reduced (i.e., RHS), then it is merged with the previous semantic if it too is a reduced.
 *
 * If `insertedSemantic` exists, then it is a RHS semantic and `newSemantic` also exists and is a LHS semantic.
 *
 * Fails when appending a LHS semantic and the previous semantic is completely reduced (i.e., RHS), is identical to `newSemantic`, and multiple instances of the semantic are forbidden, and then returns `-1`.
 *
 * Fails when attempting to merge RHS semantics which would illegal (e.g., are duplicates), and then returns `-1`.
 *
 * @param {Object} prevSemantic The previous path's semantic linked list.
 * @param {number} prevNextNodesLen The number of `nextNodes` in the previous path. Used to determine if the rule of a LHS semantic has been completely reduced and that semantic can be reduced.
 * @param {Object[]} [newSemantic] The new nonterminal rule's semantic, if any.
 * @param {boolean} [semanticIsRHS] Specifies `newSemantic` is a RHS semantic.
 * @param {Object[]} [insertedSemantic] A RHS semantic of an insertion rule which also contains LHS semantic.
 * @returns {Object|number} Returns the semantic linked list if appendage is semantically legal, else `-1`.
 */
function appendSemantic(prevSemantic, prevNextNodesLen, newSemantic, semanticIsRHS, insertedSemantic) {
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
				nextNodesLen: prevNextNodesLen,
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
				nextNodesLen: prevNextNodesLen,
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
 * @param {number} prevNextNodesLen The number of `nextNodes` in the previous path. Used to determine if the rule of a LHS semantic has been completely reduced and that semantic can be reduced.
 * @param {Object[]} [newSemantic] The RHS semantic of the terminal rule, if any.
 * @returns {Object|number} Returns the reduced semantic linked list if reduction is semantically legal, else `-1`.
 */
function reduceSemanticTree(prevSemantic, prevNextNodesLen, newSemantic) {
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
		else if (prevNextNodesLen <= prevSemantic.nextNodesLen) {
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
 * Conjugates a rule's text, if necessary, for appending to a path.
 *
 * `text` can be a `string` not needing conjugation, an `Object` containing a term's inflected forms, or an `Array` of text strings and yet-to-conjugate text objects.
 *
 * If `text` is an `Array`, then it is being conjugated after completing an insertion rule's single branch's reduction that determines the person-number required for the nominative case in the second (inserted) branch (verb precedes subject).
 *
 * @param {Object} path The path containing the grammatical properties for conjugation, `path.gramProps`.
 * @param {string|Object|Array} text The rule's text string not needing conjugation, text object to conjugate, or array of text strings and objects to conjugate.
 * @returns {string} Returns the text, conjugated if necessary, prepended with a space.
 */
function conjugateText(path, text) {
	var textConstructor = text.constructor

	if (textConstructor === String) {
		// No conjugation.
		return ' ' + text
	} else if (textConstructor === Object) {
		// Conjugate `text`, which contains a term's inflected forms.
		return ' ' + conjugateTextObject(path, text)
	} else {
		var conjugatedText = ''

		// Conjugate `text`, which is an insertion's array of text strings and yet-to-conjugate text objects. The array never contains other arrays.
		for (var t = 0, textLen = text.length; t < textLen; ++t) {
			conjugatedText += conjugateText(path, text[t])
		}

		return conjugatedText
	}
}

/**
 * Conjugates `textObj` to a term's correct inflection according to the grammatical properties in `path.gramProps`. Finds the most recent path in the reverse linked list `path.gramProps` that calls for a grammatical property in `textObj`. Removes the `gramProps` path from the list after conjugation. Does not allow for use of the same property in multiple places.
 *
 * @param {Object} path The path containing the grammatical properties for conjugation, `path.gramProps`.
 * @param {Object} textObj The text object, containing a term's different inflected forms, to conjugate.
 * @returns {string} Returns the conjugated text.
 */
function conjugateTextObject(path, textObj) {
	var gramPropsList = path.gramProps

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
 * Determines if a new, completed parse tree has a unique semantic and unique display text.
 *
 * @private
 * @static
 * @param {Object[]} trees The previously completed unique parse trees to compare against.
 * @param {Object} newTree The new parse tree.
 * @returns {boolean} Returns `true` if `newTree` is unique, else `false`.
 */
function treeIsUnique(trees, newTree) {
	var semanticStr = semantic.toString(newTree.semantics.semantic)

	// Check for duplicate semantics by comparing semantic string representations.
	// - Return `false` if new semantic is identical to previously constructed (and cheaper) tree.
	// Tests show 1.18x more likely to find a matching semantic faster by iterating backward.
	for (var t = trees.length - 1; t > -1; --t) {
		var tree = trees[t]

		if (tree.semanticStr === semanticStr) {
			return false
		}

		if (tree.disambiguation && tree.disambiguation.indexOf(semanticStr) !== -1) {
			return false
		}
	}

	// Check for duplicate display text.
	// - If so, save new semantic to previous tree's `disambiguation` and return `false` to reject tree.
	// Tests show 1.02x more likely to find a matching text faster by iterating backward.
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