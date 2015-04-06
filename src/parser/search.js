var util = require('../util')
var BinaryHeap = require('./BinaryHeap')

var semantic = require('../grammar/Semantic')
semantic.semantics = require('../semantics.json')
var insertSemantic = semantic.insertSemantic
var insertSemanticBinary = semantic.insertSemanticBinary

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
		semantic: undefined
	}

	if (buildTrees) {
		var tree = { symbol: startNode.sym.name, children: [] }
		newItem.tree = { startNode: tree, prevNodes: [ tree ] }
	}

	heap.push(newItem)

	// Might be able to save ruleProps as a single object - issue with ordering (array could be faster than creating new objects?)

	while (heap.size() > 0) {
		var item = heap.pop()

		var lastNode = item.lastNode || item.nextNodes.pop()

		while (lastNode && !lastNode.sym) {
			// might not need to call conjugateTextArray every time
			item.text = item.text.concat(conjugateTextArray(item, lastNode))
			lastNode = item.nextNodes.pop()
		}

		if (!lastNode) {
			item.semantic = item.prevSemantics.pop().semantic
			if (item.prevSemantics.length) throw 'prevSemantics remain'

			var semanticStr = JSON.stringify(item.semantic)
			for (var t = trees.length; t-- > 0;) {
				if (trees[t].semanticStr === semanticStr) break
			}
			item.semanticStr = semanticStr

			if (t < 0 && trees.push(item) === K) break
			continue
		}

		var subs = lastNode.subs
		for (var s = 0, subsLen = subs.length; s < subsLen; ++s) {
			var sub = subs[s]
			var ruleProps = sub.ruleProps

			if (ruleProps instanceof Array) {
				for (var p = 0, rulePropsLen = ruleProps.length; p < rulePropsLen; ++p) {
					var newItem = createItem(sub, item, ruleProps[p], buildTrees)
					if (newItem !== -1) {
						heap.push(newItem)
					}
				}
			} else if (ruleProps.transposition) {
				var newItem = {
					cost: item.cost + ruleProps.cost,
					lastNode: sub.next.node,
					nextNodes: item.nextNodes.concat(sub.node),
					text: item.text,
					ruleProps: item.ruleProps
				}

				var newSemantic = insertSemantic(item.semantic, ruleProps.semantic) // useless b/c no semantic on trans
				if (newSemantic === -1) continue
				newItem.prevSemantics = item.prevSemantics.concat({ LHS: true, semantic: newSemantic })

				if (buildTrees) {
					newItem.tree = spliceTree(item.tree, sub, ruleProps)
				}

				heap.push(newItem)
			} else {
				var newItem = createItem(sub, item, ruleProps, buildTrees)
				if (newItem !== -1) {
					heap.push(newItem)
				}
			}
		}
	}

	console.log('heap size:', heap.size())
	if (testCounter) console.log('testCounter:', testCounter)
	return trees
}

function createItem(sub, item, ruleProps, buildTrees) {
	var newSemantic = insertSemantic(item.semantic, ruleProps.semantic)
	if (newSemantic === -1) return -1

	var newItem = {
		cost: item.cost + ruleProps.cost,
		ruleProps: item.ruleProps,
		nextNodes: item.nextNodes
	}

	if (buildTrees) {
		newItem.tree = spliceTree(item.tree, sub, ruleProps)
	}

	// Insertion
	if (ruleProps.hasOwnProperty('insertionIdx')) {
		newItem.prevSemantics = item.prevSemantics.concat(
			{ LHS: true, semantic: newSemantic },
			{ LHS: false, semantic: ruleProps.insertedSemantic }
		)

		newItem.lastNode = sub.node

		if (ruleProps.text) {
			if (ruleProps.insertionIdx) {
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
		} else {
			newItem.text = item.text
		}
	}

	else {
		if (sub.next) {
			newItem.prevSemantics = item.prevSemantics.concat({ LHS: true, semantic: newSemantic })
		} else if (sub.node.subs) {
			newItem.prevSemantics = item.prevSemantics
			newItem.semantic = newSemantic
		} else {
			var prevSemanticsLen = item.prevSemantics.length

			// Left of RHS
			// prevSemanticsLen === 0 -> only one terminal symbol in tree (no branches)
			if (prevSemanticsLen === 0 || item.prevSemantics[prevSemanticsLen - 1].LHS) {
				newItem.prevSemantics = item.prevSemantics.concat({ LHS: false, semantic: newSemantic })
			}

			// Right of RHS
			else {
				var prevSemantics = newItem.prevSemantics = item.prevSemantics.slice()

				while (prevSemantics.length >= 2 && !prevSemantics[prevSemantics.length - 1].LHS) {
					var RHSA = prevSemantics.pop().semantic
					var LHS = prevSemantics.pop().semantic
					newSemantic = insertSemanticBinary(LHS, RHSA, newSemantic)
					if (newSemantic === -1) return -1
				}

				prevSemantics.push({ LHS: false, semantic: newSemantic }) // next RHSA
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
			// will pop on next shift, so copy
			newItem.nextNodes = newItem.nextNodes.slice()

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
			if (!personNumber) {
				rulePropsArray.splice(r, 1)
			}
			return text[gramCase]
		}

		// console.log('not last ruleProps')
	}

	console.log('Failed to conjugateText:', text)
	console.log(rulePropsArray)
	console.log()
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
	trees.forEach(function (tree){
		console.log(tree.text.join(' '), printCost ? tree.cost : '')
		console.log(' ', semantic.semanticToString(tree.semantic))
		if (printTrees) util.log(tree.tree)
	})
}