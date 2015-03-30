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

	while (heap.size()) {
		var item = heap.pop()

		var lastNode = item.lastNode || item.nextNodes.pop()

		while (lastNode && !lastNode.sym) {
			var textArray = lastNode

			for (var p = item.ruleProps.length; p-- > 0;) {
				var prevProps = item.ruleProps[p]

				for (var t = 0; t < textArray.length; ++t) {
					var text = textArray[t]

					if (text instanceof Object) {
						if (prevProps.verbForm && text[prevProps.verbForm]) {
							textArray[t] = text[prevProps.verbForm]
							item.ruleProps.splice(p, 1)
							break
						} else if (prevProps.personNumber && text[prevProps.personNumber]) {
							textArray[t] = text[prevProps.personNumber]
							item.ruleProps.splice(p, 1)
							break
						} else {
							console.log('not last ruleProps')
						}
					}
				}
			}

			item.text = item.text.concat(textArray)
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
					heap.push(editThings(sub, item, ruleProps[p]))
				}
			} else if (ruleProps.hasOwnProperty('textIdx')) {
				heap.push(editThings(sub, item, ruleProps))
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
				var newItem = {
					cost: item.cost + ruleProps.cost,
					tree: spliceTree(item.tree, sub, ruleProps),
				}

				if (ruleProps.personNumber || ruleProps.verbForm || ruleProps.gramCase) {
					newItem.ruleProps = item.ruleProps.concat(ruleProps)
				} else {
					newItem.ruleProps = item.ruleProps.slice()
				}

				if (sub.next) {
					newItem.nextNodes = item.nextNodes.concat(sub.next.node)
				} else {
					newItem.nextNodes = item.nextNodes.slice()
				}

				if (sub.node.subs) {
					newItem.lastNode = sub.node
					newItem.text = item.text
				} else {
					var text = ruleProps.text

					if (text instanceof Object) {
						for (var r = newItem.ruleProps.length; r-- > 0;) {
							var props = newItem.ruleProps[r]

							if (props.verbForm && text[props.verbForm]) {
								text = text[props.verbForm]
								newItem.ruleProps.splice(r, 1)
								break
							} else if (props.personNumber && text[props.personNumber]) {
								text = text[props.personNumber]
								newItem.ruleProps.splice(r, 1)
								break
							} else if (props.gramCase && text[props.gramCase]) {
								text = text[props.gramCase]
								// rule with gramCase either has personNumber for nomitive (so will be needed again), or doesn't have personNUmer (For obj) and can be deleted
								if (!props.personNumber) {
									newItem.ruleProps.splice(r, 1)
								}
								break
							} else {
								console.log('not last ruleProps')
							}
						}
					}

					if (text instanceof Object) {
						console.log('Failed to conjugate:', text)
						console.log(item.ruleProps)
						console.log()
					}

					newItem.text = item.text.concat(text)
				}

				heap.push(newItem)
			}
		}
	}

	return trees
}

function editThings(sub, item, ruleProps) {
	var newItem = {
		lastNode: sub.node,
		cost: item.cost + ruleProps.cost,
		ruleProps: item.ruleProps.slice(),
		nextNodes: item.nextNodes.slice(),
		tree: spliceTree(item.tree, sub, ruleProps),
	}

	if (ruleProps.text) {
		if (ruleProps.personNumber || ruleProps.verbForm) {
			newItem.ruleProps.push(ruleProps)
		}

		if (ruleProps.textIdx) {
			newItem.nextNodes.push(ruleProps.text)
			newItem.text = item.text
		} else {
			var textArray = ruleProps.text.slice()

			// else (without verbForm in conditional)
			for (var t = 0; t < textArray.length; ++t) {
				var text = textArray[t]

				if (text instanceof Object) {
					for (var r = newItem.ruleProps.length; r-- > 0;) {
						var textProps = newItem.ruleProps[r]

						if (textProps.verbForm && text[textProps.verbForm]) {
							textArray[t] = text[textProps.verbForm]
							newItem.ruleProps.splice(r, 1)
							break
						}

						if (textProps.personNumber && text[textProps.personNumber]) {
							textArray[t] = text[textProps.personNumber]
							newItem.ruleProps.splice(r, 1)
							break
						}

						console.log('not last ruleProps')
					}
				}
			}

			newItem.text = item.text.concat(textArray)
		}
	} else {
		newItem.text = item.text
	}

	return newItem
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
		console.log(tree.text.join(' '), tree.cost)
		if (printTrees) util.log(tree.tree)
	})
}