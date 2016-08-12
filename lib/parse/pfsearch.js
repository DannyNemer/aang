var util = require('../util/util')
var BinaryHeap = require('./BinaryHeap')
var semantic = require('../grammar/semantic')
var calcHeuristicCosts = require('./calcHeuristicCosts')
var conjugateText = require('./conjugateText')
var resolveAnaphora = require('./resolveAnaphora')


/**
 * The parse tree generated and returned by `pfsearch`.
 *
 * Note: This definition excludes residual properties used internally by `pfsearch`.
 *
 * @typedef {Object} ParseTree
 * @property {string} text The display text.
 * @property {string} semanticStr The lambda calculus semantic representation of `text`.
 * @property {number} cost The cumulative cost.
 */

/**
 * The parse forest search results containing the `k`-best parse trees and associated search statistics.
 *
 * @typedef {Object} PFSearchResults
 * @property {ParseTree[]} trees The `k`-best parse trees.
 * @property {number} pathCount The number of paths created.
 * @property {number} ambiguousTreeCount The number of discarded ambiguous parse trees.
 */

/**
 * Uses A* path search to find the `k`-best parse trees in the parse forest which `Parser` generated, along with the trees' associated semantic trees and display texts.
 *
 * @static
 * @param {Object} startNode The root node of the parse forest which `Parser` generated.
 * @param {number} [k=7] The maximum number of parse trees to find.
 * @param {Object} [options] The options object.
 * @param {boolean} [options.buildTrees=false] Specify constructing parse trees for printing.
 * @param {boolean} [options.printAmbiguity=false] Specify printing instances of ambiguity.
 * @returns {PFSearchResults} Returns the `k`-best parse trees and associated search statistics.
 */
module.exports = function (startNode, k, options) {
	// Check arity.
	if (options === undefined) {
		options = {}
	}
	if (isNaN(k) || k < 1) {
		k = 7
	}

	// Calculate the (admissible) heuristic estimates of the minimum costs of a subtree that can be constructed from each node.
	calcHeuristicCosts(startNode)

	// The array of completed parse trees.
	var trees = []
	// The number of trees rejected for containing duplicate semantics or display text.
	var ambiguousTreeCount = 0
	// The min-heap of search paths which form parse trees when complete.
	var heap = new BinaryHeap

	// Initialize heap with a path for the parse forest's start node.
	heap.push({
		// The previously added node whose subnodes this path can expand from.
		curNode: startNode,
		// The linked list of yet-to-parse second nodes of previous binary rules and conjugative text objects of previous insertion rules. When `curNode` is `undefined` after reaching a terminal symbol, inspect `nextItemList` to complete the binary rules and conjugate the text objects.
		nextItemList: undefined,
		// The reverse linked list of yet-to-reduce semantics.
		semanticList: undefined,
		// The path's display text.
		text: '',
		// The reverse linked list of person-number properties to conjugate text objects.
		personNumberList: undefined,
		// The grammatical properties to conjugate text of terminal rules in `curNode.subs`.
		gramProps: undefined,
		// The cost of the path from the start node.
		cost: 0,
		// The cost of the path + heuristic estimate of the minimum cost to complete the parse tree.
		minCost: 0,
	})

	while (heap.content.length > 0) {
		// Get path with lowest cost.
		var path = heap.pop()

		// Check if node remain in this branch, otherwise just reached a terminal symbol at a branch's end.
		var curNode = path.curNode
		if (curNode) {
			// Expand `path`, the cheapest path in `heap`, by creating a new path for each of its subnodes, `subs` (i.e., its neighboring nodes).
			expandPath(heap, path, curNode.subs, options.buildTrees)
		} else {
			// The most recent yet-to-parse node of a previous binary rule or a conjugative text object of a previous insertion rule.
			var nextItemList = path.nextItemList

			// The most recent person-number property.
			var personNumberList = path.personNumberList

			// Get the next node in `path.nextItemList` while conjugating any preceding inserted text objects. Perform this operation here instead of with the terminal rule in `createPaths()` to avoid operations on paths whose cost prevent them from ever being popped from `heap`.
			while (nextItemList) {
				var text = nextItemList.text

				// Stop at a node.
				if (!text) {
					break
				}

				// Remove person-number properties for previously completed subtrees.
				personNumberList = unwindPersonNumberList(personNumberList, nextItemList.size)

				// Append text from insertions of the second of two RHS nodes, performing any necessary conjugation. Conjugation occurs in the nominative case, which relies on the person-number of the first branch (verb precedes subject).
				// Do not pass the parent rule's `gramProps` because that conjugation was performed in the compilation of the insertion rule.
				path.text += conjugateText(text, personNumberList)

				nextItemList = nextItemList.next
			}

			if (nextItemList) {
				// Remove the most recent second node of a previous binary rules, as it is now the path's current node.
				path.nextItemList = nextItemList.next

				// Remove person-number properties for previously completed subtrees.
				path.personNumberList = unwindPersonNumberList(personNumberList, nextItemList.size)

				// The path's grammatical properties (`form` and `acceptedTense`) used to conjugate applicable conjugative display text produced by the second node of this binary rule. (Assigned in accordance with this node's position within the parent node's RHS.)
				path.gramProps = nextItemList.gramProps

				// Expand the second node of the most recent incomplete binary rule by creating a new path for each of its subnodes, `subs` (i.e., its neighboring nodes).
				expandPath(heap, path, nextItemList.node.subs, options.buildTrees)
			}

			// No nodes remain; tree construction complete.
			// Save tree if unique: semantically and textually distinguishable from every previous tree.
			else if (isUniqueTree(trees, path, options.printAmbiguity)) {
				// Add new tree to array. Stop parsing if is k-th tree.
				if (trees.push(path) === k) {
					break
				}
			} else {
				++ambiguousTreeCount
			}
		}
	}

	return {
		trees: trees,
		// Include statistics for benchmarking.
		pathCount: heap.pushCount,
		ambiguousTreeCount: ambiguousTreeCount,
	}
}

