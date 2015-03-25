var BinaryHeap = require('./BinaryHeap.js')

module.exports = Parser

function Parser(stateTable) {
	this.stateTable = stateTable
}

Parser.prototype.parse = function (query) {
	this.addNodeCalls = 0
	this.addSubCalls = 0

	var tokens = query.split(' ')
	this.position = 0
	this.cost = 0
	this.vertTabs = []
	this.nodeTabs = []
	this.tokenNodeTabs = []

	this.nodeTab = this.nodeTabs[this.position] = []
	this.vertTabs[this.position] = []

	while (true) {
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
		this.vertTabs[this.position] = []

		for (var r = 0, rules = word.rules, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r] // { RHS: [ { name: '[1-sg-poss]' } ] }
			var node = this.addSub(rule.RHS[0], sub, rule.ruleProps)
			tokenNodes.push(node)
		}
	}

	this.position = 0
	this.vertTab = this.vertTabs[this.position]

	this.heap = new BinaryHeap

	var firstVert = this.addVertex(this.stateTable.shifts[0])
	this.addVertexToNext(firstVert)

	while (this.heap.size()) {
		this.item = this.heap.pop()
		this.position = this.item.position
		this.cost = this.item.cost

		this.vertTab = this.vertTabs[this.position]
		this.nodeTab = this.nodeTabs[this.position]
		this.reduce(this.item.red)
	}

	/* ACCEPT */
	this.vertTab = this.vertTabs[this.vertTabs.length - 1]
	for (var v = 0, vertTabLen = this.vertTab.length; v < vertTabLen; ++v) {
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
	for (var n = 0, nodeTabLen = this.nodeTab.length; n < nodeTabLen; ++n) {
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
			node.paths = []
			node.subs = []
			node.ruleProps = []
		}

		this.nodeTab.push(node)
	}

	if (!sym.isLiteral) {
		if (subIsNew(node.subs, sub)) {
			node.subs.push(sub)
			// appendPaths(node, sub, ruleProps)

			// Insertions are arrays of multiple ruleProps (or normal ruleProps if only insertion) - distinguish?
			// 1 ruleProps per sub (matched by idx) - do not check for duplicate ruleProps
			node.ruleProps.push(ruleProps)
		} else {
			// console.log(subs)
			// console.log(sub)
		}
	}

	return node
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
	var sub = {
		node: red.zNode.node,
		size: red.zNode.node.size
	}

	if (red.binary) {
		var newRed = { // save sub too!!! (and anything else) - we are creating duplicate reds (though not called)
			zNode: red.zNode,
			LHS: red.LHS,
			binary: true,
			oldLength: red.vertex.zNodes.length,
			ruleProps: red.ruleProps,
			position: this.position
		}
		red.vertex.reds ? red.vertex.reds.push(newRed) : red.vertex.reds = [ newRed ]

		var vertexZNodes = red.vertex.zNodes
		for (var z = red.oldLength || 0, vertexZNodesLen = vertexZNodes.length; z < vertexZNodesLen; ++z) {
			var zNode = vertexZNodes[z]
			var subNew = {
				node: zNode.node,
				size: zNode.node.size + sub.size,
				next: sub
			}

			var node = this.addSub(red.LHS, subNew, red.ruleProps)

			zNode.reds.push({
				newNode: node,
				binary: false,
				ruleProps: red.ruleProps,
				position: this.position,
				// cost: this.cost
			})

			var zNodeVertices = zNode.vertices
			for (var v = 0, zNodeVerticesLen = zNodeVertices.length; v < zNodeVerticesLen; ++v) {
				this.addNode(node, zNodeVertices[v])
			}
		}
	} else {
		// { size: 1, start: 0,
		// 	subs: [ { node: { sym: { name: "[1-sg-poss]" } }, size: 1 } ],
		// 	sym: { name: "[poss-determiner-sg]" } }
		var node = red.redLink.newNode || (red.redLink.newNode = this.addSub(red.LHS, sub, red.ruleProps))
		this.addNode(node, red.vertex)
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
	var prevLen = this.vertTab.length
	var vertex = this.addVertex(state)
	var vertexZNodes = vertex.zNodes
	var zNode

	for (var z = 0, vertexZNodesLen = vertexZNodes.length; z < vertexZNodesLen; ++z) {
		var vertexZNode = vertexZNodes[z]
		if (vertexZNode.node === node) {
			zNode = vertexZNode
			break
		}
	}

	if (!zNode) {
		// vertices are those which lead to this zNode
		zNode = { node: node, vertices: [], reds: [] }
		vertexZNodes.push(zNode)
		// will loop overzNodes  already seen - need to avoid
		if (vertex.reds) {
			vertex.reds.forEach(function (red) {
				var newRed = {
					zNode: red.zNode,
					LHS: red.LHS,
					vertex: vertex,
					oldLength: red.oldLength,
					RHSLengthIsTwo: red.RHSLengthIsTwo, // true
					ruleProps: red.ruleProps
				}

				this.heap.push({
					red: newRed,
					cost: this.cost + (red.ruleProps instanceof Array ? red.ruleProps[0].cost : red.ruleProps.cost),
					position: red.hasOwnProperty('position') ? red.position : this.position
				})
			}, this)
		}

		var stateReds = state.reds // order of loop matters so items are added to heap increasing cost order (for speed)
		for (var r = 0, stateRedsLen = stateReds.length; r < stateRedsLen; ++r) {
			var red = stateReds[r]
			var newRed = {
				zNode: zNode,
				vertex: oldVertex,
				LHS: red.LHS,
				binary: red.binary,
				ruleProps: red.ruleProps,
				// position: this.position
			}

			newRed.redLink = newRed // give you an idea of an array of reds?

			zNode.reds.push(newRed)

			this.heap.push({
				red: newRed,
				cost: this.cost + (red.ruleProps instanceof Array ? red.ruleProps[0].cost : red.ruleProps.cost),
				position: this.position
			})
		}
	} else if (zNode.vertices.indexOf(oldVertex) === -1) {
		for (var r = zNode.reds.length; r-- > 0;) {
			var red = zNode.reds[r]
			this.heap.push({
				red: {
					zNode: zNode,
					vertex: oldVertex,
					LHS: red.LHS,
					binary: red.binary,
					ruleProps: red.ruleProps,
					redLink: red,
				},
				cost: this.cost + (red.ruleProps instanceof Array ? red.ruleProps[0].cost : red.ruleProps.cost),
				position: red.hasOwnProperty('position') ? red.position : this.position
			})
		}
	} // we are adding the same red twice, with different vertex, often times before first red done
	// should have an array with idxs, but then how to know to readd to heap? based on last idx of vertex

	if (zNode.vertices.indexOf(oldVertex) === -1) {
		zNode.vertices.push(oldVertex)
	}

	if (this.vertTab.length > prevLen) {
		this.addVertexToNext(vertex)
	}
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

// Temporary: bottom-up parse the display texts and costs
function appendPaths(node, sub, ruleProps) {
	if (ruleProps instanceof Array) {
		ruleProps.forEach(function (rulePropsSub) {
			appendPaths(node, sub, rulePropsSub)
		})
	} else if (sub.node.paths) {
		sub.node.paths.forEach(function (pathA) {
			if (ruleProps.text) {
				// if insertion, don't check sub.ntext
				node.paths.push({
					text: ruleProps.textIdx ? pathA.text.concat(ruleProps.text) : ruleProps.text.concat(pathA.text),
					cost: ruleProps.cost + pathA.cost
				})
			} else if (sub.next) {
				sub.next.node.paths.forEach(function (pathB) {
					node.paths.push({
						text: ruleProps.transposition ? pathB.text.concat(pathA.text) : pathA.text.concat(pathB.text),
						cost: ruleProps.cost + pathA.cost + pathB.cost
					})
				})
			} else {
				node.paths.push({
					text: pathA.text,
					cost: ruleProps.cost + pathA.cost
				})
			}
		})
	} else {
		node.paths.push({
			text: [ruleProps.text],
			cost: ruleProps.cost
		})
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