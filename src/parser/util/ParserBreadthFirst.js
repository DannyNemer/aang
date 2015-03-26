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
	this.reds = []
	this.redsIdx = 0

	this.vertTab = []
	this.vertTabIdx = 0
	this.nodeTab = []
	this.nodeTabIdx = 0

	// { zNodes: [], startPosition: 0, state: { reds: [], shifts: [66] } }
	this.addVertex(this.stateTable.shifts[0])

	while (true) {
		/* REDUCE */
		while (this.redsIdx < this.reds.length) {
			this.reduce(this.reds[this.redsIdx++])
		}

		/* SHIFT */
		var token = tokens[this.position++]
		if (!token) break

		// Terminal symbol, with all of the rules that lead to it
		// { index: 83, isLiteral: true, name: 'my', rules: [ { RHS: [ { name: [1-sg-poss] } ] } ] }
		var word = this.stateTable.lookUp(token, true)

		if (word.rules.length === 0) {
			console.log('unrecognized word:', token)
			return
		}

		var sub = {
			size: 1, // size of literal (why not use node)
			node: this.addSub(word) // { sym: word, size: 1, start: 0, subs: [] }
		}

		var oldVertTabIdx = this.vertTabIdx
		this.vertTabIdx = this.vertTab.length
		this.nodeTabIdx = this.nodeTab.length

		// Loop through all term rules that produce term sym
		for (var r = 0, rules = word.rules, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r] // { RHS: [ { name: '[1-sg-poss]' } ] }
			// node = {
			// 	sym: { name: '[1-sg-poss]' },
			// 	subs: [
			// 		{ size: 1, node: { sym: { name: 'my' } } }
			// 	]
			// }
			var node = this.addSub(rule.RHS[0], sub, rule.ruleProps)

			for (var v = oldVertTabIdx; v < this.vertTabIdx; ++v) {
				// vert = { zNodes: [], startPosition: 0, state: { reds: [], shifts: [66] } }
				this.addNode(node, this.vertTab[v])
			}
		}
	}

	/* ACCEPT */
	for (var v = this.vertTabIdx, vertTabLen = this.vertTab.length; v < vertTabLen; ++v) {
		var vertex = this.vertTab[v]
		if (vertex.state.isFinal) {
			this.startNode = vertex.zNodes[0].node
			break
		}
	}
}

// no sub for term syms
// sym is either term sym or nonterm sym
Parser.prototype.addSub = function (sym, sub, ruleProps) {
	this.addSubCalls++
	var size = sym.isLiteral ? 1 : (sub ? sub.size : 0)
	var node = null

	// Does not look at previously added nodes
	for (var n = this.nodeTabIdx, nodeTabLen = this.nodeTab.length; n < nodeTabLen; ++n) {
		node = this.nodeTab[n]
		if (node.sym === sym && node.size === size) break
	}

	if (n === nodeTabLen) {
		node = {
			// sym = LHS - 'word' for term syms { name: 'my', rules: [ '[1-sg-poss]' ] }
			// sym = { name: '[1-sg-poss]', rules: [] } - no rules
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

// one vertex for each state
Parser.prototype.addVertex = function (state) {
	for (var v = this.vertTabIdx, vertTabLen = this.vertTab.length; v < vertTabLen; ++v) {
		var vertex = this.vertTab[v]
		if (vertex.state === state) return vertex
	}

	var vertex = {
		state: state, // idx of state in stateTable of reds or shifts
		start: this.position, // index in input string tokens array
		zNodes: [] // zNodes that point to this vertex
	}

	this.vertTab.push(vertex)

	return vertex
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

// node = {
// 	sym: { name: '[1-sg-poss]' },
//  subs: [ { size: 1, node: { sym: { name: 'my' } } } ]
// }
// oldVertex = { zNodes: [], startPosition: 0, state: { reds: [], shifts: [66] } }
Parser.prototype.addNode = function (node, oldVertex) {
	this.addNodeCalls++
	// state = {
	// 	reds: [ {
	//		LHS: { name: "[poss-determiner-sg]" },
	//		RHS: [ { name: "[1-sg-poss]" } ]
	//	} ],
	// 	shifts: []
	// }
	var state = this.nextState(oldVertex.state, node.sym)
	if (!state) return

	// vertex = { state: state, startPos: 0, zNodes: [] }
	var vertex = this.addVertex(state)
	var vertexZNodes = vertex.zNodes
	var zNode

	for (var v = 0, vertexZNodesLen = vertexZNodes.length; v < vertexZNodesLen; ++v) {
		var vertexZNode = vertexZNodes[v]
		if (vertexZNode.node === node) {
			zNode = vertexZNode
			break
		}
	}

	if (!zNode) {
		// vertices are those which lead to this zNode
		zNode = { node: node, vertices: [] }
		vertexZNodes.push(zNode)

		var stateReds = state.reds
		for (var r = 0, stateRedsLen = stateReds.length; r < stateRedsLen; ++r) {
			var red = stateReds[r]
			this.reds.push({
				zNode: zNode,
				LHS: red.LHS,
				binary: red.binary,
				ruleProps: red.ruleProps
			})
		}
	}

	if (zNode.vertices.indexOf(oldVertex) === -1) {
		zNode.vertices.push(oldVertex)
	}
}

// red = {
// 	LHS: { name: "[poss-determiner-sg]", rules: [ { RHS: [ { name: "[1-sg-poss]" } ] } ] },
// 	ruleProps: {},
// 	zNode: {
// 		node: { size: 1, start: 0, subs: [], sym: { name: "[1-sg-poss]" }, ruleProps: {} }
// 		vertices: [ { start: 0, state: { reds: [], shifts: [66] }, zNodes: [] } ]
// 	}
// }
Parser.prototype.reduce = function (red) {
	var vertices = red.zNode.vertices
	var sub = {
		node: red.zNode.node,
		size: red.zNode.node.size
	}

	if (red.binary) {
		for (var v = 0, verticesLen = vertices.length; v < verticesLen; ++v) {
			var vertexZNodes = vertices[v].zNodes

			for (var z = 0, vertexZNodesLen = vertexZNodes.length; z < vertexZNodesLen; ++z) {
				var zNode = vertexZNodes[z]
				var subNew = {
					node: zNode.node,
					size: zNode.node.size + sub.size,
					next: sub
				}

				var node = this.addSub(red.LHS, subNew, red.ruleProps)

				var zNodeVertices = zNode.vertices
				for (var v2 = 0, zNodeVerticesLen = zNodeVertices.length; v2 < zNodeVerticesLen; ++v2) {
					this.addNode(node, zNodeVertices[v2])
				}
			}
		}
	} else {
		// { size: 1, start: 0,
		// 	subs: [ { node: { sym: { name: "[1-sg-poss]" } }, size: 1 } ],
		// 	sym: { name: "[poss-determiner-sg]" } }
		var node = this.addSub(red.LHS, sub, red.ruleProps)

		for (var v = 0, verticesLen = vertices.length; v < verticesLen; ++v) {
			// vertex = { start: 0, state: { reds: [], shifts: [] }, zNodes: [] }
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
}

Parser.prototype.printStack = function () {
	var shifts = this.stateTable.shifts

	console.log("\nParse Stack:")

	this.vertTab.forEach(function (vertex) {
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
}

Parser.prototype.printNodeGraph = function (node, notRoot) {
	var newNode = {
		symbol: node.sym.name,
		ruleProps: node.ruleProps
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