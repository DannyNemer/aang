var util = require('../util/util')
var BinaryHeap = require('./BinaryHeap')
var semantic = require('../grammar/semantic')
var calcHeuristicCosts = require('./calcHeuristicCosts')


/**
 * Uses A* path search to find the K-best parse trees in a parse forest returned by `Parser`. Also generates their semantic trees and conjugated display texts.
 *
 * @static
 * @memberOf forestSearch
 * @param {Object} startNode The root node of the parse forest returned by `Parser`.
 * @param {number} K The maximum number of parse trees to find.
 * @param {boolean} buildDebugTrees Specify constructing parse trees for printing at expense of speed.
 * @param {boolean} printStats Specify printing performance statistics.
 * @returns {Object[]} Returns the K-best parse trees.
 */
exports.search = function (startNode, K, buildDebugTrees, printStats) {
	// Calculate the (admissible) heuristic estimates of the minimum costs of a subtree that can be constructed from each node.
	calcHeuristicCosts(startNode)

	// Array of all completed parse trees.
	var trees = []
	// Min-heap of all partially constructed trees.
	var heap = new BinaryHeap
	// The number of trees rejected for containing duplicate semantics or display text.
	var ambiguousTreesCount = 0

	heap.push({
		// When item popped from `heap`, will look at `item.node.subs` for next steps.
		node: startNode,
		// If no `node`, because reached end of branch, go to next branch - either node or text array needing conjugation.
		// Reverse linked list, pointing to previously incomplete binary rules.
		nextNodes: undefined,
		// Number of elements in `nextNodes`, excluding text to append.
		// Used as marker of when can merge with LHS semantic -> have completed full branch.
		nextNodesLen: 0,
		// Linked list of semantics of parse tree, reduces to single semantic when parse complete.
		// Reverse linked list, pointing to previously added semantic in tree.
		semantics: undefined,
		// Display text of parse tree.
		text: '',
		// Linked list of properties for conjugation of text.
		// Reverse linked list, pointing to previously added semantic `gramProps` in tree.
		gramProps: undefined,
		// Cost of path from the start node.
		costSoFar: 0,
		// Cost of path + heuristic estimate of the minimum cost to complete the parse tree.
		cost: 0,
	})

	while (heap.content.length > 0) {
		var item = heap.pop()

		var node = item.node

		// Previously reached a terminal symbol at an end of a branch.
		if (!node) {
			var nextNodes = item.nextNodes
			while (nextNodes) {
				var text = nextNodes.text

				// Stop when at a node
				if (!text) break

				if (text.constructor === Array) {
					// Conjugate text of inserted branches which are the second of 2 RHS symbols
					// Used in nominative case, which relies on person-number in 1st branch (verb precedes subject)
					item.text += conjugateTextArray(item, text)
				} else {
					item.text += ' ' + text
				}

				nextNodes = nextNodes.prev
			}

			// No nodes remain; tree construction complete.
			if (!nextNodes) {
				// Save tree if unique: not semantically or textually identical to previous trees.
				if (treeIsUnique(trees, item)) {
					// Add new tree to array; stop parsing if is K-th tree.
					if (trees.push(item) === K) break
				} else {
					++ambiguousTreesCount
				}

				continue
			} else {
				item.nextNodes = nextNodes.prev
				--item.nextNodesLen
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
					var newItem = createItem(sub, item, ruleProps[r])
					if (newItem === -1) continue // Semantically illegal parse -> reject

					// If `buildDebugTrees` is `true`, add a reverse linked list in order to construct and print parse trees for debugging at parse completion.
					if (buildDebugTrees) {
						newItem.ruleProps = ruleProps[r]
						newItem.prev = item
					}

					heap.push(newItem)
				}
			}

			else {
				var newItem = createItem(sub, item, ruleProps)
				if (newItem === -1) continue // semantically illegal parse -> reject

				// If `buildDebugTrees` is `true`, add a reverse linked list in order to construct and print parse trees for debugging at parse completion.
				if (buildDebugTrees) {
					newItem.ruleProps = ruleProps
					newItem.prev = item
				}

				heap.push(newItem)
			}
		}
	}

	if (printStats) {
		util.log('paths created:', heap.pushCount)
		util.log('ambiguous trees:', ambiguousTreesCount)
	}

	return trees
}

