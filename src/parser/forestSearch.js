var util = require('../util')
var BinaryHeap = require('./BinaryHeap')
var semantic = require('../grammar/semantic')
var calcHeuristicCosts = require('./calcHeuristicCosts')


// Use A* path search to find K-best trees in parse forest returned by parser, beginning at start node
exports.search = function (startNode, K, buildDebugTrees, printStats) {
	// Calculate the (admissible) heuristic estimates of the minimum costs of a subtree that can be constructed from each node
	calcHeuristicCosts(startNode)

	// Min-heap of all partially constructed trees
	var heap = new BinaryHeap
	// Array of all completed parse trees
	var trees = []

	var newItem = {
		// When item popped, will look at node's subs for next steps
		node: startNode,
		// If no `node`, because reached end of branch, go to next branch - either node or text array
		// Linked list
		nextNodes: undefined,
		// Number of elements in `nextNodes`, excluding text to append
		// Used as marker of when can merge with LHS semantic -> have completed full branch
		nextNodesLen: 0,
		// Linked list of semantics of parse tree, reduces to single semantic when parse complete
		// Reverse linked list, pointing to previously seen semantics
		semantics: undefined,
		// Display text of parse tree
		text: '',
		// Properties for conjugation of text
		gramProps: undefined,
		// Cost of path from the start node
		costSoFar: 0,
		// Cost of path + heuristic estimate of the minimum cost to complete the parse tree
		cost: 0,
	}

	heap.push(newItem)

	while (heap.content.length > 0) {
		var item = heap.pop()

		var node = item.node

		// Previously reached end of a branch
		if (!node) {
			var nextNodes = item.nextNodes
			while (nextNodes) {
				node = nextNodes.node

				// Stop when `node` is a node
				if (node.constructor === Object) break

				if (node.constructor === Array) {
					// Conjugate text of inserted branches which are the second of 2 RHS symbols
					// Used in nominative case, which relies on person-number in 1st branch (verb precedes subject)
					item.text += conjugateTextArray(item, node)
				} else {
					item.text += ' ' + node
				}

				nextNodes = nextNodes.next
			}

			// No nodes remain; tree construction complete
			if (!nextNodes) {
				// Tree is unique - not semantically or textually identical to previous trees
				// Discard tree if no unique
				if (treeIsUnique(trees, item)) {
					// Add new tree to array; stop parsing if is K-th tree
					if (trees.push(item) === K) break
				}

				continue
			} else {
				item.nextNodes = nextNodes.next
				item.nextNodesLen--
			}
		}

		// Loop through all possible children of this node
		for (var s = 0, subs = node.subs, subsLen = subs.length; s < subsLen; ++s) {
			var sub = subs[s]
			var ruleProps = sub.ruleProps

			// Array of multiple insertions - first can be a unary reduction with an empty
			if (ruleProps.constructor === Array) {
				for (var r = 0, rulePropsLen = ruleProps.length; r < rulePropsLen; ++r) {
					var newItem = createItem(sub, item, ruleProps[r])
					if (newItem === -1) continue // Semantically illegal parse -> reject

					// If `buildDebugTrees` is `true`, add a reverse linked list in order to construct and print parse trees for debugging at parse completion
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

				// If `buildDebugTrees` is `true`, add a reverse linked list in order to construct and print parse trees for debugging at parse completion
				if (buildDebugTrees) {
					newItem.ruleProps = ruleProps
					newItem.prev = item
				}

				heap.push(newItem)
			}
		}
	}

	if (printStats) {
		console.log('heap size:', heap.content.length)
		console.log('push:', heap.pushCount)
		console.log('pop:', heap.popCount)
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
		semantics: undefined,
		text: undefined,
		gramProps: prevItem.gramProps,
		// Cost of path from the start node
		costSoFar: newCost,
		// Cost of path + heuristic estimate of the minimum cost to complete the parse tree
		// If rule is binary, `sub.minCost` includes cost of both RHS symbols (i.e., `sub.next`)
		// `nextNodes.minCost` is total heuristic cost of incomplete branches from previous binary rules
		cost: newCost + sub.minCost + (prevItem.nextNodes ? prevItem.nextNodes.minCost : 0),
	}

	var newSemantic = ruleProps.semantic

	// Insertion
	if (ruleProps.insertionIdx !== undefined) {
		// If 'insertedSemantic' exists, then newSemantic also exists
		if (ruleProps.insertedSemantic) {
			// Discard if prevSemantic is RHS, is identical to newSemantic, and dups of the semantic are prevented
			var prevSemantic = prevItem.semantics
			if (prevSemantic && prevSemantic.isRHS && semantic.forbiddenDups(prevSemantic.semantic, newSemantic)) {
				return -1
			}

			newItem.semantics = {
				isRHS: true,
				semantic: ruleProps.insertedSemantic,
				prev: {
					semantic: newSemantic,
					nextNodesLen: prevItem.nextNodesLen,
					prev: prevSemantic,
				}
			}
		} else if (newSemantic) {
			var prevSemantic = prevItem.semantics

			if (ruleProps.semanticIsRHS) {
				if (prevSemantic.isRHS) {
					newSemantic = semantic.mergeRHS(prevSemantic.semantic, newSemantic)

					// RHS contains duplicates
					if (newSemantic === -1) return -1

					newItem.semantics = {
						isRHS: true,
						semantic: newSemantic,
						prev: prevSemantic.prev,
					}
				} else {
					newItem.semantics = {
						isRHS: true,
						semantic: newSemantic,
						prev: prevSemantic,
					}
				}
			} else {
				// Discard if prevSemantic is RHS, is identical to newSemantic, and dups of the semantic are prevented
				if (prevSemantic && prevSemantic.isRHS && semantic.forbiddenDups(prevSemantic.semantic, newSemantic)) {
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
				gramProps: ruleProps.gramProps,
				next: newItem.gramProps,
			}
		}

		var text = ruleProps.text
		if (ruleProps.insertionIdx === 1) {
			newItem.text = prevItem.text

			// Conjugate text after completing first branch in this binary reduction
			// Used in nominative case, which relies on person-number in 1st branch (verb precedes subject)
			newItem.nextNodes = {
				node: text,
				next: newItem.nextNodes,
				minCost: newItem.nextNodes ? newItem.nextNodes.minCost : 0
			}
		} else {
			if (text.constructor === Array) {
				// Text requires conjugation
				newItem.text = prevItem.text + conjugateTextArray(newItem, text)
			} else {
				// No conjugation
				newItem.text = prevItem.text + ' ' + text
			}
		}
	}

	else {
		// Nonterminal rule
		if (sub.node.subs) {
			if (newSemantic) {
				// A RHS semantic not at the base of the branch because of forestReduction
				if (ruleProps.semanticIsRHS) {
					// Last in semantics is always LHS (so far we have seen)
					newItem.semantics = {
						isRHS: true,
						semantic: newSemantic,
						prev: prevItem.semantics,
					}
				} else {
					// Discard if prevSemantic is RHS, is identical to newSemantic, and dups of the semantic are prevented
					var prevSemantic = prevItem.semantics
					if (prevSemantic && prevSemantic.isRHS && semantic.forbiddenDups(prevSemantic.semantic, newSemantic)) {
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

			// Grammatical properties are only on nonterminal rules
			if (ruleProps.gramProps) {
				newItem.gramProps = {
					gramProps: ruleProps.gramProps,
					next: newItem.gramProps,
				}
			}

			// All binary rules are nonterminal rules (hence, within sub.node.subs) - might change with reduceForest
			var subNext = sub.next
			if (subNext) {
				newItem.nextNodes = {
					node: subNext.node,
					next: newItem.nextNodes,
					minCost: subNext.minCost + (newItem.nextNodes ? newItem.nextNodes.minCost : 0)
				}

				newItem.nextNodesLen++
			}
		}

		// Terminal rule
		else {
			var prevSemantic = prevItem.semantics
			while (prevSemantic) {
				// RHS
				if (prevSemantic.isRHS) {
					if (newSemantic) {
						newSemantic = semantic.mergeRHS(prevSemantic.semantic, newSemantic)

						// RHS contains duplicates
						if (newSemantic === -1) return -1
					} else {
						newSemantic = prevSemantic.semantic
					}

					prevSemantic = prevSemantic.prev
				}

				// LHS after parsing the right-most branch that follows the semantic (completed the reduction)
				else if (prevItem.nextNodesLen <= prevSemantic.nextNodesLen) {
					// A function without an argument - currently can only be intersect()
					// This will need to be modified if we incorporate functions that don't require args
					if (!newSemantic) return -1

					newSemantic = semantic.reduce(prevSemantic.semantic, newSemantic)

					prevSemantic = prevSemantic.prev
				}

				// On left side of a reduction and cannot continue merging with LHS w/o completing its RHS (children)
				else break
			}

			if (newSemantic) {
				newItem.semantics = {
					isRHS: true,
					semantic: newSemantic,
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
			// Stop words - no text
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
function conjugateText(item, text) {
	var gramPropsList = item.gramProps

	while (gramPropsList) {
		var gramProps = gramPropsList.gramProps

		var verbForm = gramProps.verbForm
		if (verbForm && text[verbForm]) {
			// Remove gramProps from linked list and rebuild end of list up to it
			spliceGramPropsList(item, gramPropsList)
			return text[verbForm]
		}

		var personNumber = gramProps.personNumber
		if (personNumber && text[personNumber]) {
			// Remove gramProps from linked list and rebuild end of list up to it
			spliceGramPropsList(item, gramPropsList)
			return text[personNumber]
		}

		var gramCase = gramProps.gramCase
		if (gramCase && text[gramCase]) {
			// Rule with gramCase either has personNumber for nominative (so will be needed again), or doesn't have personNumer (for objective) and can be deleted
			if (!personNumber) {
				// Remove gramProps from linked list and rebuild end of list up to it
				spliceGramPropsList(item, gramPropsList)
			}

			return text[gramCase]
		}

		gramPropsList = gramPropsList.next
	}

	util.logTrace()
	util.printWarning('Failed to conjugate', text, gramPropsList)
}

// Remove the element `gramPropsToRemove` from the `gramProps` list `item.gramProps`
// The `gramProps` that will be used may not be the most recent, which requires the list to be rebuilt up to the `gramProps` used because the list elements are shared amongst paths.
// - Better to construct new portion of linked list after finding the gramProps, instead of while traversing, because list does not need splicing when it is `gramCase` match for a `gramProps` also with a `personNumber`
function spliceGramPropsList(item, gramPropsToRemove) {
	var thisGramProps = item.gramProps
	var prevGramProps

	// Find which element in `item.gramProps` is to be removed
	while (thisGramProps !== gramPropsToRemove) {
		if (prevGramProps) {
			prevGramProps = prevGramProps.next = {
				gramProps: thisGramProps.gramProps,
			}
		} else {
			prevGramProps = item.gramProps = {
				gramProps: thisGramProps.gramProps,
			}
		}

		thisGramProps = thisGramProps.next
	}

	// Point the predecessor 'next' to successor of the element to be removed
	if (prevGramProps) {
		prevGramProps.next = gramPropsToRemove.next
	} else {
		item.gramProps = gramPropsToRemove.next
	}
}

// Determine if newly parsed tree has a unique semantic and unique display text
// Returns `true` if tree is unique
function treeIsUnique(trees, item) {
	if (item.semantics.prev) throw new Error('semantics remain')

	// Check for duplicate semantics by comparing semantic string representation
	// Returns `false` if new semantic is identical to previously constructed (and cheaper) tree
	var semanticStr = semantic.toString(item.semantics.semantic)
	for (var t = trees.length; t-- > 0;) {
		var tree = trees[t]
		if (tree.semanticStr === semanticStr) return false
		if (tree.disambiguation && tree.disambiguation.indexOf(semanticStr) !== -1) return false
	}

	// Semantic is new
	// Check for duplicate display text
	// If so, save new semantic to previous tree's disambiguation and return false to reject tree
	var textStr = item.text.slice(1) // Remove leading space
	for (var t = trees.length; t-- > 0;) {
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

	// Tree is unique
	item.semanticStr = semanticStr
	item.text = textStr

	return true
}

// When `buildDebugTrees` is `true`, link each `item` to the previous `item` and its new `ruleProps`. After parse completion, construct tree representations from the linked lists of the `K` best paths.
// Path is a reverse linked list of the items used to construct this path, ending at the start node.
function pathToTree(item) {
	// Stack of previous nodes lower in the parse tree (which become child nodes)
	var prevNodes = []

	while (true) {
		var node = item.node
		var parNode

		// Terminal rule
		if (!node) {
			var node = item.prev.node

			if (!node) {
				// Find last node (`nextNodes` also holds insertion text)
				var prevNextNodes = item.prev.prev.nextNodes
				while (prevNextNodes.node.constructor !== Object) {
					prevNextNodes = prevNextNodes.next
				}

				node = prevNextNodes.node
			}

			parNode = {
				symbol: undefined,
				props: item.ruleProps,
				children: children = [ {
					symbol: node.subs[0].node.sym.name,
				} ],
			}
		}

		// Binary nonterminal rule
		else if (item.nextNodes && item.nextNodes !== item.prev.nextNodes && item.ruleProps.insertionIdx === undefined) {
			var newNodeA = prevNodes.pop()
			newNodeA.symbol = node.sym.name

			var newNodeB = prevNodes.pop()
			newNodeB.symbol = item.nextNodes.node.sym.name

			parNode = {
				symbol: undefined,
				props: item.ruleProps,
				children: [ newNodeA, newNodeB ],
			}
		}

		// Unary nonterminal rule
		else {
			var newNode = prevNodes.pop()
			newNode.symbol = node.sym.name

			// Start node
			if (!item.prev) return newNode

			// Order properties for insertions to be printed in order
			if (item.ruleProps.insertionIdx === 1) {
				parNode = {
					symbol: undefined,
					children: [ newNode ],
					props: item.ruleProps,
				}
			} else {
				parNode = {
					symbol: undefined,
					props: item.ruleProps,
					children: [ newNode ],
				}
			}
		}

		prevNodes.push(parNode)

		item = item.prev
	}
}


// Print trees (passed from previous parse)
exports.print = function (trees, printCost, printTrees) {
	trees.forEach(function (tree) {
		// Print display text (and cost)
		if (tree.cost !== tree.costSoFar) util.printErr('Costs incorrect')
		console.log(tree.text, printCost ? tree.cost : '')
		// Print semantic
		console.log(' ', tree.semanticStr)

		// Print additional semantics that produced identical display text
		if (tree.disambiguation) {
			tree.disambiguation.forEach(function (semanticStr) {
				console.log(' ', semanticStr)
			})
		}

		// Print trees (if constructed during parse forest search)
		if (printTrees) util.dir(pathToTree(tree))
	})
}