/**
 * Expands `path`, the cheapest path in `heap`, by creating a new path for each of its subnodes, `subs` (i.e., its neighboring nodes), and adding them to `heap`.
 *
 * Unimplemented idea: Only expand `path` with the cheapest subnode in `subs`, then push `path` back to `heap` with a new `minCost` for the next cheapest subnode. Avoids expanding futile paths. Requires sorting `subs` by their `minCost` in `calcHeuristicCosts`, maintaining a `subIdx` property on each path`, and monitoring whether `subs` for this function is `path.curNode.subs` or `path.nextItemList.node.subs`.
 * • Additional overhead: Sorting subnodes in `calcHeuristicCosts` by `minCost` and pushing `path` to `heap` `subs.length - 1` additional times.
 *
 * @private
 * @static
 * @param {BinaryHeap} heap The min-heap of search paths, for which to add the new paths.
 * @param {Object} path The cheapest path in `heap`.
 * @param {Object[]} subs The subnodes of `paths`'s last node, `path.curNode`, with which to expand `path`.
 * @param {boolean} [buildTrees] Specify constructing parse trees for printing.
 */
function expandPath(heap, path, subs, buildTrees) {
	// Expand `path` by creating new paths from each of its subnodes.
	for (var s = 0, subsLen = subs.length; s < subsLen; ++s) {
		var sub = subs[s]
		var ruleProps = sub.ruleProps

		// Array of multiple insertions - first can be a unary reduction created by an `<empty>`.
		if (ruleProps.constructor === Array) {
			for (var r = 0, rulePropsLen = ruleProps.length; r < rulePropsLen; ++r) {
				baseExpandPath(heap, path, sub, ruleProps[r], buildTrees)
			}
		} else {
			baseExpandPath(heap, path, sub, ruleProps, buildTrees)
		}
	}
}

/**
 * The base implementation of `expandPath()` which expands `path`, the cheapest path in `heap`, by creating a new path using one if its subnodes, `sub` (i.e., a neighboring node), and adding it to `heap`.
 *
 * @private
 * @static
 * @param {BinaryHeap} heap The min-heap of search paths, for which to add the new paths.
 * @param {Object} path The cheapest path in `heap`.
 * @param {Object} sub The subnodes of `paths`'s last node, `path.curNode`, with which to expand `path`.
 * @param {Object} ruleProps The rule properties of `sub`.
 * @param {boolean} [buildTrees] Specify constructing parse trees for printing.
 */
function baseExpandPath(heap, path, sub, ruleProps, buildTrees) {
	// Create a new path by expanding `path` with its subnode, `sub`.
	var newPath = createPath(path, sub, ruleProps)

	// Discard semantically illegal parse.
	if (newPath === -1) {
		return
	}

	// If `buildTrees`, generate a reverse linked list of path items for constructing graph representations of the parse trees in `printParseResults` (after parse completion).
	if (buildTrees) {
		newPath.ruleProps = ruleProps
		newPath.prev = path
	}

	// Add `newPath` to heap.
	heap.push(newPath)
}

/**
 * Creates a new path by expanding `prevPath` with `sub`.
 *
 * @private
 * @static
 * @param {Object} prevPath The previous path from which to expand.
 * @param {Object} sub The subnode of `prevPath`'s last node.
 * @param {Object} ruleProps The rule properties of `sub`.
 * @returns {Object|number} Returns the new path if semantically legal, else `-1`.
 */
