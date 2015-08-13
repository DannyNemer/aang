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
		gramProps: [],
		// Cost of path
		costSoFar: 0,
		// Cost of path + cost of cheapest possible path that can follow
		cost: 0
	}

	// If buildDebugTrees option is true, construct and print the parse trees for debugging
	if (buildDebugTrees) {
		var tree = { symbol: startNode.sym.name, children: [] }
		newItem.tree = { startNode: tree, prevNodes: [ tree ] }
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

					// Copy gramProps and text because will change when conjugating
					// Ignore possibility of gramProps being copied more than once
					// - Occurrence so rare that setting an extra variable to check if copied costs more time than saved
					item.gramProps = item.gramProps.slice()
					item.text += conjugateTextArray(item.gramProps, node)
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
				// Copy nextNodes (because array shared by multiple items)
				// Exclude copying items examined in above loop
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
					var newItem = createItem(sub, item, ruleProps[r], buildDebugTrees)
					if (newItem === -1) continue // semantically illegal parse -> reject
					heap.push(newItem)
				}
			}

			else {
				var newItem = createItem(sub, item, ruleProps, buildDebugTrees)
				if (newItem === -1) continue // semantically illegal parse -> reject
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
function createItem(sub, item, ruleProps, buildDebugTrees) {
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

	if (buildDebugTrees) {
		newItem.tree = spliceTree(item.tree, sub, ruleProps)
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

		var text = ruleProps.text
		if (ruleProps.insertionIdx === 1) {
			if (ruleProps.gramProps) {
				newItem.gramProps = newItem.gramProps.slice()
				newItem.gramProps.push(ruleProps.gramProps)
			}

			newItem.text = item.text

			// Conjugate text after completing first branch in this binary reduction
			// Used in nominative case, which relies on person-number in 1st branch (verb precedes subject)
			newItem.nextNodes = {
				node: text,
				next: newItem.nextNodes,
			}
		} else {
			// Text requires conjugation
			if (text.constructor === Array) {
				newItem.gramProps = newItem.gramProps.slice()
				if (ruleProps.gramProps) {
					newItem.gramProps.push(ruleProps.gramProps)
				}

				newItem.text = item.text + conjugateTextArray(newItem.gramProps, text)
			}

			// No conjugation
			else {
				if (ruleProps.gramProps) {
					newItem.gramProps = newItem.gramProps.slice()
					newItem.gramProps.push(ruleProps.gramProps)
				}

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
				newItem.gramProps = newItem.gramProps.slice()
				newItem.gramProps.push(ruleProps.gramProps)
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
				newItem.gramProps = newItem.gramProps.slice()
				newItem.text = item.text + ' ' + conjugateText(newItem.gramProps, text)
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
function conjugateTextArray(gramPropsArray, textArray) {
	var concatStr = ''

	for (var t = 0, textArrayLen = textArray.length; t < textArrayLen; ++t) {
		var text = textArray[t]
		if (text.constructor === Object) {
			concatStr += ' ' + conjugateText(gramPropsArray, text)
		} else {
			concatStr += ' ' + text
		}
	}

	return concatStr
}

// Must copy gramPropsArray before passing to avoid mutation affecting other trees
// Loop through from end of array, find rule most recently added
// NOTE: Does not allow for same prop to be used in multiple places. Deletion of props occurs after single use.
function conjugateText(gramPropsArray, text) {
	for (var r = gramPropsArray.length; r-- > 0;) {
		var gramProps = gramPropsArray[r]

		var verbForm = gramProps.verbForm
		if (verbForm && text[verbForm]) {
			gramPropsArray.splice(r, 1)
			return text[verbForm]
		}

		var personNumber = gramProps.personNumber
		if (personNumber && text[personNumber]) {
			gramPropsArray.splice(r, 1)
			return text[personNumber]
		}

		var gramCase = gramProps.gramCase
		if (gramCase && text[gramCase]) {
			// Rule with gramCase either has personNumber for nominative (so will be needed again),
			// or doesn't have personNumer (for objective) and can be deleted
			if (!personNumber) gramPropsArray.splice(r, 1)

			return text[gramCase]
		}
	}

	util.logTrace()
	util.printWarning('Failed to conjugate', text, gramPropsArray)
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

// Built a tree representation of the productions in this parse tree
// Copy tree each time before modifying and return new tree
function spliceTree(tree, sub, ruleProps) {
	// Duplicate tree so new instance can be modified
	var prevNodes = tree.prevNodes.slice()
	var newTree = cloneTree(tree.startNode, prevNodes)

	var prevNode = prevNodes.pop()

	var newNode = { symbol: sub.node.sym.name, children: undefined, props: undefined }
	prevNode.children.push(newNode)
	prevNode.props = ruleProps

	// Nonterminal symbol
	if (sub.node.subs) {
		prevNodes.push(newNode)
		newNode.children = []

		// Binary reduction
		if (sub.next) {
			newNode = { symbol: sub.next.node.sym.name, children: [], props: undefined }

			prevNode.children.push(newNode)
			prevNodes.splice(-1, 0, newNode)
		}

		// Insertion
		// Nodes for insertions are represented by their ruleProps
		else if (ruleProps.insertionIdx !== undefined) {
			prevNode.props = undefined // Faster than 'delete'
			if (ruleProps.insertionIdx) {
				prevNode.children.push(ruleProps)
			} else {
				prevNode.children.splice(-1, 0, ruleProps)
			}
		}
	}

	return {
		startNode: newTree,
		prevNodes: prevNodes
	}
}

// Duplicate tree so new instance can be modified
function cloneTree(node, prevNodes) {
	// Node is an insertion, represented in tree by the original ruleProps
	if (node.cost !== undefined) {
		return node
	}

	// Recreate each node and its children
	var newNode = {
		symbol: node.symbol,
		props: node.props,
		// Performance is hurt when not defining properties at object instantiation
		children: undefined
	}

	var nodeChildren = node.children
	if (nodeChildren) {
		var newNodeChildren = newNode.children = []
		for (var n = 0, nodeChildrenLen = nodeChildren.length; n < nodeChildrenLen; ++n) {
			newNodeChildren.push(cloneTree(nodeChildren[n], prevNodes))
		}
	}

	// Map prevNode to point to new, cloned version
	var prevNodesIdx = prevNodes.indexOf(node)
	if (prevNodesIdx !== -1) {
		prevNodes[prevNodesIdx] = newNode
	}

	return newNode
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
		if (printTrees) util.log(tree.tree.startNode)
	})
}