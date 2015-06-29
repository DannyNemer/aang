var util = require('../util')
var BinaryHeap = require('./BinaryHeap')
var semantic = require('../grammar/semantic')
var reduceForest = require('./reduceForest')


// Use A* path search to find trees in parse forest returned by parser, beginning at start node
exports.search = function (startNode, K, buildDebugTrees, printStats) {
	reduceForest(startNode) // currently slows because of work to condense

	var heap = new BinaryHeap // Min-heap of all partially constructed trees
	var trees = [] // Array of all completed

	var newItem = {
		// When item popped, will look at node's subs for next steps
		node: startNode,
		// If no 'node', because reached end of branch, go to next branch - either node or text array
		nextNodes: [],
		// Number of elements in nextNodes, excluding text to append
		// Used as marker of when can merge with LHS semantic -> have completed full branch
		nextNodesLen: 0,
		// Semantics
		prevSemantics: [],
		// Properties for conjugation
		gramProps: [],
		text: '',
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
			for (var n = item.nextNodes.length; n-- > 0;) {
				node = item.nextNodes[n]

				// Stop when 'node' is a node
				if (node.constructor === Object) break

				if (node.constructor === Array) {
					// Conjugate text of inserted branches which are the second of 2 RHS symbols
					// Used in nominative case, which relies on person-number in 1st branch (verb precedes subject)

					// Copy gramProps and text because will mutate when conjugating
					// Ignore possibility of gramProps being copied more than once
					// - Occurrence so rare that setting an extra variable to check if copied costs more time than saved
					item.gramProps = item.gramProps.slice()
					item.text += conjugateTextArray(item.gramProps, node)
				} else {
					item.text += ' ' + node
				}
			}

			// No nodes remain; tree construction complete
			if (n < 0) {
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
				item.nextNodes = item.nextNodes.slice(0, n)
				item.nextNodesLen--
			}
		}


		// Loop through all possible children of this node
		for (var s = 0, subs = node.subs, subsLen = subs.length; s < subsLen; ++s) {
			var sub = subs[s]
			var ruleProps = sub.ruleProps

			// Array of multiple insertions - first can be a 1-1 with an empty
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
			var prevSemantic = item.prevSemantics[item.prevSemantics.length-1]
			if (prevSemantic && prevSemantic.constructor === Array && semantic.forbiddenDups(prevSemantic, newSemantic)) {
				return -1
			}

			newItem.prevSemantics = item.prevSemantics.slice()
			newItem.prevSemantics.push({ semantic: newSemantic, nextNodesLen: item.nextNodesLen }, ruleProps.insertedSemantic)
		} else if (newSemantic) {
			var prevSemantic = item.prevSemantics[item.prevSemantics.length - 1]

			if (ruleProps.semanticIsRHS) {
				// prevSemantic is LHS
				if (prevSemantic.constructor === Object) {
					newItem.prevSemantics = item.prevSemantics.slice()
					newItem.prevSemantics.push(newSemantic)
				}

				// prevSemantic is RHS -> merge with new semantic
				else {
					newSemantic = semantic.mergeRHS(prevSemantic, newSemantic)
					if (newSemantic === -1) return -1
					newItem.prevSemantics = item.prevSemantics.slice(0, -1)
					newItem.prevSemantics.push(newSemantic)
				}
			} else {
				// Discard if prevSemantic is RHS, is identical to newSemantic, and dups of the semantic are prevented
				if (prevSemantic && prevSemantic.constructor === Array && semantic.forbiddenDups(prevSemantic, newSemantic)) {
					return -1
				}

				newItem.prevSemantics = item.prevSemantics.slice()
				newItem.prevSemantics.push({ semantic: newSemantic, nextNodesLen: item.nextNodesLen })
			}
		} else {
			newItem.prevSemantics = item.prevSemantics
		}


		newItem.node = sub.node

		if (ruleProps.gramProps) {
			// might copy array twice because copied in conjugation
			newItem.gramProps = newItem.gramProps.slice()
			newItem.gramProps.push(ruleProps.gramProps)
		}

		var text = ruleProps.text
		if (ruleProps.insertionIdx === 1) {
			// Conjugate text after completing first branch in this binary reduction
			// Used in nominative case, which relies on person-number in 1st branch (verb precedes subject)
			newItem.nextNodes = newItem.nextNodes.slice()
			newItem.nextNodes.push(text)
			newItem.text = item.text
		} else {
			// Text requires conjugation
			if (text.constructor === Array) {
				newItem.gramProps = newItem.gramProps.slice() // Possibly copied twice because above
				newItem.text = item.text + conjugateTextArray(newItem.gramProps, text)
			}

			// No conjugation
			else {
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
					// Last in prevSemantics is always LHS (so far we have seen)
					newItem.prevSemantics = item.prevSemantics.slice()
					newItem.prevSemantics.push(newSemantic)
				} else {
					// Discard if prevSemantic is RHS, is identical to newSemantic, and dups of the semantic are prevented
					var prevSemantic = item.prevSemantics[item.prevSemantics.length-1]
					if (prevSemantic && prevSemantic.constructor === Array && semantic.forbiddenDups(prevSemantic, newSemantic)) {
						return -1
					}

					newItem.prevSemantics = item.prevSemantics.slice()
					newItem.prevSemantics.push({ semantic: newSemantic, nextNodesLen: item.nextNodesLen })
				}
			} else {
				newItem.prevSemantics = item.prevSemantics
			}

			newItem.node = sub.node

			// Grammatical properties are only on nonterminal rules
			if (ruleProps.gramProps) {
				newItem.gramProps = newItem.gramProps.slice()
				newItem.gramProps.push(ruleProps.gramProps)
			}

			// All binary rules are nonterminal rules (hence, within sub.node.subs) - might change with reduceForest
			if (sub.next) {
				newItem.nextNodes = newItem.nextNodes.slice()
				newItem.nextNodes.push(sub.next.node)
				newItem.nextNodesLen++
			}
		}

		// Terminal rule
		else {
			for (var p = item.prevSemantics.length; p-- > 0;) {
				var prevSemantic = item.prevSemantics[p]

				// RHS
				if (prevSemantic.constructor === Array) {
					if (newSemantic) {
						newSemantic = semantic.mergeRHS(prevSemantic, newSemantic)
						// RHS contains duplicates
						if (newSemantic === -1) return -1
					} else {
						newSemantic = prevSemantic
					}
				}

				// LHS after parsing the right-most branch that follows the semantic (completed the reduction)
				else if (item.nextNodesLen <= prevSemantic.nextNodesLen) {
					// A function without an argument - currently can only be intersect()
					// This will need to be modified if we incorporate functions that don't require args
					if (!newSemantic) return -1

					newSemantic = semantic.insertSemantic(prevSemantic.semantic, newSemantic)
				}

				// On left side of a reduction and cannot continue merging with LHS w/o completing its RHS (children)
				else break
			}

			if (newSemantic) {
				newItem.prevSemantics = item.prevSemantics.slice(0, p + 1)
				newItem.prevSemantics.push(newSemantic)
			} else {
				newItem.prevSemantics = item.prevSemantics
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

// Must copy gramPropsArray and text before passing to prevent mutation from affecting other trees
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
	util.log('Failed to conjugate:', text, gramPropsArray)
}

// Determine if newly parsed tree has a unique semantic and unique display text
// Return true if tree is unique
function treeIsUnique(trees, item) {
	if (item.prevSemantics.length > 1) throw 'prevSemantics remain'

	// Check for duplicate semantics by comparing semantic string representation
	// Return false if new semantic is identical to previously constructed (and cheaper) tree
	var semanticStr = semantic.semanticToString(item.prevSemantics[0])
	for (var t = trees.length; t-- > 0;) {
		var tree = trees[t]
		if (tree.semanticStr === semanticStr) return false
		if (tree.disambiguation && tree.disambiguation.indexOf(semanticStr) !== -1) return false
	}

	// Semantic is new
	// Check for duplicate display text
	// If so, save new semantic to previous tree's disambiguation and return false to reject tree
	var textStr = item.text.slice(1)
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

function spliceTree(tree, sub, ruleProps) {
	var prevNodes = tree.prevNodes.slice()
	var newTree = cloneTree(tree.startNode, prevNodes)

	var prevNode = prevNodes.pop()

	var newNode = { symbol: sub.node.sym.name }
	prevNode.children.push(newNode)
	prevNode.props = ruleProps

	// Nonterminal symbol
	if (sub.node.subs) {
		prevNodes.push(newNode)
		newNode.children = []
	}

	// Binary reduction
	if (sub.next) {
		newNode = { symbol: sub.next.node.sym.name, children: [] }

		prevNode.children.push(newNode)
		prevNodes.splice(-1, 0, newNode)
	}

	// Insertion
	// Nodes for insertions are represented by their ruleProps
	if (ruleProps.insertionIdx !== undefined) {
		delete prevNode.props
		if (ruleProps.insertionIdx) {
			prevNode.children.push(ruleProps)
		} else {
			prevNode.children.splice(-1, 0, ruleProps)
		}
	}

	return {
		startNode: newTree,
		prevNodes: prevNodes
	}
}

function cloneTree(node, lastNodes) {
	// Node is an insertion, represented in tree by the original ruleProps
	if (node.cost !== undefined) {
		return node
	}

	var newNode = {
		symbol: node.symbol,
		props: node.props,
		children: node.children && node.children.map(function (childNode) {
			return cloneTree(childNode, lastNodes)
		})
	}

	// Map lastNodes to point to their new, cloned versions
	lastNodes.forEach(function (lastNode, i) {
		if (node === lastNode) lastNodes[i] = newNode
	})

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