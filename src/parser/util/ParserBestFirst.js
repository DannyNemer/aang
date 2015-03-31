// Most likely requires making the insertion arrays (of multiple insertions on rule with same LHS and RHS syms) seperate reductions to take advatange of heap

var BinaryHeap = require('../BinaryHeap.js')

module.exports = Parser

function Parser(stateTable) {
	this.stateTable = stateTable
}

Parser.prototype.parse = function (query) {
	this.addNodeCalls = 0
	this.addSubCalls = 0
	this.testCounter = 0

	var tokens = query.split(' ')
	this.position = 0
	this.vertTabs = []
	this.nodeTabs = []
	this.tokenNodeTabs = []

	this.nodeTab = this.nodeTabs[this.position] = []

	while (true) {
		this.vertTabs[this.position] = []

		var token = tokens[this.position]
		if (!token) break

		var tokenNodes = this.tokenNodeTabs[this.position] = []
		this.position++

		var word = this.stateTable.lookUp(token, true)

		if (word.rules.length === 0) {
			console.log('unrecognized word:', token)
			return
		}

		var sub = {
			size: 1, // size of literal (why not use node)
			node: this.addSub(word) // { sym: word, size: 1, start: 0, subs: [] }
		}

		this.nodeTab = this.nodeTabs[this.position] = []

		for (var r = 0, rules = word.rules, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r] // { RHS: [ { name: '[1-sg-poss]' } ] }
			var node = this.addSub(rule.RHS[0], sub, rule.ruleProps)
			tokenNodes.push(node)
		}
	}

	this.heap = new BinaryHeap

	this.position = 0
	this.cost = 0
	this.vertTab = this.vertTabs[this.position]
	this.addVertex(this.stateTable.shifts[0])

	while (this.heap.size()) {
		var item = this.heap.pop()
		this.position = item.position
		this.cost = item.cost

		this.vertTab = this.vertTabs[this.position]
		this.nodeTab = this.nodeTabs[this.position]
		this.reduce(item.action, item.vertex)
	}

	/* ACCEPT */
	this.vertTab = this.vertTabs[this.vertTabs.length - 1]
	for (var v = this.vertTab.length; v-- > 0;) {
		var vertex = this.vertTab[v]
		if (vertex.state.isFinal) {
			this.startNode = vertex.zNodes[0].node
			break
		}
	}

	if (this.testCounter) console.log('testCounter:', this.testCounter)
}

// no sub for term syms
// sym is either term sym or nonterm sym
Parser.prototype.addSub = function (sym, sub, ruleProps) {
	this.addSubCalls++
	var size = sym.isLiteral ? 1 : (sub ? sub.size : 0)
	var node = null

	for (var n = 0, nodeTabLen = this.nodeTab.length; n < nodeTabLen; ++n) {
		node = this.nodeTab[n]
		if (node.sym === sym && node.size === size) break
	}

	if (n === nodeTabLen) {
		node = {
			sym: sym,
			size: size, // 1 for termsym
			start: sym.isLiteral ? (this.position - 1) : (sub ? sub.node.start : this.position)
		}

		if (!sym.isLiteral) {
			node.subs = []
			node.ruleProps = []
		}

		this.nodeTab.push(node)
	}

	if (!sym.isLiteral && subIsNew(node.subs, sub)) {
		node.subs.push(sub)

		// Insertions are arrays of multiple ruleProps (or normal ruleProps if only insertion) - distinguish?
		// 1 ruleProps per sub (matched by idx) - do not check for duplicate ruleProps
		node.ruleProps.push(ruleProps)
	}

	return node
}

