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
		// The node whose children (`node.subs`) this path can expand from.
		node: startNode,
		// The reverse linked list of the second nodes of previously incomplete binary rules. When `node` is undefined after reaching a terminal symbol, inspect `nextNodes` to complete those binary rules. Also contains yet-to-be-conjugated text from insertion rules.
		nextNodes: undefined,
		// The number of elements in `nextNodes` excluding yet-to-be-conjugated text. Marks when a LHS semantic is visited, to determine when the semantic can be reduced after completely parsing its rule's RHS.
		nextNodesLen: 0,
		// The reverse linked list of yet-to-be-reduced semantics.
		semantics: undefined,
		// The path's display text.
		text: '',
		// The reverse linked list of grammatical properties for yet-to-be-conjugated text in `nextNodes`.
		gramProps: undefined,
		// The cost of the path from the start node.
		costSoFar: 0,
		// The cost of the path + heuristic estimate of the minimum cost to complete the parse tree.
		cost: 0,
	})

	while (heap.content.length > 0) {
		var path = heap.pop()

		var node = path.node

		// Previously reached a terminal symbol at a branch's end.
		if (!node) {
			var nextNodes = path.nextNodes
			while (nextNodes) {
				var text = nextNodes.text

				// Stop when at a node.
				if (!text) break

				if (text.constructor === Array) {
					// Conjugate text of insertions of the second of two RHS node.
					// Used in nominative case, which relies on person-number in 1st branch (verb precedes subject).
					path.text += conjugateTextArray(path, text)
				} else {
					path.text += ' ' + text
				}

				nextNodes = nextNodes.prev
			}

			// No nodes remain; tree construction complete.
			if (!nextNodes) {
				// Save tree if unique: not semantically or textually identical to previous trees.
				if (treeIsUnique(trees, path)) {
					// Add new tree to array; stop parsing if is k-th tree.
					if (trees.push(path) === k) break
				} else {
					++ambiguousTreesCount
				}

				continue
			} else {
				path.nextNodes = nextNodes.prev
				--path.nextNodesLen
			}

			// Get the second symbol of the most recent incomplete binary rule.
			node = nextNodes.node
		}

		// Loop through all possible children of this node.
		for (var s = 0, subs = node.subs, subsLen = subs.length; s < subsLen; ++s) {
			var sub = subs[s]
			var ruleProps = sub.ruleProps

			// Array of multiple insertions - first can be a unary reduction created by an `<empty>`.
			if (ruleProps.constructor === Array) {
				for (var r = 0, rulePropsLen = ruleProps.length; r < rulePropsLen; ++r) {
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
 * @param {Object} sub The sub node that follows `prevPath`.
 * @param {Object} ruleProps The rule properties of `sub`.
 * @returns {Object|number} Returns the new path if semantically legal, else `-1`.
 */
function createPath(prevPath, sub, ruleProps) {
	var newCost = prevPath.costSoFar + ruleProps.cost

	var newPath = {
		// The node whose children (`node.subs`) this path can expand from.
		node: undefined,
		// The reverse linked list of the second nodes of previously incomplete binary rules. When `node` is undefined after reaching a terminal symbol, inspect `nextNodes` to complete those binary rules. Also contains yet-to-be-conjugated text from insertion rules.
		nextNodes: prevPath.nextNodes,
		// The number of elements in `nextNodes` excluding yet-to-be-conjugated text. Marks when a LHS semantic is visited, to determine when the semantic can be reduced after completely parsing its rule's RHS.
		nextNodesLen: prevPath.nextNodesLen,
		// The reverse linked list of yet-to-be-reduced semantics.
		semantics: undefined,
		// The path's display text.
		text: undefined,
		// The reverse linked list of grammatical properties for yet-to-be-conjugated text in `nextNodes`.
		gramProps: prevPath.gramProps,
		// The cost of the path from the start node.
		costSoFar: newCost,
		// The cost of the path + heuristic estimate of the minimum cost to complete the parse tree.
		// If rule is binary, `sub.minCost` includes cost of both RHS symbols (i.e., `sub.next`).
		// `prevPath.nextNodes.minCost` is the total heuristic cost of incomplete branches from previous binary rules.
		cost: newCost + sub.minCost + (prevPath.nextNodes ? prevPath.nextNodes.minCost : 0),
	}

	var newSemantic = ruleProps.semantic

	// Nonterminal rule.
	if (sub.node.subs) {
		// If 'insertedSemantic' exists, then `newSemantic` also exists and is LHS.
		if (ruleProps.insertedSemantic) {
			// Discard new LHS semantic if `prevSemantic` is completely reduced (i.e., RHS), is identical to `newSemantic`, and multiple instances of the semantic are forbidden.
			var prevSemantic = prevPath.semantics
			if (prevSemantic && prevSemantic.isRHS && semantic.isForbiddenMultiple(prevSemantic.semantic, newSemantic)) {
				return -1
			}

			newPath.semantics = {
				semantic: ruleProps.insertedSemantic,
				isRHS: true,
				prev: {
					semantic: newSemantic,
					nextNodesLen: prevPath.nextNodesLen,
					prev: prevSemantic,
				}
			}
		} else if (newSemantic) {
			var prevSemantic = prevPath.semantics

			if (ruleProps.semanticIsRHS) {
				if (prevSemantic && prevSemantic.isRHS) {
					newSemantic = semantic.mergeRHS(prevSemantic.semantic, newSemantic)

					// Discard if RHS contains duplicates.
					if (newSemantic === -1) return -1

					newPath.semantics = {
						semantic: newSemantic,
						isRHS: true,
						prev: prevSemantic.prev,
					}
				} else {
					newPath.semantics = {
						semantic: newSemantic,
						isRHS: true,
						prev: prevSemantic,
					}
				}
			} else {
				// Discard new LHS semantic if `prevSemantic` is completely reduced (i.e., RHS), is identical to `newSemantic`, and multiple instances of the semantic are forbidden.
				if (prevSemantic && prevSemantic.isRHS && semantic.isForbiddenMultiple(prevSemantic.semantic, newSemantic)) {
					return -1
				}

				newPath.semantics = {
					semantic: newSemantic,
					nextNodesLen: prevPath.nextNodesLen,
					prev: prevSemantic,
				}
			}
		} else {
			newPath.semantics = prevPath.semantics
		}
	}

	// Terminal rule.
	else {
		// If there is a semantic on the terminal rule, then it is reduced (i.e., RHS).
		var newSemanticList = reduceSemanticTree(prevPath.semantics, prevPath.nextNodesLen, newSemantic)

		// Discard if semantically illegal parse.
		if (newSemanticList === -1) return -1

		newPath.semantics = newSemanticList
	}

	// Insertion rule.
	if (ruleProps.insertionIdx !== undefined) {
		newPath.node = sub.node

		if (ruleProps.gramProps) {
			newPath.gramProps = {
				props: ruleProps.gramProps,
				prev: prevPath.gramProps,
			}
		}

		var text = ruleProps.text
		if (ruleProps.insertionIdx === 1) {
			newPath.text = prevPath.text

			// Will conjugate text after completing first branch in this binary reduction. Used in nominative case, which relies on person-number in the first branch (verb precedes subject).
			newPath.nextNodes = {
				text: text,
				minCost: prevPath.nextNodes ? prevPath.nextNodes.minCost : 0,
				prev: prevPath.nextNodes,
			}
		} else {
			if (text.constructor === Array) {
				// Text requires conjugation.
				newPath.text = prevPath.text + conjugateTextArray(newPath, text)
			} else {
				// No conjugation.
				newPath.text = prevPath.text + ' ' + text
			}
		}
	}

	else {
		// Nonterminal rule.
		if (sub.node.subs) {
			newPath.node = sub.node

			// Grammatical properties are only on nonterminal rules.
			if (ruleProps.gramProps) {
				newPath.gramProps = {
					props: ruleProps.gramProps,
					prev: prevPath.gramProps,
				}
			}

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

			// No text on nonterminal (non-edit) rules.
			newPath.text = prevPath.text
		}

		// Terminal rule.
		else {
			var text = ruleProps.text
			if (text) {
				if (text.constructor === Object) {
					newPath.text = prevPath.text + ' ' + conjugateText(newPath, text)
				} else {
					newPath.text = prevPath.text + ' ' + text
				}
			} else {
				// Stop word: no text on a terminal rule.
				newPath.text = prevPath.text
			}
		}
	}

	return newPath
}

/**
 * Reduces a semantic tree after reaching a terminal rule (i.e, and end of a branch). Merges the rule's semantic, if any, with the preceding RHS semantic(s), if any. Then reduces the RHS semantics with any preceding LHS semantics in the tree, up to a LHS semantic whose parse node has a second child node (i.e., a second branch) yet to be parsed. I.e., a LHS semantic can only be reduced after all of the RHS semantics have been found.
 *
 * @param {Object} prevSemantic The semantics linked list of the previous path.
 * @param {number} prevNextNodesLen The number of `nextNodes` in the previous path. Used to determine if the rule of a LHS semantic has been completely parsed and that semantic can be reduced.
 * @param {Object[]} [newSemantic] The semantic of the terminal rule, if any.
 * @returns {Object|-1} Returns the reduced semantics linked list if successfully parsed, else `-1`.
 */
function reduceSemanticTree(prevSemantic, prevNextNodesLen, newSemantic) {
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
		else if (prevNextNodesLen <= prevSemantic.nextNodesLen) {
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
 * Conjugates an array of text strings and yet-to-be-conjugated text objects from previous insertions. Called after completing an insertion rule's parse that determines the person-number required for the nominative case in the second (inserted) branch (verb precedes subject).
 *
 * @param {Object} path The path containing the grammatical properties, `path.gramProps`.
 * @param {Array} textArray The strings and yet-to-be-conjugated text objects, which contain a term's inflected forms.
 * @returns {string} Returns the conjugated string, prepended with a space.
 */
function conjugateTextArray(path, textArray) {
	var concatStr = ''

	for (var t = 0, textArrayLen = textArray.length; t < textArrayLen; ++t) {
		var text = textArray[t]
		if (text.constructor === Object) {
			concatStr += ' ' + conjugateText(path, text)
		} else {
			concatStr += ' ' + text
		}
	}

	return concatStr
}

/**
 * Conjugates `textObj` according to the grammatical properties in `path.gramProps`. Finds the most recent path in the reverse linked list `path.gramProps` that calls for a grammatical property in `textObj`. Removes the `gramProps` path from the list after conjugation. Does not allow for use of the same property in multiple places.
 *
 * @param {Object} path The path containing the grammatical properties, `path.gramProps`.
 * @param {Object} textObj The text object, containing a term's different inflected forms, to conjugate.
 * @returns {string} Returns the conjugated text.
 */
function conjugateText(path, textObj) {
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
	var thisGramProps = path.gramProps
	var prevGramProps

	// Find which element in `path.gramProps` is to be removed.
	while (thisGramProps !== gramPropsToRemove) {
		if (prevGramProps) {
			prevGramProps = prevGramProps.prev = {
				gramProps: thisGramProps.props,
			}
		} else {
			prevGramProps = path.gramProps = {
				gramProps: thisGramProps.props,
			}
		}

		thisGramProps = thisGramProps.prev
	}

	// Point the predecessor `prev` to successor of the element to be removed.
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