// Create new item as an extension of current tree down this sub
function createItem(sub, prevItem, ruleProps) {
	var newCost = prevItem.costSoFar + ruleProps.cost

	var newItem = {
		node: undefined,
		nextNodes: prevItem.nextNodes,
		nextNodesLen: prevItem.nextNodesLen,
		// Linked list of semantics
		semantics: undefined,
		text: undefined,
		// Linked list of properties for conjugation of text
		gramProps: prevItem.gramProps,
		// Cost of path from the start node
		costSoFar: newCost,
		// Cost of path + heuristic estimate of the minimum cost to complete the parse tree.
		// If rule is binary, `sub.minCost` includes cost of both RHS symbols (i.e., `sub.next`).
		// `nextNodes.minCost` is total heuristic cost of incomplete branches from previous binary rules.
		cost: newCost + sub.minCost + (prevItem.nextNodes ? prevItem.nextNodes.minCost : 0),
	}

	var newSemantic = ruleProps.semantic

	// Insertion
	if (ruleProps.insertionIdx !== undefined) {
		// If 'insertedSemantic' exists, then `newSemantic` also exists and is LHS.
		if (ruleProps.insertedSemantic) {
			// Discard new LHS semantic if `prevSemantic` is RHS, is identical to `newSemantic`, and multiple instances of the semantic are forbidden
			var prevSemantic = prevItem.semantics
			if (prevSemantic && prevSemantic.isRHS && semantic.isForbiddenMultiple(prevSemantic.semantic, newSemantic)) {
				return -1
			}

			newItem.semantics = {
				semantic: ruleProps.insertedSemantic,
				isRHS: true,
				prev: {
					semantic: newSemantic,
					nextNodesLen: prevItem.nextNodesLen,
					prev: prevSemantic,
				}
			}
		} else if (newSemantic) {
			var prevSemantic = prevItem.semantics

			if (ruleProps.semanticIsRHS) {
				if (prevSemantic && prevSemantic.isRHS) {
					newSemantic = semantic.mergeRHS(prevSemantic.semantic, newSemantic)

					// Discard if RHS contains duplicates.
					if (newSemantic === -1) return -1

					newItem.semantics = {
						semantic: newSemantic,
						isRHS: true,
						prev: prevSemantic.prev,
					}
				} else {
					newItem.semantics = {
						semantic: newSemantic,
						isRHS: true,
						prev: prevSemantic,
					}
				}
			} else {
				// Discard new LHS semantic if `prevSemantic` is RHS, is identical to `newSemantic`, and multiple instances of the semantic are forbidden.
				if (prevSemantic && prevSemantic.isRHS && semantic.isForbiddenMultiple(prevSemantic.semantic, newSemantic)) {
					return -1
				}

				newItem.semantics = {
					semantic: newSemantic,
					nextNodesLen: prevItem.nextNodesLen,
					prev: prevSemantic,
				}
			}
		} else {
			newItem.semantics = prevItem.semantics
		}


		newItem.node = sub.node

		if (ruleProps.gramProps) {
			newItem.gramProps = {
				props: ruleProps.gramProps,
				prev: prevItem.gramProps,
			}
		}

		var text = ruleProps.text
		if (ruleProps.insertionIdx === 1) {
			newItem.text = prevItem.text

			// Conjugate text after completing first branch in this binary reduction
			// Used in nominative case, which relies on person-number in 1st branch (verb precedes subject)
			newItem.nextNodes = {
				text: text,
				minCost: prevItem.nextNodes ? prevItem.nextNodes.minCost : 0,
				prev: prevItem.nextNodes,
			}
		} else {
			if (text.constructor === Array) {
				// Text requires conjugation.
				newItem.text = prevItem.text + conjugateTextArray(newItem, text)
			} else {
				// No conjugation.
				newItem.text = prevItem.text + ' ' + text
			}
		}
	}

	else {
		// Nonterminal rule
		if (sub.node.subs) {
			if (newSemantic) {
				if (ruleProps.semanticIsRHS) {
					newItem.semantics = {
						semantic: newSemantic,
						isRHS: true,
						prev: prevItem.semantics,
					}
				} else {
					// Discard new LHS semantic if `prevSemantic` is RHS, is identical to `newSemantic`, and multiple instances of the semantic are forbidden
					var prevSemantic = prevItem.semantics
					if (prevSemantic && prevSemantic.isRHS && semantic.isForbiddenMultiple(prevSemantic.semantic, newSemantic)) {
						return -1
					}

					newItem.semantics = {
						semantic: newSemantic,
						nextNodesLen: prevItem.nextNodesLen,
						prev: prevSemantic,
					}
				}
			} else {
				newItem.semantics = prevItem.semantics
			}

			newItem.node = sub.node

			// Grammatical properties are only on nonterminal rules.
			if (ruleProps.gramProps) {
				newItem.gramProps = {
					props: ruleProps.gramProps,
					prev: prevItem.gramProps,
				}
			}

			// All binary rules are nonterminal rules.
			var subNext = sub.next
			if (subNext) {
				newItem.nextNodes = {
					node: subNext.node,
					minCost: subNext.minCost + (prevItem.nextNodes ? prevItem.nextNodes.minCost : 0),
					prev: prevItem.nextNodes,
				}

				++newItem.nextNodesLen
			}
		}

		// Terminal rule
		// If there is a semantic on the terminal rule, then it is reduced (i.e., RHS).
		else {
			var prevSemantic = prevItem.semantics
			while (prevSemantic) {
				if (prevSemantic.isRHS) {
					if (newSemantic) {
						newSemantic = semantic.mergeRHS(prevSemantic.semantic, newSemantic)

						// Discard if RHS contains duplicates.
						if (newSemantic === -1) return -1
					} else {
						newSemantic = prevSemantic.semantic
					}

					prevSemantic = prevSemantic.prev
				}

				// LHS after parsing the right-most branch that follows the semantic (i.e., completed the reduction).
				else if (prevItem.nextNodesLen <= prevSemantic.nextNodesLen) {
					// A semantic function without an argument - currently can only be `intersect()`.
					// This will need to be modified if we incorporate semantic functions that don't require arguments.
					if (!newSemantic) return -1

					newSemantic = semantic.reduce(prevSemantic.semantic, newSemantic)

					prevSemantic = prevSemantic.prev
				}

				// On left side of a reduction and cannot continue merging with LHS without completing its RHS (children).
				else break
			}

			if (newSemantic) {
				newItem.semantics = {
					semantic: newSemantic,
					isRHS: true,
					prev: prevSemantic,
				}
			} else {
				newItem.semantics = prevSemantic
			}
		}


		var text = ruleProps.text
		if (text) {
			if (text.constructor === Object) {
				newItem.text = prevItem.text + ' ' + conjugateText(newItem, text)
			} else {
				newItem.text = prevItem.text + ' ' + text
			}
		} else {
			newItem.text = prevItem.text
		}
	}

	return newItem
}

