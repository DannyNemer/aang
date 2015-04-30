var util = require('../util')
var BinaryHeap = require('./BinaryHeap')
var semantic = require('../grammar/semantic')
var reduceForest = require('./reduceForest')


// Use A* path search to find trees in parse forest returned by parser, beginning at start node
exports.search = function (startNode, K, buildDebugTrees) {
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
		prevSemantics: [], // Semantics
		ruleProps: [], // Properties for conjugation
		text: [],
		costSoFar: 0,
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

				// 'node' is a node
				if (node.sym) break

				// we are copying item.ruleProps every time, should only be once
				item.text = item.text.concat(conjugateTextArray(item, node))
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

			// Array of multiple insertions
			if (ruleProps.constructor === Array) {
				for (var p = 0, rulePropsLen = ruleProps.length; p < rulePropsLen; ++p) {
					var newItem = createItem(sub, item, ruleProps[p], buildDebugTrees)
					if (newItem === -1) continue // semantically illegal parse -> throw out
					heap.push(newItem)
				}
			}

			else {
				var newItem = createItem(sub, item, ruleProps, buildDebugTrees)
				if (newItem === -1) continue // semantically illegal parse -> throw out
				heap.push(newItem)
			}
		}
	}

	console.log('heap size:', heap.content.length)
	console.log('push:', heap.pushCount)
	console.log('pop:', heap.popCount)

	return trees
}