function createPath(prevPath, sub, ruleProps) {
	var prevNextItemList = prevPath.nextItemList
	var newCost = prevPath.cost + ruleProps.cost

	var newPath = {
		// The previously added node whose subnodes this path can expand from.
		curNode: undefined,
		// The linked list of yet-to-parse second nodes of previous binary rules and conjugative text objects of previous insertion rules. When `curNode` is `undefined` after reaching a terminal symbol, inspect `nextItemList` to complete the binary rules and conjugate the text objects.
		nextItemList: prevNextItemList,
		// The reverse linked list of yet-to-reduce semantics.
		semanticList: undefined,
		// The path's display text.
		text: prevPath.text,
		// The reverse linked list of person-number properties to conjugate text objects.
		personNumberList: prevPath.personNumberList,
		// The grammatical properties to conjugate text of terminal rules in `curNode.subs`.
		gramProps: undefined,
		// The cost of the path from the start node.
		cost: newCost,
		// The cost of the path + heuristic estimate of the minimum cost to complete the parse tree.
		// `prevPath.nextItemList.minCost` is the total heuristic cost of incomplete branches from previous binary rules.
		minCost: newCost + (prevNextItemList ? prevNextItemList.minCost : 0),
	}

	if (ruleProps.isNonterminal) {
		// Append `sub`'s semantics, if any, to `prevPath.semanticList`.
		newPath.semanticList = appendSemantic(prevPath.semanticList, prevNextItemList ? prevNextItemList.nodeCount : 0, ruleProps)

		// Discard if semantically illegal parse.
		if (newPath.semanticList === -1) {
			return -1
		}

		// The next node this path can expand from.
		// The heuristic estimate of the minimum cost to complete branch that follows this next node.
		newPath.minCost += (newPath.curNode = sub.node).minCost

		/**
		 * The grammatical properties (`form` and `acceptedTense`) used to conjugate display text on child nodes produced by `sub.node` (now `newPath.curNode`).
		 *
		 * `ruleProps.gramProps[0]`, if exists, applies only to these child nodes and not to those of a sibling node (`sub.next.node`) if `sub` is a binary node.
		 *
		 * `ruleProps.gramProps` only occurs on nonterminal nodes.
		 */
		newPath.gramProps = ruleProps.gramProps && ruleProps.gramProps[0]

		// Prepend `ruleProps.personNumber` to `prevPath.personNumberList` which conjugates display text of nominative verbs within this subtree that follow `newPath`.
		if (ruleProps.personNumber) {
			newPath.personNumberList = prependPersonNumber(prevPath, ruleProps.personNumber)
		}

		// Non-edit rule.
		if (ruleProps.insertedSymIdx === undefined) {
			// All binary rules are nonterminal rules. Prepend the second subnode to `nextItemList`, and complete the rule after completing the branch that the first subnode produces.
			var subNext = sub.next
			if (subNext) {
				var nextNode = subNext.node

				// The heuristic estimate of the minimum cost to complete the second branch of this binary rule.
				newPath.minCost += nextNode.minCost

				if (prevNextItemList) {
					newPath.nextItemList = {
						// The second node of this binary rule to parse after completing the first node's branch.
						node: nextNode,
						// The grammatical properties (`form` and `acceptedTense`) used to conjugate display text on child nodes that `sub.node.next` produces. These properties do not apply to the leading sibling node in this biinary rule (i.e., `sub.node`).
						gramProps: ruleProps.gramProps && ruleProps.gramProps[1],
						// The total heuristic estimate of the minimum cost to complete this branch + the minimum cost of all yet-to-parse branches from previous binary rules.
						minCost: prevNextItemList.minCost + nextNode.minCost,
						/**
						 * The number of nodes in the `nextItemList` that can produce a semantic. This excludes other nodes and conjugative text. Used to determine if a RHS semantic is complete (no more semantics will follow it) and can be reduced with the preceding LHS semantic.
						 *
						 * If `ruleProps.secondRHSCanProduceSemantic` is `false`, then there will never be a semantic down the second branch of this binary rule, and a RHS semantic in the first branch can freely reduce with any preceding LHS semantic found before this rule. Else, prevent the first branch's RHS semantic(s) from reducing with LHS semantics found before this rule.
						 */
						nodeCount: prevNextItemList.nodeCount + ruleProps.secondRHSCanProduceSemantic,
						// The number of items in `nextItemList`.
						size: prevNextItemList.size + 1,
						// The next item that follows after completing this branch, created from the previous binary or insertion rule.
						next: prevNextItemList,
					}
				} else {
					newPath.nextItemList = {
						node: nextNode,
						gramProps: ruleProps.gramProps && ruleProps.gramProps[1],
						minCost: nextNode.minCost,
						nodeCount: ruleProps.secondRHSCanProduceSemantic,
						size: 1,
					}
				}
			}
		}

		// Insertion rule.
		// Insertions only exist on nonterminal rules because they can only be built from binary rules. This might change if we enable terminal symbols to be in a RHS with another terminal or nonterminal symbol (or multiple).
		else {
			// Insertions always have text. Edit rules can be made from insertions and lack text, but they behave as normal rules (with `insertedSymIdx`).
			if (ruleProps.insertedSymIdx === 1) {
				// Do not traverse the second branch of insertion rules that use the `<blank>` symbol (i.e., (text) insertions that only occur at the end of input), because that second branch does not produce text.

				// Will conjugate text after completing first branch in this binary reduction. Used in nominative case, which relies on person-number in the first branch (verb precedes subject).
				if (prevNextItemList) {
					newPath.nextItemList = {
						// The display text to append after completing the first branch and determining the person-number property for conjugation, if necessary.
						text: ruleProps.text,
						// The total heuristic estimate of the minimum cost to complete all yet-to-parse branches from previous binary rules.
						minCost: prevNextItemList.minCost,
						// The number of nodes in the `nextItemList` that can produce a semantic. This excludes other nodes and conjugative text. Used to determine if a RHS semantic is complete (no more semantics will follow it) and can be reduced with the preceding LHS semantic.
						nodeCount: prevNextItemList.nodeCount,
						// The number of items in `nextItemList`.
						size: prevNextItemList.size + 1,
						// The next item that follows after completing this branch, created from the previous binary or insertion rule.
						next: prevNextItemList,
					}
				} else {
					newPath.nextItemList = {
						text: ruleProps.text,
						minCost: 0,
						nodeCount: 0,
						size: 1,
					}
				}
			} else {
				/**
				 * Append text, if any, to the previous path's text, performing any necessary person-number conjugation.
				 *
				 * Pass `prevPath.personNumberList` because if `ruleProps.personNumber` exists (and is on `newPath.personNumberList`), then it would have already conjugated `ruleProps.text` so the property is intended for other conjugation.
				 *
				 * Do not pass the parent rule's `gramProps` because that conjugation was performed during the insertion rule's compilation.
				 */
				newPath.text += conjugateText(ruleProps.text, prevPath.personNumberList)
			}
		}
	}

	// Terminal rule.
	else {
		// Append `sub`'s RHS semantics, if any, to `prevPath.semanticList` and then reduce up to the first incompletely reduced node.
		newPath.semanticList = reduceSemanticTree(prevPath.semanticList, prevNextItemList ? prevNextItemList.nodeCount : 0, ruleProps)

		// Discard if semantically illegal parse.
		if (newPath.semanticList === -1) {
			return -1
		}

		// Append text, if any, to the previous path's text, performing any necessary conjugation. No text if terminal node is a stop sequence.
		if (ruleProps.text) {
			// `prevPath.gramProps` is the grammatical properties map specifically for this node, assigned in accordance with this node's position within the parent node's RHS.
			newPath.text += conjugateText(ruleProps.text, newPath.personNumberList, prevPath.gramProps, ruleProps.tense)

			/**
			 * Prepend `ruleProps.personNumber` to `prevPath.personNumberList` which conjugates display text of nominative verbs within this subtree that follow `newPath`; i.e., `ruleProps.personNumber` does not conjugate `newPath.text`.
			 *
			 * For use by `[nom-users]` subjects after term sequence flattening, which appends `text` to the sequence's nonterminal node and then marks the node terminal. For example:
			 *   `[nom-users]` -> `[1-sg]`, `me`, personNumber: "oneSg", text: "I"
			 */
			if (ruleProps.personNumber) {
				newPath.personNumberList = prependPersonNumber(prevPath, ruleProps.personNumber)
			}
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
 * @private
 * @static
 * @param {Object} semanticList The previous path's semantic linked list to append.
 * @param {number} nextNodeCount The number of nodes in the previous path's `nextItemList` that can produce a semantic. Used to determine if a RHS semantic is complete (no more semantics will follow it) and can be reduced with the preceding LHS semantic.
 * @param {Object} ruleProps The nonterminal rule's rule properties.
 * @param {Object[]} [ruleProps.semantic] The new nonterminal rule's semantic, if any.
 * @param {boolean} [ruleProps.semanticIsReduced] Specify `ruleProps.semantic` is reduced.
 * @param {Object[]} [ruleProps.insertedSemantic] A RHS semantic of an insertion rule which also contains LHS semantic.
 * @param {boolean} [ruleProps.rhsCanProduceSemantic] Specify the new nonterminal rule's RHS symbol can produce a semantic.
 * @param {string} [ruleProps.anaphoraPersonNumber] The person-number of the referent anaphor with which the antecedent semantic must match.
 * @returns {Object|number} Returns the semantic linked list if appendage is semantically legal, else `-1`.
 */
function appendSemantic(semanticList, nextNodeCount, ruleProps) {
	// If `ruleProps.insertedSemantic` exists, then it is a RHS semantic and `ruleProps.semantic` also exists and is a LHS semantic.
	if (ruleProps.insertedSemantic) {
		/**
		 * Check if `semanticList.prev.semantic` is `intersect()` and `semanticList.semantic` contains a semantic identical to `ruleProps.semantic` for which multiple instances of that semantic function are forbidden within the same set of `intersect()` arguments.
		 *
		 * This lookahead check catches illegal semantic formations that would otherwise not be caught until the LHS `ruleProps.insertedSemantic` is complete, reduced with `ruleProps.semantic`, and then the resulting semantic is reduces with the parent `intersect()`.
		 *
		 * Note: This check is disabled because it never succeeded; i.e., is futile.
		 */
		// if (semanticList && semanticList.isRHS && semantic.isForbiddenMultiple(semanticList, ruleProps.semantic)) {
		// 	return -1
		// }

		return {
			// The RHS semantic.
			semantic: ruleProps.insertedSemantic,
			isRHS: true,
			prev: {
				// The LHS semantic.
				semantic: ruleProps.semantic,
				// The number of yet-to-parse second nodes of previous binary rules that produce semantics. Used to determine if the branches that follow this semantic are complete and that this semantic may be reduced with a RHS semantic.
				nextNodeCount: nextNodeCount,
				prev: semanticList,
			}
		}
	}

	var newSemantic = ruleProps.semantic
	if (newSemantic) {
		// `newSemantic` is reduced.
		if (ruleProps.semanticIsReduced) {
			if (semanticList) {
				if (!ruleProps.rhsCanProduceSemantic) {
					// No semantics can follow this node/branch. Hence, the rule's semantic can be reduced with the preceding LHS semantic before parsing the remainder of the branch. This enables finding and discarding semantically illegal parses earlier than otherwise.
					return baseReduceSemanticTree(semanticList, nextNodeCount, newSemantic)
				}

				if (semanticList.isRHS) {
					// Discard new RHS semantic, `newSemantic`, if `semanticList.prev.semantic` is `intersect()`, `semanticList.semantic` is completely reduced (i.e., RHS) and identical to `newSemantic`, and multiple instances of that identical semantic are forbidden within the arguments of `intersect()`.
					if (semantic.isForbiddenMultiple(semanticList, newSemantic)) {
						return -1
					}

					// Merge RHS (i.e., reduced) semantic with previous semantic if also reduced.
					var newRHSSemantic = semantic.mergeRHS(semanticList.semantic, newSemantic)

					// Discard if RHS is semantically illegal (e.g., contains duplicates).
					if (newRHSSemantic === -1) {
						return -1
					}

					return {
						// The RHS semantic.
						semantic: newRHSSemantic,
						isRHS: true,
						prev: semanticList.prev,
					}
				}

				// Check if reducing `newSemantic` with LHS `semanticList` and merging the resulting semantic with RHS `semanticList.prev` will produce an illegal semantic. These illegal semantics would otherwise be caught later.
				if (isIllegalSemanticReduction(semanticList, newSemantic)) {
					return -1
				}
			}

			return {
				// The RHS semantic.
				semantic: newSemantic,
				isRHS: true,
				prev: semanticList,
			}
		}

		/**
		 * `newSemantic` is LHS (i.e., not reduced).
		 *
		 * Discard new LHS semantic, `newSemantic`, if `semanticList.prev.semantic` is `intersect()`, `semanticList.semantic` is completely reduced (i.e., RHS) and identical to `newSemantic`, and multiple instances of that identical semantic are forbidden within the arguments of `intersect()`.
		 *
		 * This lookahead check catches illegal semantic formations that would otherwise not be caught until the LHS `newSemantic` is complete and reduced with the parent `intersect()`.
		 */
		else if (semanticList && semanticList.isRHS && semantic.isForbiddenMultiple(semanticList, newSemantic)) {
			return -1
		}

		return {
			// The LHS semantic.
			semantic: newSemantic,
			// The number of yet-to-parse second nodes of previous binary rules that produce semantics. Used to determine if the branches that follow this semantic are complete and that this semantic may be reduced with a RHS semantic.
			nextNodeCount: nextNodeCount,
			prev: semanticList,
		}
	}

	if (ruleProps.anaphoraPersonNumber) {
		// Resolve anaphora by copying the matching antecedent semantic. Only invoked here (not in `baseReduceSemanticTree()`) because `anaphoraPersonNumber` only occurs on nonterminal rules.
		var newRHSSemantic = resolveAnaphora(semanticList, ruleProps.anaphoraPersonNumber)
		if (newRHSSemantic === -1) {
			return -1
		}

		// Reduce the path's semantic tree up to the first incompletely reduced node because no semantics can follow this node/branch.
		return baseReduceSemanticTree(semanticList, nextNodeCount, newRHSSemantic)
	}

	// No new semantic to append.
	return semanticList
}

/**
 * When no semantics can follow this node/branch (e.g., a terminal rule), appends a RHS semantic, if any, to the previous path's semantic list, and then reduces the path's semantic tree up to the first incompletely reduced node.
 *
 * Fails if resulting semantic is illegal (e.g., duplicates within a RHS semantic), and then returns `-1`.
 *
 * Only invoked from `createPath()` on terminal nodes, because all other reductions know `ruleProps.rhsSemantic` exists and use `baseReduceSemanticTree()`.
 *
 * @private
 * @static
 * @param {Object} semanticList The previous path's semantic linked list to append and reduce.
 * @param {number} nextNodeCount The number of nodes in the previous path's `nextItemList` that can produce a semantic. Used to determine if a RHS semantic is complete (no more semantics will follow it) and can be reduced with the preceding LHS semantic.
 * @param {Object} ruleProps The terminal rule's rule properties.
 * @param {Object[]} [ruleProps.rhsSemantic] The rule's RHS semantic.
 * @param {string} [ruleProps.anaphoraPersonNumber] The person-number of the referent anaphor with which the antecedent semantic must match.
 * @returns {Object|number} Returns the reduced semantic linked list if reduction is semantically legal, else `-1`.
 */
function reduceSemanticTree(semanticList, nextNodeCount, ruleProps) {
	if (ruleProps.semantic) {
		// Append `ruleProps.semantic` to `semanticList` and reduce up to the first incompletely reduced node.
		return baseReduceSemanticTree(semanticList, nextNodeCount, ruleProps.semantic)
	}

	// `anaphoraPersonNumber` appears on terminal rules following `flattenTermSequence`.
	if (ruleProps.anaphoraPersonNumber) {
		// Resolve anaphora by copying the matching antecedent semantic. Only invoked here (not in `baseReduceSemanticTree()`) because `anaphoraPersonNumber` only occurs on nonterminal rules.
		var newRHSSemantic = resolveAnaphora(semanticList, ruleProps.anaphoraPersonNumber)
		if (newRHSSemantic === -1) {
			return -1
		}

		// Reduce the path's semantic tree up to the first incompletely reduced node because no semantics can follow this node/branch.
		return baseReduceSemanticTree(semanticList, nextNodeCount, newRHSSemantic)
	}

	if (semanticList.isRHS) {
		var prevSemanticListItem = semanticList.prev

		// Instead of blindly passing `semanticList.semantic` to `baseReduceSemanticTree()` as `rhsSemantic` , check if the loop in `baseReduceSemanticTree()` will fail to avoid unnecessarily recreating `semanticList` in the function. This condition is true for 92% of occurrences.
		if (!prevSemanticListItem || nextNodeCount > prevSemanticListItem.nextNodeCount) {
			return semanticList
		}

		// Reduce the semantic list up to the first incompletely reduced node.
		return baseReduceSemanticTree(prevSemanticListItem, nextNodeCount, semanticList.semantic)
	}

	if (nextNodeCount <= semanticList.nextNodeCount) {
		// Attempting to reduce a LHS semantic without RHS arguments. Currently, only ever `intersect()` and `not()`; e.g., "people who follow people".
		return -1
	}

	return semanticList
}

/**
 * The base implementation of `reduceSemanticTree()`, without support for handling no `rhsSemantic` argument, that appends a RHS semantic to the previous path's semantic list, and then reduces the path's semantic tree up to the first incompletely reduced node.
 *
 * Merges the rule's semantic, if any, with the preceding RHS semantic(s), if any. Then reduces the RHS semantics with any preceding LHS semantics in the tree, up to a LHS semantic whose parse node has a second child node (i.e., a second branch) yet to be reduced. I.e., a LHS semantic can only be reduced after all of the RHS semantics have been found.
 *
 * Fails if resulting semantic is illegal (e.g., duplicates within a RHS semantic), and then returns `-1`.
 *
 * @private
 * @static
 * @param {Object} semanticList The previous path's semantic linked list to append and reduce.
 * @param {number} nextNodeCount The number of nodes in the previous path's `nextItemList` that can produce a semantic. Used to determine if a RHS semantic is complete (no more semantics will follow it) and can be reduced with the preceding LHS semantic.
 * @param {Object[]} rhsSemantic The RHS semantic.
 * @returns {Object|number} Returns the reduced semantic linked list if reduction is semantically legal, else `-1`.
 */
function baseReduceSemanticTree(semanticList, nextNodeCount, rhsSemantic) {
	// Reduce the semantic tree up to a LHS semantic whose parse node has a second child node (i.e., a second branch) yet to be reduced.
	while (semanticList) {
		// Merge RHS semantics.
		if (semanticList.isRHS) {
			rhsSemantic = semantic.mergeRHS(semanticList.semantic, rhsSemantic)

			// Discard if RHS is semantically illegal (e.g., contains duplicates).
			if (rhsSemantic === -1) {
				return -1
			}
		}

		// Reduce the LHS semantic after parsing the right-most branch that follows the semantic.
		else if (nextNodeCount <= semanticList.nextNodeCount) {
			rhsSemantic = semantic.reduce(semanticList.semantic, rhsSemantic)

			// Discard if reduction is semantically illegal (e.g., LHS forbids multiple arguments but RHS is multiple semantics).
			if (rhsSemantic === -1) {
				return -1
			}
		}

		// Check if reducing `rhsSemantic` with LHS `semanticList` and merging the resulting semantic with RHS `semanticList.prev` will produce an illegal semantic. These illegal semantics would otherwise be caught later.
		else if (isIllegalSemanticReduction(semanticList, rhsSemantic)) {
			return -1
		}

		// Stop at a LHS semantic whose parse node has yet-to-reduce child nodes.
		else {
			break
		}

		semanticList = semanticList.prev
	}

	return {
		// The RHS semantic.
		semantic: rhsSemantic,
		isRHS: true,
		prev: semanticList,
	}
}

/**
 * Checks if reducing `rhsSemantic` with LHS `semanticList` and merging the resulting semantic with RHS `semanticList.prev` will produce an illegal semantic.
 *
 * LHS `semanticList` can not reduce with `rhsSemantic` because another semantic can come and merge with `rhsSemantic` as a RHS array. If `semanticList` has a `maxParams` of `1`, and will be copied for each semantic within the semantic array to contain `rhsSemantic`, then checks if that semantic will be illegal when merged with `semanticList.prev`.
 *
 * Example:
 * repositories-liked(me)  // `semanticList.prev`
 * -> repositories-liked() // `semanticList`
 *    -> 'me'              // `rhsSemantic`
 *       -> ? - Normally, must wait to inspect '?'. Instead, this check discover the reduced semantic will
 *              be illegal.
 *
 * @private
 * @static
 * @param {Object} semanticList The previous path's semantic linked list, ending with a LHS semantic.
 * @param {Object[]} rhsSemantic The new RHS semantic.
 * @returns {boolean} Returns `true` if the resulting semantic will be illegal, else `false`.
 */
function isIllegalSemanticReduction(semanticList, rhsSemantic) {
	var prevSemanticNode = semanticList.semantic[0]

	// Check if `semanticList` will be copied for each of its RHS semantics (because it has a `maxParams` of `1`), and `semanticList.prev` is reduced.
	if (prevSemanticNode.semantic.maxParams === 1 && semanticList.prev && semanticList.prev.isRHS) {
		var prevPrevSemanticArray = semanticList.prev.semantic
		var prevPrevSemanticArrayLen = prevPrevSemanticArray.length

		for (var s = 0; s < prevPrevSemanticArrayLen; ++s) {
			var prevPrevSemanticNode = prevPrevSemanticArray[s]

			// Check if `semanticList` and `semanticList.prev` have the same root semantic function.
			if (prevSemanticNode.semantic === prevPrevSemanticNode.semantic) {
				// Check if `semanticList` + `rhsSemantic` and `semanticList.prev` will be semantically illegal.
				// If not, can not reduce `semanticList` + `rhsSemantic`, merge with `semanticList.prev`, and copy `semanticList` for the future semantics, as will eventually happen. This is because it is possible no semantics will come down this branch, which can not be determined in advance, and the copied function will remain illegally empty.
				if (semantic.isIllegalRHS(prevPrevSemanticNode.children, rhsSemantic)) {
					// Discard semantically illegal RHS (e.g., will contain duplicates).
					return true
				}
			}
		}
	}

	return false
}

/**
 * Prepends `newPersonNumber` to `prevPath.personNumberList` which conjugates display text of nominative verbs within this subtree that follow the current path.
 *
 * @private
 * @static
 * @param {Object} prevPath The previous path.
 * @param {string} newPersonNumber The new person-number property to prepend to `prevPath.personNumberList`.
 * @returns {Object} Returns the new person-number linked list.
 */
function prependPersonNumber(prevPath, newPersonNumber) {
	var nextItemListSize = prevPath.nextItemList ? prevPath.nextItemList.size : -1
	var prev = prevPath.personNumberList

	return {
		// The person-number property to conjugate display text of nominative verbs within the current subtree that follow the current path.
		personNumber: newPersonNumber,
		// The number of items in `newPath.nextItemList` at the position of the person-number property's definition in the parse tree. This determines if the following branches, which are associated with this person-number property, are complete and that this property can conjugate any successive display text for verbs.
		nextItemListSize: nextItemListSize,
		// The previous person-number property, not saved if for a previously completed subtree.
		prev: prev && prev.nextItemListSize <= nextItemListSize ? prev : undefined,
	}
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
 * Checks if a new, completed parse tree has a unique semantic and unique display text.
 *
 * Trees discarded for ambiguity result from the grammar, howoever, this does not mean the grammar should always be designed to avoid ambiguity. Sometimes, the necessary rules required to disambiguate expands the grammar (and state table) such that there is greater overhead for `Parser` (i.e., the number of shift and reduce actions) than the processing saved in `pfsearch`. In production, `Parser` consumes ~85% of processing while `pfsearch` consumes ~10% (when `k` is 7).
 *
 * @private
 * @static
 * @param {Object[]} trees The previously completed unique parse trees to compare against.
 * @param {Object} newTree The new parse tree.
 * @param {boolean} [printAmbiguity] Specify printing instances of ambiguity.
 * @returns {boolean} Returns `true` if `newTree` is unique, else `false`.
 */
function isUniqueTree(trees, newTree, printAmbiguity) {
	// Generate semantic string representation.
	var semanticStr = semantic.toString(newTree.semanticList.semantic)

	/**
	 * Check for duplicate semantics by comparing semantic string representations.
	 * - Return `false` if new semantic is identical to previously constructed (and cheaper) tree.
	 *
	 * Tests show 1.18x more likely to find a matching semantic faster by iterating backward.
	 */
	for (var t = trees.length - 1; t > -1; --t) {
		var tree = trees[t]

		if (tree.semanticStr === semanticStr) {
			if (printAmbiguity) {
				printAmbiguousPair(tree, newTree)
			}

			return false
		}

		if (tree.ambiguousSemantics && tree.ambiguousSemantics.indexOf(semanticStr) !== -1) {
			return false
		}
	}

	// Remove leading space.
	var textStr = newTree.text.slice(1)

	/**
	 * Check for duplicate display text.
	 * - If so, save new semantic to previous tree's `ambiguousSemantics` and return `false` to reject tree.
	 *
	 * Checking for duplicate text in a separate loop is faster than a single loop because there are ~200x a many semantic duplicates as display text duplicates. This decreases display text comparisons by 75% by avoiding comparisons on trees that eventually fail for duplicate semantics. Tests indicate ~20% of trees constructed are unique.
	 *
	 * Tests show 1.02x more likely to find a matching text faster by iterating backward.
	 */
	for (var t = trees.length - 1; t > -1; --t) {
		var tree = trees[t]

		if (tree.text === textStr) {
			if (printAmbiguity) {
				printAmbiguousPair(tree, newTree)
			}

			if (tree.ambiguousSemantics) {
				tree.ambiguousSemantics.push(semanticStr)
			} else {
				tree.ambiguousSemantics = [ semanticStr ]
			}

			return false
		}
	}

	// Tree is unique.
	newTree.semanticStr = semanticStr
	newTree.text = textStr

	return true
}

/**
 * Prints the ambiguous properties of `existingTree` and `newTree` (i.e., semantic or display text), and the parse tree of `newTree` if `pfsearch` was invoked with `buildTrees`.
 *
 * @private
 * @static
 * @param {Object} existingTree The existing (i.e., cheaper) parse tree to compare.
 * @param {Object} newTree The new parse tree to compare.
 */
function printAmbiguousPair(existingTree, newTree) {
	// Generate semantic string representation.
	newTree.semanticStr = semantic.toString(newTree.semanticList.semantic)
	// Remove leading space.
	newTree.text = newTree.text.slice(1)

	if (existingTree.semanticStr === newTree.semanticStr) {
		util.log(util.colors.yellow('Ambiguity') + ':', newTree.semanticStr)
		util.log('  ' + existingTree.text, existingTree.cost)
		util.log('  ' + newTree.text, newTree.cost)
	} else if (existingTree.text === newTree.text) {
		util.log(util.colors.yellow('Ambiguity') + ':', newTree.text)
		util.log('  ' + existingTree.semanticStr, existingTree.cost)
		util.log('  ' + newTree.semanticStr, newTree.cost)
	} else {
		throw new Error('`printAmbiguousPair()` invoked an unambiguous pair')
	}

	util.log()

	// Print parse tree of `newTree` if `pfsearch` invoked with `buildTrees`.
	if (newTree.prev) {
		require('./printParseResults')({ trees: [ newTree ] }, { trees: true })
		util.log()
	}
}