Parser.prototype.reduce = function (action, vertex) {
	if (action.red.binary) {
		var sub = null
		if (action.subNext) {
			sub = action.subNext
		} else {
			sub = action.subNext = {
				node: action.node,
				size: action.node.size
			}
		}

		this.addVertexAction(vertex, sub, action)

		var vertexZNodes = vertex.zNodes
		for (var z = action.zNodeIdx || 0, vertexZNodesLen = vertexZNodes.length; z < vertexZNodesLen; ++z) {
			var zNode = vertexZNodes[z]
			var subNew = {
				node: zNode.node,
				size: zNode.node.size + sub.size,
				next: sub
			}

			var node = this.addSub(action.red.LHS, subNew, action.red.ruleProps)

			zNode.actions.push({
				newNode: node,
				red: {
					binary: false,
					ruleProps: action.red.ruleProps,
				},
				position: this.position,
			})

			var zNodeVertices = zNode.vertices
			for (var v = 0, zNodeVerticesLen = zNodeVertices.length; v < zNodeVerticesLen; ++v) {
				this.addNode(node, zNodeVertices[v])
			}
		}

		if (action.zNodeIdx) action.zNodeIdx = vertexZNodesLen
	} else {
		var node = null
		if (action.newNode) {
			node = action.newNode
		} else {
			var sub = {
				node: action.node,
				size: action.node.size
			}

			node = action.newNode = this.addSub(action.red.LHS, sub, action.red.ruleProps)
		}

		this.addNode(node, vertex)
	}
}

Parser.prototype.addVertexAction = function (vertex, sub, action) {
	if (vertex.actions) {
		var vertexActions = vertex.actions
		for (var v = vertexActions.length; v-- > 0;) {
			if (vertexActions[v].subNext === sub) return
		}
	} else {
		vertex.actions = []
	}

	vertex.actions.push({
		red: action.red,
		zNodeIdx: vertex.zNodes.length,
		position: this.position,
		subNext: sub
	})
}

Parser.prototype.addNode = function (node, oldVertex) {
	this.addNodeCalls++
	var state = this.nextState(oldVertex.state, node.sym)
	if (!state) return

	var vertex = this.addVertex(state)
	var vertexZNodes = vertex.zNodes
	var zNode = null

	for (var z = 0, vertexZNodesLen = vertexZNodes.length; z < vertexZNodesLen; ++z) {
		var vertexZNode = vertexZNodes[z]
		if (vertexZNode.node === node) {
			zNode = vertexZNode
			break
		}
	}

	if (!zNode) {
		// vertices are those which lead to this zNode
		zNode = { node: node, vertices: [ oldVertex ], actions: [] }
		vertexZNodes.push(zNode)

		var stateReds = state.reds // loop orders  matters - items pushed to heap increasing cost order (for speed)
		for (var r = 0, stateRedsLen = stateReds.length; r < stateRedsLen; ++r) {
			var red = stateReds[r]
			var action = {
				node: node,
				red: red
			}

			zNode.actions.push(action)

			this.heap.push({
				action: action,
				vertex: oldVertex,
				cost: this.cost + (red.ruleProps instanceof Array ? red.ruleProps[0].cost : red.ruleProps.cost),
				position: this.position
			})
		}

		if (vertex.actions) {
			var vertexActions = vertex.actions
			for (var a = 0, vertexActionsLen = vertexActions.length; a < vertexActionsLen; ++a) {
				var action = vertexActions[a]
				this.heap.push({
					action: action,
					vertex: vertex,
					cost: this.cost + (action.red.ruleProps instanceof Array ? action.red.ruleProps[0].cost : action.red.ruleProps.cost),
					position: action.position
				})
			}
		}
	} else if (zNode.vertices.indexOf(oldVertex) === -1) {
		zNode.vertices.push(oldVertex)

		var zNodeActions = zNode.actions
		for (var a = 0, zNodeActionsLen = zNodeActions.length; a < zNodeActionsLen; ++a) {
			var action = zNodeActions[a]
			this.heap.push({
				action: action,
				vertex: oldVertex,
				cost: this.cost + (action.red.ruleProps instanceof Array ? action.red.ruleProps[0].cost : action.red.ruleProps.cost),
				position: action.hasOwnProperty('position') ? action.position : this.position
			})
		}
	}
}