// Create new item as an extension of current tree down this sub
function createItem(sub, item, ruleProps, buildDebugTrees) {
	var newCost = item.costSoFar + ruleProps.cost

	var newItem = {
		nextNodes: item.nextNodes,
		nextNodesLen: item.nextNodesLen,
		ruleProps: item.ruleProps,
		costSoFar: newCost,
		cost: newCost + sub.minCost
	}

	if (buildDebugTrees) {
		newItem.tree = spliceTree(item.tree, sub, ruleProps)
	}

	var newSemantic = ruleProps.semantic

	// Insertion
	if (ruleProps.insertionIdx !== undefined) {
		if (newSemantic) {
			newItem.prevSemantics = item.prevSemantics.concat({
				semantic: newSemantic,
				nextNodesLen: item.nextNodesLen
			})

			if (ruleProps.insertedSemantic) {
				newItem.prevSemantics.push(ruleProps.insertedSemantic)
			}
		} else if (ruleProps.insertedSemantic) {
			var prevSemantic = item.prevSemantics[item.prevSemantics.length - 1]

			if (prevSemantic.constructor === Object) { // LHS
				newItem.prevSemantics = item.prevSemantics.slice()
				newItem.prevSemantics.push(ruleProps.insertedSemantic) // cannot concat because semantic is array
			} else {
				newSemantic = semantic.mergeRHS(prevSemantic, ruleProps.insertedSemantic)
				if (newSemantic === -1) return -1
				newItem.prevSemantics = item.prevSemantics.slice(0, -1)
				newItem.prevSemantics.push(newSemantic)
			}
		} else {
			newItem.prevSemantics = item.prevSemantics
		}


		newItem.node = sub.node

		if (ruleProps.insertionIdx === 1) {
			// cannot concat because will alter text array
			newItem.nextNodes = newItem.nextNodes.slice()
			newItem.nextNodes.push(ruleProps.text)
			newItem.text = item.text
		} else {
			// conjugates "have" - never person number, because only person number only nominative -> idx = 1
			newItem.text = item.text.concat(conjugateTextArray(newItem, ruleProps.text))
		}

		// both can occur for both insertionIdx
		if (ruleProps.personNumber || ruleProps.verbForm) {
			// might copy array twice because copied in conjugation
			newItem.ruleProps = newItem.ruleProps.concat(ruleProps)
		}
	}

	else {
		if (sub.node.subs) {
			if (newSemantic) {
				// A RHS semantic not at the base of the branch because of forestReduction
				if (ruleProps.semanticIsRHS) {
					newItem.prevSemantics = item.prevSemantics.slice()
					newItem.prevSemantics.push(newSemantic) // cannot concat because semantic is array
				} else {
					newItem.prevSemantics = item.prevSemantics.concat({
						semantic: newSemantic,
						nextNodesLen: item.nextNodesLen
					})
				}
			} else {
				newItem.prevSemantics = item.prevSemantics
			}


			newItem.node = sub.node

			// Can go before text conjugation because there won't be inflection properties on a terminal rule
			if (ruleProps.personNumber || ruleProps.verbForm || ruleProps.gramCase) {
				newItem.ruleProps = newItem.ruleProps.concat(ruleProps)
			}

			// All binary rules are nonterminal rules (hence, within sub.node.subs) - might change with reduceForest
			if (sub.next) {
				newItem.nextNodes = newItem.nextNodes.concat(sub.next.node)
				newItem.nextNodesLen++
			}
		} else {
			for (var p = item.prevSemantics.length; p-- > 0;) {
				var prevSemantic = item.prevSemantics[p]

				// RHS
				if (prevSemantic.constructor === Array) {
					if (newSemantic) {
						newSemantic = semantic.mergeRHS(prevSemantic, newSemantic)
						// Duplicates
						if (newSemantic === -1) return -1
					} else {
						newSemantic = prevSemantic
					}
				}

				// LHS after parsing the right-most branch that follows the semantic (completed the reduction)
				else if (item.nextNodesLen <= prevSemantic.nextNodesLen) {
					if (newSemantic) {
						newSemantic = semantic.insertSemantic(prevSemantic.semantic, newSemantic)
					} else {
						newSemantic = prevSemantic.semantic
						// A function without an argument - currently can only be intersect()
						// This will need to be extended if we incorporate functions that don't require args
						if (newSemantic[0].children) return -1
					}
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
				newItem.ruleProps = newItem.ruleProps.slice()
				text = conjugateText(newItem.ruleProps, text)
			}

			// Originally insertion text move in forest reduction
			else if (text.constructor === Array && newItem.ruleProps.length) {
				text = conjugateTextArray(newItem, text)
			}

			newItem.text = item.text.concat(text)
		} else {
			newItem.text = item.text // stop words
		}
	}

	return newItem
}

// Determine if newly parsed tree has a unique semantic and unique display text
// Return true if tree is unique
function treeIsUnique(trees, item) {
	item.semantic = item.prevSemantics[0]
	if (item.prevSemantics.length > 1) throw 'prevSemantics remain'

	// Check for duplicate semantics by comparing semantic string representation
	// Return false if new semantic is identical to previously constructed (and cheaper) tree
	var semanticStr = semantic.semanticToString(item.semantic)
	for (var t = trees.length; t-- > 0;) {
		var tree = trees[t]
		if (tree.semanticStr === semanticStr) return false
		if (tree.disambiguation && tree.disambiguation.indexOf(semanticStr) !== -1) return false
	}

	// Semantic is new
	// Check for duplicate display text
	// If so, save new semantic to previous tree's disambiguation and return false to reject tree
	var textStr = item.text.join(' ')
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

// textArray is a ruleProps.text
function conjugateTextArray(item, textArray) {
	var arraysCopied = false

	for (var t = 0, textArrayLen = textArray.length; t < textArrayLen; ++t) {
		var text = textArray[t]
		if (text instanceof Object) {
			if (!arraysCopied) {
				textArray = textArray.slice()
				item.ruleProps = item.ruleProps.slice()
				arraysCopied = true
			}

			// FIX: if we are conjugating multiple things in the array, then we should not edit it after each
			// should apply same rule to multiple objs
			// If so, would need to iterate through textArray WITHIN ruleProps,
			// maybe not, could lead to wrong ruleProps being applied
			textArray[t] = conjugateText(item.ruleProps, text)
		}
	}

	return textArray
}

function conjugateText(rulePropsArray, text) {
	for (var r = rulePropsArray.length; r-- > 0;) {
		var ruleProps = rulePropsArray[r]

		var verbForm = ruleProps.verbForm
		if (verbForm && text[verbForm]) {
			rulePropsArray.splice(r, 1)
			return text[verbForm]
		}

		var personNumber = ruleProps.personNumber
		if (personNumber && text[personNumber]) {
			rulePropsArray.splice(r, 1)
			return text[personNumber]
		}

		var gramCase = ruleProps.gramCase
		if (gramCase && text[gramCase]) {
			// rule with gramCase either has personNumber for nominative (so will be needed again), or doesn't have personNUmer (For obj) and can be deleted
			if (!personNumber) rulePropsArray.splice(r, 1)

			return text[gramCase]
		}
	}

	util.logTrace()
	util.log('Failed to conjugate:', text, rulePropsArray)
}

function spliceTree(tree, sub, ruleProps) {
	var prevNodes = tree.prevNodes.slice()
	var newTree = cloneTree(tree.startNode, prevNodes)

	var prevNode = prevNodes.pop()

	var newNode = { symbol: sub.node.sym.name }
	prevNode.children.push(newNode)
	prevNode.props = ruleProps

	// Nonterminal sym
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
	if (ruleProps.hasOwnProperty('insertionIdx')) {
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
	// Return original ruleProps (stored for insertions)
	if (node.hasOwnProperty('cost')) {
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
		if (tree.cost !== tree.costSoFar) util.printErr('costs incorrect')
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
		if (printTrees) util.log(tree.tree)
	})
}