// Called for insertion rules, which contain an array for text with symbol(s) needing conjugation
// - Traverses array and conjugates each text Object
// Returns string concatenation of all elements, separated by spaces, prepended with a space
function conjugateTextArray(item, textArray) {
	var concatStr = ''

	for (var t = 0, textArrayLen = textArray.length; t < textArrayLen; ++t) {
		var text = textArray[t]
		if (text.constructor === Object) {
			concatStr += ' ' + conjugateText(item, text)
		} else {
			concatStr += ' ' + text
		}
	}

	return concatStr
}

// Loop through from end of linked list, find rule most recently added
// NOTE: Does not allow for same prop to be used in multiple places. Deletion of props occurs after single use.
function conjugateText(item, textObj) {
	var gramPropsList = item.gramProps

	while (gramPropsList) {
		var gramProps = gramPropsList.props

		var verbForm = gramProps.verbForm
		if (verbForm && textObj[verbForm]) {
			// Remove `gramProps` from linked list and rebuild end of list up to its position.
			spliceGramPropsList(item, gramPropsList)
			return textObj[verbForm]
		}

		var personNumber = gramProps.personNumber
		if (personNumber && textObj[personNumber]) {
			// Remove `gramProps` from linked list and rebuild end of list up to its position.
			spliceGramPropsList(item, gramPropsList)
			return textObj[personNumber]
		}

		var gramCase = gramProps.gramCase
		if (gramCase && textObj[gramCase]) {
			// Rule with `gramCase` either has `personNumber` for nominative (so will be needed again), or doesn't have `personNumer` (for objective case) and can be deleted.
			if (!personNumber) {
				// Remove `gramProps` from linked list and rebuild end of list up to its position.
				spliceGramPropsList(item, gramPropsList)
			}

			return textObj[gramCase]
		}

		gramPropsList = gramPropsList.prev
	}

	util.logError('Failed to conjugate:', textObj, item.gramProps)
	throw new Error('Failed conjugation')
}

// Remove the element `gramPropsToRemove` from the `gramProps` list `item.gramProps`
// The `gramProps` that will be used may not be the most recent, which requires the list to be rebuilt up to the `gramProps` used because the list elements are shared amongst paths.
// - Better to construct new portion of linked list after finding the gramProps, instead of while traversing, because list does not need splicing when it is `gramCase` match for a `gramProps` also with a `personNumber`
function spliceGramPropsList(item, gramPropsToRemove) {
	var thisGramProps = item.gramProps
	var prevGramProps

	// Find which element in `item.gramProps` is to be removed.
	while (thisGramProps !== gramPropsToRemove) {
		if (prevGramProps) {
			prevGramProps = prevGramProps.prev = {
				gramProps: thisGramProps.props,
			}
		} else {
			prevGramProps = item.gramProps = {
				gramProps: thisGramProps.props,
			}
		}

		thisGramProps = thisGramProps.prev
	}

	// Point the predecessor `prev` to successor of the element to be removed.
	if (prevGramProps) {
		prevGramProps.prev = gramPropsToRemove.prev
	} else {
		item.gramProps = gramPropsToRemove.prev
	}
}