// one vertex for each state
Parser.prototype.addVertex = function (state) {
	for (var v = 0, vertTabLen = this.vertTab.length; v < vertTabLen; ++v) {
		var vertex = this.vertTab[v]
		if (vertex.state === state) return vertex
	}

	var vertex = {
		state: state, // idx of state in stateTable of reds or shifts
		start: this.position, // index in input string tokens array
		zNodes: [] // zNodes that point to this vertex
	}

	this.vertTab.push(vertex)
	this.addVertexToNext(vertex)

	return vertex
}

Parser.prototype.addVertexToNext = function (vertex) {
	var tokenNodes = this.tokenNodeTabs[this.position]
	if (tokenNodes) {
		this.vertTab = this.vertTabs[++this.position]

		for (var n = 0, tokenNodesLen = tokenNodes.length; n < tokenNodesLen; ++n) {
			this.addNode(tokenNodes[n], vertex)
		}

		this.vertTab = this.vertTabs[--this.position]
	}
}

Parser.prototype.nextState = function (state, sym) {
	var stateShifts = state.shifts

	for (var s = 0, stateShiftsLen = stateShifts.length; s < stateShiftsLen; ++s) {
		var shift = stateShifts[s]
		if (shift.sym === sym) {
			return this.stateTable.shifts[shift.stateIdx]
		}
	}
}

// sub = { size: 1, node: { sym: { name: 'my', isLiteral: true, rules: [2] } } }
function subIsNew(existingSubs, newSub) {
	var newSubNext = newSub.next

	for (var s = existingSubs.length; s-- > 0;) {
		var oldSub = existingSubs[s]

		if (oldSub.size !== newSub.size || oldSub.node !== newSub.node) {
			continue
		}

		if (newSubNext && (oldSub = oldSub.next)) {
			if (oldSub.size !== newSubNext.size || oldSub.node !== newSubNext.node) {
				continue
			}
		}

		return false // sub exists
	}

	return true
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

	this.nodeTabs.forEach(function (nodeTab) {
		nodeTab.forEach(function (node) {
			if (node.sym.isLiteral) return

			var toPrint = printNode(node)

			if (node.subs.length > 0) {
				if (node.subs[0].node.sym.isLiteral) toPrint += ':'
				else toPrint += ' ='
			}

			node.subs.forEach(function (sub, S) {
				if (S > 0) toPrint += ' |'
				for (; sub; sub = sub.next)
					toPrint += printNode(sub.node)
			})

			console.log(toPrint + '.');
		})
	})
}

Parser.prototype.printStack = function () {
	var shifts = this.stateTable.shifts

	console.log("\nParse Stack:")

	this.vertTabs.forEach(function (vertTab) {
		vertTab.forEach(function (vertex) {
			var toPrint = ' v_' + vertex.start + '_' + shifts.indexOf(vertex.state)

			if (vertex.zNodes.length > 0) toPrint += ' <=\t'
			else console.log(toPrint)

			vertex.zNodes.forEach(function (zNode, Z) {
				if (Z > 0) toPrint += '\t\t'

				toPrint += ' [' + printNode(zNode.node) + ' ] <='

				zNode.vertices.forEach(function (subVertex) {
					toPrint += ' v_' + subVertex.start + '_' + shifts.indexOf(subVertex.state)
				})

				if (Z === vertex.zNodes.length - 1) console.log(toPrint)
				else toPrint += '\n'
			})
		})
	})
}

Parser.prototype.printNodeGraph = function (node, notRoot) {
	var newNode = {
		symbol: node.sym.name,
		ruleProps: node.ruleProps,
		// paths: node.paths ? node.paths.length : undefined
	}

	if (node.subs) {
		newNode.subs = node.subs.map(function (sub) {
			var children = []
			for (; sub; sub = sub.next) {
				children.push(this.printNodeGraph(sub.node, true))
			}
			return children
		}, this)
	}

	if (notRoot) {
		return newNode
	} else {
		console.log(JSON.stringify(newNode, null, 1))
	}
}