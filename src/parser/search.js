var util = require('../util')
var BinaryHeap = require('./BinaryHeap')

var semantic = require('../grammar/semantic')

var testCounter = 0

exports.search = function (startNode, K, buildTrees) {
	var heap = new BinaryHeap
	var trees = []

	var newItem = {
		lastNode: startNode,
		ruleProps: [],
		nextNodes: [],
		text: [],
		cost: 0,
		prevSemantics: [],
	}

	if (buildTrees) {
		var tree = { symbol: startNode.sym.name, children: [] }
		newItem.tree = { startNode: tree, prevNodes: [ tree ] }
	}

	heap.push(newItem)

	// Might be able to save ruleProps as a single object - issue with ordering (array could be faster than creating new objects?)

	while (heap.size() > 0) {
		var item = heap.pop()

		var lastNode = item.lastNode

		if (!lastNode) {
			for (var i = item.nextNodes.length; i-- > 0;) {
				lastNode = item.nextNodes[i]

				if (lastNode.sym) break
					// we are copying item.ruleProps every time, should only be once
				item.text = item.text.concat(conjugateTextArray(item, lastNode))
			}

			if (i < 0) {
				if (treeIsUnique(item, trees)) {
					if (trees.push(item) === K) break
				}

				continue
			} else {
				// Copy nextNodes, excluding ones already used
				item.nextNodes = item.nextNodes.slice(0, i)
			}
		}

		var subs = lastNode.subs
		for (var s = 0, subsLen = subs.length; s < subsLen; ++s) {
			var sub = subs[s]
			var ruleProps = sub.ruleProps

			if (ruleProps instanceof Array) {
				for (var p = 0, rulePropsLen = ruleProps.length; p < rulePropsLen; ++p) {
					var newItem = createItem(sub, item, ruleProps[p], buildTrees)
					if (newItem === -1) continue
					heap.push(newItem)
				}
			} else if (ruleProps.transposition) {
				var newItem = {
					cost: item.cost + ruleProps.cost,
					lastNode: sub.next.node,
					nextNodes: item.nextNodes.concat(sub.node),
					text: item.text,
					ruleProps: item.ruleProps
				}

				var newSemantic = ruleProps.semantic

				if (newSemantic) {
					newItem.prevSemantics = item.prevSemantics.concat({ LHS: true, semantic: newSemantic, nextNodesLen: nextNodesLen(item) })
				} else {
					newItem.prevSemantics = item.prevSemantics
				}

				if (buildTrees) {
					newItem.tree = spliceTree(item.tree, sub, ruleProps)
				}

				heap.push(newItem)
			} else {
				var newItem = createItem(sub, item, ruleProps, buildTrees)
				if (newItem === -1) continue
				heap.push(newItem)
			}
		}
	}

	console.log('heap size:', heap.size())
	console.log('push:', heap.pushCount)
	console.log('pop:', heap.popCount)
	if (testCounter) console.log('testCounter:', testCounter)
	return trees
}

// don't count text
// perhaps do similar thing as with semantics - mark next nodes count
function nextNodesLen(item) {
	return item.nextNodes.reduce(function (prev, cur) {
		return prev + (cur.sym ? 1 : 0)
	}, 0)
}