/**
 * Determines if a new, completed parse tree has a unique semantic and unique display text.
 *
 * @private
 * @static
 * @param {Object[]} trees The previously completed unique parse trees to compare against.
 * @param {Object} newTree The new parse tree.
 * @returns {boolean} Returns `true` if `newTree` is unique.
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

// When `buildDebugTrees` is `true`, link each `item` to the previous `item` and its new `ruleProps`. After parse completion, construct tree representations from the linked lists of the `K` best paths.
function pathToTree(item, opts) {
	var pathToTreeOptsSchema = {
		// Specifies displaying the start and end indexes of each node's token range.
		showTokenRanges: { type: Boolean, optional: true },
		// Specifies displaying the cost of the path at each node (i.e., the cost of the path so far + the heuristic estimate of the cost remaining).
		showPathCosts: { type: Boolean, optional: true },
	}

	if (util.illFormedOpts(pathToTreeOptsSchema, opts)) {
		throw new Error('pathToTree: ill-formed opts')
	}

	// Stack of previous nodes lower in the parse tree (which become child nodes).
	var nodesStack = []

	while (true) {
		var node = item.node

		// Terminal rule
		if (!node) {
			var node = item.prev.node

			if (!node) {
				// Find last node (skipping the insertion text also stored in `nextNodes`).
				var prevNextNodes = item.prev.prev.nextNodes
				while (prevNextNodes.node.constructor !== Object) {
					prevNextNodes = prevNextNodes.prev
				}

				node = prevNextNodes.node
			}

			nodesStack.push({
				props: item.ruleProps,
				children: [ createNode(node.subs[0].node, opts) ],
			})
		}

		// Binary nonterminal rule
		else if (item.nextNodes && item.nextNodes !== item.prev.nextNodes && item.ruleProps.insertionIdx === undefined) {
			var newNodeA = createNode(node, opts, nodesStack.pop(), item.cost)
			var newNodeB = createNode(item.nextNodes.node, opts, nodesStack.pop())

			nodesStack.push({
				props: item.ruleProps,
				children: [ newNodeA, newNodeB ]
			})
		}

		// Unary nonterminal rule
		else {
			var newNode = createNode(node, opts, nodesStack.pop(), item.cost)

			// Start node
			if (!item.prev) return newNode

			nodesStack.push({
				props: item.ruleProps,
				children: [ newNode ],
			})
		}

		item = item.prev
	}
}

function createNode(node, opts, childNode, pathCost) {
	var newNode = {
		symbol: node.sym.name,
	}

	if (opts) {
		if (opts.showTokenRanges) {
			newNode.start = node.start
			newNode.end = node.start + node.size
		}

		if (opts.showPathCosts && pathCost !== undefined) {
			newNode.pathCost = pathCost
		}
	}

	// No childNode for terminal symbols.
	if (childNode) {
		// Order properties for insertions to be printed in order.
		if (childNode.props.insertionIdx === 1) {
			newNode.children = childNode.children
			newNode.props = childNode.props
		} else {
			newNode.props = childNode.props
			newNode.children = childNode.children
		}
	}

	return newNode
}


/**
 * Prints parse trees output by `forestSearch.search()`.
 *
 * @static
 * @memberOf forestSearch
 * @param {Object[]} trees The parse trees to print.
 * @param {boolean} printCosts Specify printing the cost of each parse tree.
 * @param {boolean} printTrees Specify printing a graph representation of `trees`.
 */
exports.print = function (trees, printCosts, printTrees) {
	for (var t = 0, treesLen = trees.length; t < treesLen; ++t) {
		var tree = trees[t]

		if (tree.semantics.prev) throw new Error('semantics remain')

		// Check parse results are correctly sorted by increasing cost.
		// Clean costs because of JS floating point number precision.
		if (t < treesLen - 1 && util.cleanFloat(tree.cost) > util.cleanFloat(trees[t + 1].cost)) {
			util.logError('Costs out of order:')
		}

		// Check A* cost heuristic calculation.
		if (tree.cost !== tree.costSoFar) {
			util.logError('Costs incorrect:', 'cost: ' + tree.cost + ', costSoFar: ' + tree.costSoFar)
		}

		// Print display text (and cost).
		util.log(tree.text + (printCosts ? ' ' + tree.cost : ''))

		// Print semantic
		util.log('  ' + tree.semanticStr)

		// Print additional semantics that produced identical display text.
		if (tree.disambiguation) {
			tree.disambiguation.forEach(function (semanticStr) {
				util.log('  ' + semanticStr)
			})
		}

		// Print trees (if constructed during parse forest search).
		if (printTrees) util.dir(pathToTree(tree, { showTokenRanges: false, showPathCosts: false }))
	}
}