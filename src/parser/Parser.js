module.exports = Parser

function Parser(stateTable) {
	this.stateTable = stateTable
}

Parser.prototype.parse = function (query) {
	var tokens = query.split(' ')

	this.position = 0
	this.vertTab = []
	this.vertTabIdx = 0
	this.nodeTab = []
	this.nodeTabIdx = 0
	this.reds = []
	this.redsIdx = 0

	this.addVertex(this.stateTable.shifts[0])

	while (true) {
		/* REDUCE */
		while (this.redsIdx < this.reds.length)
			this.reduce(this.reds[this.redsIdx++])

		/* SHIFT */
		this.position++
		var token = tokens.shift()
		if (!token) break
		var word = this.stateTable.lookUp(token, true)

		if (word.rules.length === 0) {
			console.log('UNRECOGNIZED WORD!!', token)
			return
		}

		var sub = {
			size: 1,
			parNode: this.addSub(word)
		}

		var oldVertTabIdx = this.vertTabIdx
		this.vertTabIdx = this.vertTab.length
		this.nodeTabIdx = this.nodeTab.length

		for (var r = 0, rules = word.rules, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]
			var node = this.addSub(rule.RHS[0], sub, rule.ruleProps)

			for (var vertIdx = oldVertTabIdx; vertIdx < this.vertTabIdx; vertIdx++) {
				this.addNode(node, this.vertTab[vertIdx])
			}
		}
	}

	/* ACCEPT */
	for (var vertIdx = this.vertTabIdx; vertIdx < this.vertTab.length; vertIdx++) {
		var vertex = this.vertTab[vertIdx]

		if (vertex.state.isFinal) {
			this.startNode = vertex.list[0].node
			break
		}
	}
}

Parser.prototype.addSub = function (sym, sub, ruleProps) {
	var size = sym.isLiteral ? 1 : (sub ? sub.size : 0)
	var node

	for (var N = this.nodeTabIdx; N < this.nodeTab.length; N++) {
		node = this.nodeTab[N]
		// compare costs to allow identical RHS syms, but different edits
		if (node.sym === sym && node.size === size && node.ruleProps.cost === ruleProps.cost) break
	}

	if (N === this.nodeTab.length) {
		node = {
			sym: sym,
			ruleProps: ruleProps,
			size: size,
			start: sym.isLiteral ? (this.position - 1) : (sub ? sub.parNode.start : this.position),
			subs: []
		}

		this.nodeTab.push(node)
	}

	if (!sym.isLiteral) {
		var match = node.subs.some(function (oldSub) {
			for (; oldSub && sub; oldSub = oldSub.next, sub = sub.next) {
				if (oldSub.size !== sub.size || oldSub.parNode !== sub.parNode) return false
			}

			return oldSub === sub
		})

		if (!match) node.subs.push(sub)
	}

	return node
}

Parser.prototype.addVertex = function (state) {
	for (var V = this.vertTabIdx; V < this.vertTab.length; V++) {
		var vertex = this.vertTab[V]
		if (vertex.state === state) return vertex
	}

	var vertex = {
		state: state,
		start: this.position,
		list: []
	}

	this.vertTab.push(vertex)

	return vertex
}

Parser.prototype.next = function (state, sym) {
	var stateShifts = state.shifts

	for (var S = 0, stateShiftsLen = stateShifts.length; S < stateShiftsLen; ++S) {
		var shift = stateShifts[S]
		if (shift.sym === sym) {
			return this.stateTable.shifts[shift.stateIdx]
		}
	}
}