function createItem(sub, item, ruleProps, buildTrees) {
	var newItem = {
		cost: item.cost + ruleProps.cost,
		ruleProps: item.ruleProps,
		nextNodes: item.nextNodes
	}

	if (buildTrees) {
		newItem.tree = spliceTree(item.tree, sub, ruleProps)
	}

	var newSemantic = ruleProps.semantic

	// Insertion
	if (ruleProps.hasOwnProperty('insertionIdx')) {
		if (newSemantic) {
			newItem.prevSemantics = item.prevSemantics.concat({ LHS: true, semantic: newSemantic, nextNodesLen: nextNodesLen(item) })
			if (ruleProps.insertedSemantic) {
				newItem.prevSemantics.push({ semantic: ruleProps.insertedSemantic })
			}
		} else if (ruleProps.insertedSemantic) {
			var prevSemantic = item.prevSemantics[item.prevSemantics.length - 1]

			if (prevSemantic.LHS) {
				newItem.prevSemantics = item.prevSemantics.concat({ semantic: ruleProps.insertedSemantic })
			} else {
				newSemantic = semantic.mergeRHS(prevSemantic.semantic, ruleProps.insertedSemantic)
				if (newSemantic === -1) return -1
				newItem.prevSemantics = item.prevSemantics.slice(0, -1)
				newItem.prevSemantics.push({ semantic: newSemantic })
			}
		} else {
			newItem.prevSemantics = item.prevSemantics
		}


		newItem.lastNode = sub.node

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
			// semantic args are getting here, but being marked as LHS
			if (newSemantic) {
				// Do not merge LHS early - cannot fail, but their RHS children can fail, then parse LHS after
				// Semantic function (LHS)
				// This is always true if sub.next (because unlikely to put a semantic argument on a fork)
				if (newSemantic[0].constructor === Object) {
					newItem.prevSemantics = item.prevSemantics.concat({ LHS: true, semantic: newSemantic, nextNodesLen: nextNodesLen(item) })
				} else {
					// should always be a LHS before
					// semantic arg
					// Will be a 1 -> 1
					// We are counting on there not being any semantics that come after this down the branch
					newItem.prevSemantics = item.prevSemantics.concat({ semantic: newSemantic })
				}
			} else {
				newItem.prevSemantics = item.prevSemantics
			}
		} else {
			for (var p = item.prevSemantics.length; p-- > 0;) {
				var prevSemantic = item.prevSemantics[p]

				// RHS
				if (!prevSemantic.LHS) {
					if (newSemantic) {
						newSemantic = semantic.mergeRHS(prevSemantic.semantic, newSemantic)
						// Duplicates
						if (newSemantic === -1) return -1
					} else {
						newSemantic = prevSemantic.semantic
					}
				}

				// LHS after parsing the right-most branch that follows the semantic (completed the reduction)
				else if (prevSemantic.nextNodesLen >= nextNodesLen(item)) {
					if (newSemantic) {
						newSemantic = semantic.insertSemantic(prevSemantic.semantic, newSemantic)
					} else {
						newSemantic = prevSemantic.semantic
						// A function without an arugment - currently can only be intersect()
						// This will need to be extended if we incorporate functions that don't require args
						if (newSemantic[0].children) return -1
					}
				}

				// On left side of a reduction and cannot continue merging with LHS w/o completing its RHS (children)
				else break
			}

			if (newSemantic) {
				newItem.prevSemantics = item.prevSemantics.slice(0, p + 1)
				newItem.prevSemantics.push({ semantic: newSemantic })
			} else {
				newItem.prevSemantics = item.prevSemantics
			}
		}

		if (sub.next) {
			newItem.nextNodes = newItem.nextNodes.concat(sub.next.node)
		}

		if (sub.node.subs) {
			newItem.lastNode = sub.node
			newItem.text = item.text

			// Can go before text conjugation because there won't be inflection properties on a terminal rule
			if (ruleProps.personNumber || ruleProps.verbForm || ruleProps.gramCase) {
				newItem.ruleProps = newItem.ruleProps.concat(ruleProps)
			}
		} else {
			// end of branch
			var text = ruleProps.text
			if (text) {
				if (text instanceof Object) {
					newItem.ruleProps = newItem.ruleProps.slice()
					text = conjugateText(newItem.ruleProps, text)
				}

				newItem.text = item.text.concat(text)
			} else {
				newItem.text = item.text // stop words
			}
		}
	}

	return newItem
}

function treeIsUnique(item, trees) {
	item.semantic = item.prevSemantics[0].semantic
	if (item.prevSemantics.length > 1) throw 'prevSemantics remain'

	// Check for duplicate semantics
	var semanticStr = semantic.semanticToString(item.semantic)
	for (var t = trees.length; t-- > 0;) {
		var tree = trees[t]
		if (tree.semanticStr === semanticStr) return false
		if (tree.disambiguation && tree.disambiguation.indexOf(semanticStr) !== -1) return false
	}

	// Semantic is new
	// Check is text string is new, if save to disambiguation of existing tree
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

	// Tree is new
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
			// If so, would need to iterate through textArray WITHIN ruleprops,
			// maybe not, could lead to wrong ruleprops being applied
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
			// rule with gramCase either has personNumber for nomitive (so will be needed again), or doesn't have personNUmer (For obj) and can be deleted
			if (!personNumber) rulePropsArray.splice(r, 1)

			return text[gramCase]
		}
	}

	util.log('Failed to conjugate:', text, rulePropsArray)
}

function spliceTree(tree, sub, ruleProps) {
	var prevNodes = tree.prevNodes.slice()
	var newTree = cloneTree(tree.startNode, prevNodes)

	var prevNode = prevNodes.pop()

	var newNode = { symbol: sub.node.sym.name }
	prevNode.children.push(newNode)
	prevNode.props = ruleProps

	// Nonterm sym
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

exports.print = function (trees, printTrees, printCost) {
	trees.forEach(function (tree) {
		console.log(tree.text, printCost ? tree.cost : '')
		// util.log(tree.semantic)
		console.log(' ', semantic.semanticToString(tree.semantic))

		if (tree.disambiguation) {
			tree.disambiguation.forEach(function (semanticStr) {
				console.log(' ', semanticStr)
			})
		}

		if (printTrees) util.log(tree.tree)
	})
}