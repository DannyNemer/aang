module.exports = Parser

function Parser(states) {
	this.states = states
	this.vertTab = [{ state: states[0], zNodes: [], cost: 0 }]
	this.nodeTab = []
	this.reds = []
	this.inputTermMatch = null
	this.cost = 0
	this.startNode = null
}

Parser.prototype.shift = function (shift, oldVertex, nextTerm, nextTermCost, inputTermMatch) {
	this.vertTab = []
	this.inputTermMatch = inputTermMatch || null

	var sub = {
		size: 1,
		cur: this.addSub(nextTerm)
	}

	var node = this.addSub(shift.sym, sub, nextTermCost),
			state = this.states[shift.stateIdx]

	this.addNode(node, state, oldVertex)
}

Parser.prototype.addSub = function (sym, sub, cost) {
	var size = sub ? sub.size : 1

	for (var nodeTab = this.nodeTab, n = nodeTab.length; n-- > 0;) {
		var node = nodeTab[n]
		if (node.sym === sym && node.size === size)
			if (node.cost === cost)
				break
	}

	if (n < 0) {
		var node = {
			sym: sym,
			size: size,
			cost: cost,
			subs: []
		}

		if (sub) {
			if (sub.cur.hasOwnProperty('start')) {
				node.start = sub.cur.start
				if (sub.next && sub.next.cur.hasOwnProperty('start')) {
					node.end = sub.next.cur.end
				} else {
					node.end = sub.cur.end
				}
			} else if (sub.next && sub.next.cur.hasOwnProperty('start')) {
				node.start = sub.next.cur.start
				node.end = sub.next.cur.end
			}
		} else if (this.inputTermMatch) {
			node.start = this.inputTermMatch.start
			node.end = this.inputTermMatch.end
		}

		nodeTab.push(node)
	}

	if (sub) {
		var match = node.subs.some(function (oldSub) {
			var newSub = sub

			if (newSub.size !== oldSub.size || newSub.cur !== oldSub.cur)
				return false // might need to compare costs of subs

			if ((newSub = newSub.next) && (oldSub = oldSub.next))
				if (newSub.size !== oldSub.size || newSub.cur !== oldSub.cur)
					return false

			return oldSub === newSub // might be able to just return false
		})

		if (!match) {
			// node.subs.push(sub)

			var newTotalCost = node.cost
			if (sub.cur.totalCost) newTotalCost += sub.cur.totalCost
			if (sub.next && sub.next.cur.totalCost) newTotalCost += sub.next.cur.totalCost

			if (!node.subs[0] || newTotalCost < node.totalCost) {
				node.subs[0] = sub
				node.totalCost = newTotalCost
			}
		}
	}

	return node
}

Parser.prototype.addVertex = function (state) {
	for (var vertTab = this.vertTab, v = vertTab.length; v-- > 0;) {
		var vertex = vertTab[v]
		if (vertex.state === state)
			return vertex
	}

	var vertex = {
		state: state,
		zNodes: []
	}

	vertTab.push(vertex)

	return vertex
}

Parser.prototype.addNode = function (node, state, oldVertex) {
	var vertex = this.addVertex(state)

	for (var zNodes = vertex.zNodes, z = zNodes.length; z-- > 0;) {
		var zNode = zNodes[z]
		if (zNode.node === node) break
	}

	if (z < 0) {
		var zNode = {
			node: node,
			vertex: oldVertex,
		}

		zNodes.push(zNode)

		if (vertex.cost === undefined) // need to deal with 2 zNodes
			vertex.cost = oldVertex.cost + node.totalCost

		for (var reds = state.reductions, r = reds.length; r-- > 0;) {
			var red = reds[r]
			this.reds.push({
				zNode: zNode,
				LHS: red.LHS,
				RHS: red.RHS
			})
		}
	}

	if (zNode.vertex !== oldVertex) console.log('problem') // stil undsure how this works
}

Parser.prototype.reduce = function () {
	var red = this.reds.shift(),
			zNode = red.zNode,
			pathTabIdx = 0

	var pathTab = [ {
		zNode: zNode,
		sub: {
			size: zNode.node.size,
			cur: zNode.node
		}
	} ]

	var nodeSym = red.LHS,
			redCost = red.RHS.cost

	if (red.RHS.oneToTwo) {
		var path = pathTab[pathTabIdx++],
				sub = path.sub

		for (var zNodes = path.zNode.vertex.zNodes, zNodesLen = zNodes.length, z = 0; z < zNodesLen; z++) {
			zNode = zNodes[z]

			pathTab.push({
				zNode: zNode,
				sub: {
					size: zNode.node.size + sub.size,
					cur: zNode.node,
					next: sub
				}
			})
		}
	}

	for (var pathTabLen = pathTab.length; pathTabIdx < pathTabLen; ++pathTabIdx) {
		var path = pathTab[pathTabIdx],
				node = this.addSub(nodeSym, path.sub, redCost),
				vertex = path.zNode.vertex

		// used to only be nonterm shifts
		for (var shifts = vertex.state.shifts, s = shifts.length; s-- > 0;) {
			var shift = shifts[s]

			if (shift.sym === nodeSym) {
				this.addNode(node, this.states[shift.stateIdx], vertex)

				if (nodeSym.isStart) {
					this.reds = []
					return node
				}

				break
			}
		}
	}
}

// convert back to recursive because speed will be identical - both ways build a stack
Parser.prototype.printString = function (node) {
	var literals = [ node.totalCost.toFixed(2) ],
			stack = []

	while (node) {
		var sub = node.subs[0]

		if (sub) {
			node = sub.cur

			if (sub.next) stack.push(sub.next.cur)
		} else {
			literals.push(node.sym.name)

			node = stack.pop()
		}
	}

	console.log(literals.join(' '))
}

Parser.prototype.printTree = function (startNode) {
	var graph = {
		cost: startNode.totalCost,
		tree: graphify(startNode)
	}

	console.log(JSON.stringify(graph, null, 1))
}

function graphify(node) {
	var newNode = {
		symbol: node.sym.name,
		cost: node.cost,
		start: node.start,
		end: node.end
	}

	if (node.subs.length) {
		if (node.subs.length > 1) { // not in use
			newNode.subs = []

			node.subs.forEach(function (sub) {
				var newSub = { children: [] }
				newNode.subs.push(newSub)

				newSub.children.push(graphify(sub.cur))

				if (sub.next) newSub.children.push(graphify(sub.next.cur))
			})
		} else {
			newNode.children = []

			node.subs.forEach(function (sub) {
				newNode.children.push(graphify(sub.cur))

				if (sub.next) newNode.children.push(graphify(sub.next.cur))
			})
		}
	}

	return newNode
}