Parser.prototype.addNode = function (node, oldVertex) {
	var state = this.next(oldVertex.state, node.sym)
	if (!state) return

	var vertexList = this.addVertex(state).list
	var zNode

	for (var i = 0, vertexListLen = vertexList.length; i < vertexListLen; ++i) {
		var subZNode = vertexList[i]
		if (subZNode.node === node) {
			zNode = subZNode
			break
		}
	}

	if (!zNode) {
		zNode = { node: node, list: [] }
		vertexList.push(zNode)

		Array.prototype.push.apply(this.reds, state.reds.map(function (red) {
			return {
				zNode: zNode,
				LHS: red.LHS,
				RHS: red.RHS,
				ruleProps: red.ruleProps
			}
		}))
	}

	if (zNode.list.indexOf(oldVertex) === -1) {
		zNode.list.push(oldVertex)
	}
}

Parser.prototype.reduce = function (red) {
	var pathTab = [ {
		zNode: red.zNode,
		sub: {
			size: red.zNode.node.size,
			parNode: red.zNode.node,
		}
	} ]

	var pathTabIdx = 0
	if (red.RHS.length === 2) {
		var path = pathTab[pathTabIdx++]
		var sub = path.sub
		var vertices = path.zNode.list

		for (var v = 0, verticesLen = vertices.length; v < verticesLen; ++v) {
			var vertexList = vertices[v].list

			for (var z = 0, vertexListLen = vertexList.length; z < vertexListLen; ++z) {
				var zNode = vertexList[z]

				pathTab.push({
					zNode: zNode,
					sub: {
						size: zNode.node.size + sub.size,
						parNode: zNode.node,
						next: sub
					}
				})
			}
		}
	}

	while (pathTabIdx < pathTab.length) {
		var path = pathTab[pathTabIdx++]
		var node = this.addSub(red.LHS, path.sub, red.ruleProps)

		var vertices = path.zNode.list
		for (var v = 0, verticesLen = vertices.length; v < verticesLen; ++v) {
			this.addNode(node, vertices[v])
		}
	}
}

function printNode(node) {
	if (node.sym.isLiteral) {
		return ' \"' + node.sym.name + '\"'
	} else {
		return ' ' + node.sym.name + '_' + node.start + '_' + (node.start + node.size)
	}
}

Parser.prototype.printForest = function () {
	console.log("\nParse Forest:")

	if (this.startNode) {
		console.log('*' + printNode(this.startNode) + '.')
	}

	this.nodeTab.forEach(function (node) {
		if (node.sym.isLiteral) return

		var toPrint = printNode(node)

		if (node.subs.length > 0) {
			if (node.subs[0].parNode.sym.isLiteral) toPrint += ':'
			else toPrint += ' ='
		}

		node.subs.forEach(function (sub, S) {
			if (S > 0) toPrint += ' |'
			for (; sub; sub = sub.next)
				toPrint += printNode(sub.parNode)
		})

		console.log(toPrint + '.');
	})
}

Parser.prototype.printStack = function () {
	var shifts = this.stateTable.shifts

	console.log("\nParse Stack:")

	this.vertTab.forEach(function (vertex) {
		var toPrint = ' v_' + vertex.start + '_' + shifts.indexOf(vertex.state)

		if (vertex.list.length > 0) toPrint += ' <=\t'
		else console.log(toPrint)

		vertex.list.forEach(function (zNode, Z) {
			if (Z > 0) toPrint += '\t\t'

			toPrint += ' [' + printNode(zNode.node) + ' ] <='

			zNode.list.forEach(function (subVertex) {
				toPrint += ' v_' + subVertex.start + '_' + shifts.indexOf(subVertex.state)
			})

			if (Z === vertex.list.length - 1) console.log(toPrint)
			else toPrint += '\n'
		})
	})
}

Parser.prototype.printNodeGraph = function (node, notRoot) {
	var newNode = {
		symbol: node.sym.name,
		ruleProps: node.ruleProps
	}

	if (node.subs.length) {
		newNode.children = []
		node.subs.forEach(function (sub) {
			for (; sub; sub = sub.next) {
				newNode.children.push(this.printNodeGraph(sub.node, true))
			}
		}, this)
	}

	if (notRoot) {
		return newNode
	} else {
		console.log(JSON.stringify(newNode, null, 1))
	}
}