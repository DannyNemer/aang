// Test queries:
// people who like my repos liked by people who follow people I follow
// repos I have liked
// my repos me people who follow my followers have been and

var util = require('../util')
var BinaryHeap = require('./BinaryHeap')

exports.search = function (startNode, K) {
	var heap = new BinaryHeap
	var trees = []

	var tree = { symbol: startNode.sym.name, children: [] }

	heap.push({
		lastNode: startNode,
		ruleProps: [],
		nextNodes: [],
		text: [],
		cost: 0,
		tree: { startNode: tree, prevNodes: [ tree ] },
	})

	// Might be able to save ruleProps as a single object - issue with ordering (array could be faster than creating new objects?)

	while (heap.size()) {
		var item = heap.pop()

		var lastNode = item.lastNode || item.nextNodes.pop()

		while (lastNode && !lastNode.sym) {
			// might not need to call conjugateTextArray every time
			item.text = item.text.concat(conjugateTextArray(item.ruleProps, lastNode))
			lastNode = item.nextNodes.pop()
		}

		if (!lastNode) {
			if (trees.push(item) === K) break
			continue
		}

		var subs = lastNode.subs
		for (var s = 0, subsLen = subs.length; s < subsLen; ++s) {
			var sub = subs[s]
			var ruleProps = sub.ruleProps

			if (ruleProps instanceof Array) {
				for (var p = 0, rulePropsLen = ruleProps.length; p < rulePropsLen; ++p) {
					heap.push(createItem(sub, item, ruleProps[p]))
				}
			} else if (ruleProps.transposition) {
				heap.push({
					cost: item.cost + ruleProps.cost,
					lastNode: sub.next.node,
					nextNodes: item.nextNodes.concat(sub.node),
					text: item.text,
					ruleProps: item.ruleProps.slice(),
					tree: spliceTree(item.tree, sub, ruleProps),
				})
			} else {
				heap.push(createItem(sub, item, ruleProps))
			}
		}
	}

	return trees
}

function createItem(sub, item, ruleProps) {
	var newItem = {
		cost: item.cost + ruleProps.cost,
		tree: spliceTree(item.tree, sub, ruleProps),
		ruleProps: item.ruleProps.slice()
	}

	// Insertion
	if (ruleProps.hasOwnProperty('textIdx')) {
		newItem.nextNodes = item.nextNodes.slice()
		newItem.lastNode = sub.node

		if (ruleProps.text) {
			var textArray = ruleProps.text.slice()

			if (ruleProps.textIdx) {
				newItem.nextNodes.push(textArray)
				newItem.text = item.text
			} else {
				// might not always need to run, based on if 'personNumber'
				newItem.text = item.text.concat(conjugateTextArray(newItem.ruleProps, textArray))
			}

			if (ruleProps.personNumber || ruleProps.verbForm) {
				newItem.ruleProps.push(ruleProps)
			}
		} else {
			newItem.text = item.text
		}
	}

	else {
		if (sub.next) {
			newItem.nextNodes = item.nextNodes.concat(sub.next.node)
		} else {
			newItem.nextNodes = item.nextNodes.slice()
			// it does not make sense that you do not need to copy it
			// every time you you edit it, you edit it in multiple trees
			// we could use an idx var instead of editing a tree multiple times

			// make something that will run through multiple queries on a K
		}

		if (sub.node.subs) {
			newItem.lastNode = sub.node
			newItem.text = item.text
		} else {
			var text = ruleProps.text
			if (text instanceof Object) {
				text = conjugateText(newItem.ruleProps, text)
			}

			newItem.text = item.text.concat(text)
		}

		// Can go before text conjugation because there won't be inflection properties on a terminal rule
		if (ruleProps.personNumber || ruleProps.verbForm || ruleProps.gramCase) {
			newItem.ruleProps.push(ruleProps)
		}
	}

	return newItem
}

function conjugateTextArray(rulePropsArray, textArray) {
	for (var t = 0, textArrayLen = textArray.length; t < textArrayLen; ++t) {
		var text = textArray[t]
		if (text instanceof Object) {
			textArray[t] = conjugateText(rulePropsArray, text)
		}
	}

	return textArray
}

function conjugateText(rulePropsArray, text) {
	for (var r = rulePropsArray.length; r-- > 0;) {
		var ruleProps = rulePropsArray[r]

		if (ruleProps.verbForm && text[ruleProps.verbForm]) {
			rulePropsArray.splice(r, 1)
			return text[ruleProps.verbForm]
		} else if (ruleProps.personNumber && text[ruleProps.personNumber]) {
			rulePropsArray.splice(r, 1)
			return text[ruleProps.personNumber]
		} else if (ruleProps.gramCase && text[ruleProps.gramCase]) {
			// rule with gramCase either has personNumber for nomitive (so will be needed again), or doesn't have personNUmer (For obj) and can be deleted
			if (!ruleProps.personNumber) {
				rulePropsArray.splice(r, 1)
			}
			return text[ruleProps.gramCase]
		} else {
			console.log('not last ruleProps')
		}
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
	if (ruleProps.hasOwnProperty('textIdx')) {
		delete prevNode.props
		if (ruleProps.textIdx) {
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

exports.print = function (trees, printTrees) {
	trees.forEach(function (tree){
		console.log(tree.text.join(' '))
		if (printTrees) util.log(tree.tree)
	})
}