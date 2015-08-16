var util = require('../util')
var BinaryHeap = require('./BinaryHeap')
var semantic = require('../grammar/semantic')
var calcHeuristics = require('./calcHeuristics')


// Use A* path search to find trees in parse forest returned by parser, beginning at start node
exports.search = function (startNode, K, buildDebugTrees, printStats) {
	// Determine minimum possible cost of subtree that can be constructed from each node, which is the heuristic
	calcHeuristics(startNode)

	// Min-heap of all partially constructed trees
	var heap = new BinaryHeap
	// Array of all completed parse trees
	var trees = []

	var newItem = {
		// When item popped, will look at node's subs for next steps
		node: startNode,
		// If no 'node', because reached end of branch, go to next branch - either node or text array
		// Linked list
		nextNodes: undefined,
		// Number of elements in nextNodes, excluding text to append
		// Used as marker of when can merge with LHS semantic -> have completed full branch
		nextNodesLen: 0,
		// Linked list of semantics of parse tree, reduces to single semantic when parse complete
		// Reverse linked list, pointing to previously seen semantics
		semantics: undefined,
		// Display text of parse tree
		text: '',
		// Properties for conjugation of text
		gramProps: undefined,
		// Cost of path
		costSoFar: 0,
		// Cost of path + cost of cheapest possible path that can follow
		cost: 0
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

				// Stop when 'node' is a node
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
						newItem.prevItem = item
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
					newItem.prevItem = item
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
function createItem(sub, item, ruleProps) {
	var newCost = item.costSoFar + ruleProps.cost

	var newItem = {
		node: undefined,
		semantics: undefined,
		text: undefined,
		nextNodes: item.nextNodes,
		nextNodesLen: item.nextNodesLen,
		gramProps: item.gramProps,
		// Cost of path
		costSoFar: newCost,
		// Cost of path + cost of cheapest possible path that can follow
		cost: newCost + sub.minCost
	}

	var newSemantic = ruleProps.semantic

	// Insertion
	if (ruleProps.insertionIdx !== undefined) {
		// If 'insertedSemantic' exists, then newSemantic also exists
		if (ruleProps.insertedSemantic) {
			// Discard if prevSemantic is RHS, is identical to newSemantic, and dups of the semantic are prevented
			var prevSemantic = item.semantics
			if (prevSemantic && prevSemantic.isRHS && semantic.forbiddenDups(prevSemantic.semantic, newSemantic)) {
				return -1
			}

			newItem.semantics = {
				isRHS: true,
				semantic: ruleProps.insertedSemantic,
				prev: {
					semantic: newSemantic,
					nextNodesLen: item.nextNodesLen,
					prev: prevSemantic,
				}
			}
		} else if (newSemantic) {
			var prevSemantic = item.semantics

			if (ruleProps.semanticIsRHS) {
				if (prevSemantic.isRHS) {
					newSemantic = semantic.mergeRHS(prevSemantic.semantic, newSemantic)
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
						prev: prevSemantic
					}
				}
			} else {
				// Discard if prevSemantic is RHS, is identical to newSemantic, and dups of the semantic are prevented
				if (prevSemantic && prevSemantic.isRHS && semantic.forbiddenDups(prevSemantic.semantic, newSemantic)) {
					return -1
				}

				newItem.semantics = {
					semantic: newSemantic,
					nextNodesLen: item.nextNodesLen,
					prev: prevSemantic,
				}
			}
		} else {
			newItem.semantics = item.semantics
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
			newItem.text = item.text

			// Conjugate text after completing first branch in this binary reduction
			// Used in nominative case, which relies on person-number in 1st branch (verb precedes subject)
			newItem.nextNodes = {
				node: text,
				next: newItem.nextNodes,
			}
		} else {
			if (text.constructor === Array) {
				// Text requires conjugation
				newItem.text = item.text + conjugateTextArray(newItem, text)
			} else {
				// No conjugation
				newItem.text = item.text + ' ' + text
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
						prev: item.semantics
					}
				} else {
					// Discard if prevSemantic is RHS, is identical to newSemantic, and dups of the semantic are prevented
					var prevSemantic = item.semantics
					if (prevSemantic && prevSemantic.isRHS && semantic.forbiddenDups(prevSemantic.semantic, newSemantic)) {
						return -1
					}

					newItem.semantics = {
						semantic: newSemantic,
						nextNodesLen: item.nextNodesLen,
						prev: prevSemantic
					}
				}
			} else {
				newItem.semantics = item.semantics
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
			if (sub.next) {
				newItem.nextNodes = {
					node: sub.next.node,
					next: newItem.nextNodes,
				}

				newItem.nextNodesLen++
			}
		}

		// Terminal rule
		else {
			var prevSemantic = item.semantics
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
				else if (item.nextNodesLen <= prevSemantic.nextNodesLen) {
					// A function without an argument - currently can only be intersect()
					// This will need to be modified if we incorporate functions that don't require args
					if (!newSemantic) return -1

					newSemantic = semantic.insertSemantic(prevSemantic.semantic, newSemantic)

					prevSemantic = prevSemantic.prev
				}

				// On left side of a reduction and cannot continue merging with LHS w/o completing its RHS (children)
				else break
			}

			if (newSemantic) {
				newItem.semantics = {
					isRHS: true,
					semantic: newSemantic,
					prev: prevSemantic
				}
			} else {
				newItem.semantics = prevSemantic
			}
		}


		var text = ruleProps.text
		if (text) {
			if (text.constructor === Object) {
				newItem.text = item.text + ' ' + conjugateText(newItem, text)
			} else {
				newItem.text = item.text + ' ' + text
			}
		} else {
			// Stop words - no text
			newItem.text = item.text
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
	if (!gramPropsList) return
	var prevGramProps

	while (gramPropsList) {
		var gramProps = gramPropsList.gramProps

		var verbForm = gramProps.verbForm
		if (verbForm && text[verbForm]) {
			if (prevGramProps) {
				prevGramProps.next = gramPropsList.next
			} else {
				item.gramProps = gramPropsList.next
			}

			return text[verbForm]
		}

		var personNumber = gramProps.personNumber
		if (personNumber && text[personNumber]) {
			if (prevGramProps) {
				prevGramProps.next = gramPropsList.next
			} else {
				item.gramProps = gramPropsList.next
			}

			return text[personNumber]
		}

		var gramCase = gramProps.gramCase
		if (gramCase && text[gramCase]) {
			// Rule with gramCase either has personNumber for nominative (so will be needed again),
			// or doesn't have personNumer (for objective) and can be deleted
			if (!personNumber) {
				if (prevGramProps) {
					prevGramProps.next = gramPropsList.next
				} else {
					item.gramProps = gramPropsList.next
				}
			} else if (prevGramProps) {
				prevGramProps.next = gramPropsList
			}

			return text[gramCase]
		}

		// The `gramProps` that will be used is not the most recent. Will need to rebuild list up to the `gramProps` that will be used because the list elements are shared amongst paths.
		if (prevGramProps) {
			prevGramProps = prevGramProps.next = {
				gramProps: gramProps
			}
		} else {
			prevGramProps = item.gramProps = {
				gramProps: gramProps
			}
		}

		gramPropsList = gramPropsList.next
	}

	util.logTrace()
	util.printWarning('Failed to conjugate', text, gramPropsList)
}

// Determine if newly parsed tree has a unique semantic and unique display text
// Return true if tree is unique
function treeIsUnique(trees, item) {
	if (item.semantics.prev) throw 'semantics remain'

	// Check for duplicate semantics by comparing semantic string representation
	// Return false if new semantic is identical to previously constructed (and cheaper) tree
	var semanticStr = semantic.semanticToString(item.semantics.semantic)
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
			var node = item.prevItem.node

			if (!node) {
				// Find last node (`nextNodes` also holds insertion text)
				var prevNextNodes = item.prevItem.prevItem.nextNodes
				while (prevNextNodes.node.constructor !== Object) {
					prevNextNodes = prevNextNodes.next
				}

				node = prevNextNodes.node
			}

			parNode = {
				symbol: undefined,
				props: item.ruleProps,
				children: children = [ {
					symbol: node.subs[0].node.sym.name
				} ],
			}
		}

		// Binary nonterminal rule
		else if (item.nextNodes && item.nextNodes !== item.prevItem.nextNodes && item.ruleProps.insertionIdx === undefined) {
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
			if (!item.prevItem) return newNode

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

		item = item.prevItem
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
		if (printTrees) util.log(pathToTree(tree))
	})
}