module.exports = Parser
var util = require('../util')

function Parser(stateTable) {
	this.stateTable = stateTable
}

Parser.prototype.parse = function (query) {
	var tokens = query.split(' ')

	// could accelerate lookup by seperating terminal and nonterminal
	// could use lunr, and then identify when the first word is a match before checking other words
	// if we use a lunr thing for partial lookups, we can store the size of each terminal symbol, and know how much to check

	// To consider deletions, might need to create wordNodes in loop and check if can span entire query
	// Might require array of nodeTabs - or not, might not even need to add to nodeTab

	var wordTab = []

	for (var i = 0, tokensLen = tokens.length; i < tokensLen; ++i) {
		var nGram = tokens[i]
		var j = i
		while (true) {
			var wordSym = this.stateTable.symbolTab[nGram]
			if (wordSym) {
				var arr = wordTab[j] || (wordTab[j] = [])
				arr.push(wordSym)
			}

			if (++j === tokensLen) break

			nGram += ' ' + tokens[j]
		}
	}

	// console.log(wordTab)

	this.position = 0
	this.reds = []
	var redsIdx = 0
	this.nodeTab = []
	this.nodeTabIdx = 0

	this.vertTabs = []
	this.vertTab = this.vertTabs[this.position] = []
	this.addVertex(this.stateTable.shifts[0])

	while (true) {
		var words = wordTab[this.position]

		if (!words) {
			// scanned entire input
			if (this.position === tokensLen) break

			// no token at index - either unrecognized word, or a multi-token term sym
			this.vertTab = this.vertTabs[++this.position] = this.vertTab
			continue
		}

		this.vertTab = this.vertTabs[++this.position] = []
		this.nodeTabIdx = this.nodeTab.length

		for (var w = words.length; w-- > 0;) {
			var wordSym = words[w]
			var wordNode = this.addSub(wordSym)

			var oldVertTab = this.vertTabs[this.position - wordSym.size]

			// Loop through all term rules that produce term sym
			for (var rules = wordSym.rules, r = rules.length; r-- > 0;) {
				var rule = rules[r]
				var sub = {
					size: wordSym.size,  // size of literal
					node: wordNode,
					ruleProps: rule.ruleProps
				}

				var node = this.addSub(rule.RHS[0], sub) // FIX: rename prop - rule.RHS[0] is LHS for terms

				for (var v = 0; v < oldVertTab.length; ++v) {
					this.addNode(node, oldVertTab[v])
				}
			}
		}

		// REDUCE
		while (redsIdx < this.reds.length) {
			this.reduce(this.reds[redsIdx++])
		}
	}

	/* ACCEPT */
	for (var v = this.vertTab.length; v-- > 0;) {
		var vertex = this.vertTab[v]
		if (vertex.state.isFinal) {
			this.startNode = vertex.zNodes[0].node
			break
		}
	}
}

// no sub for term syms
// sym is either term sym or nonterm sym
Parser.prototype.addSub = function (sym, sub) {
	var size = sub ? sub.size : sym.size // no sub -> literal
	var node

	for (var n = this.nodeTab.length; n-- > this.nodeTabIdx;) {
		node = this.nodeTab[n]
		if (node.sym === sym && node.size === size) break
	}

	if (n < this.nodeTabIdx) {
		node = {
			sym: sym,
			size: size
		}

		if (sub) { // nonterminal
			node.start = sub.node.start
			node.subs = [ sub ]
		} else {
			node.start = this.position - size
		}

		this.nodeTab.push(node)
	}

	else if (sub && subIsNew(node.subs, sub)) { // existing nonterminal
		node.subs.push(sub)

		// Insertions are arrays of multiple ruleProps (or normal ruleProps if only insertion) - distinguish?
		// 1 ruleProps per sub (matched by idx) - do not check for duplicate ruleProps - done in grammar
	}

	return node
}

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
	for (var v = this.vertTab.length; v-- > 0;) {
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

Parser.prototype.addNode = function (node, oldVertex) {
	var state = this.nextState(oldVertex.state, node.sym)
	if (!state) return

	var vertex = this.addVertex(state)
	var vertexZNodes = vertex.zNodes
	var zNode

	for (var v = vertexZNodes.length; v-- > 0;) {
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

Parser.prototype.reduce = function (red) {
	var vertices = red.zNode.vertices
	var sub = {
		node: red.zNode.node,
		size: red.zNode.node.size,
	}

	if (red.binary) {
		for (var v = 0, verticesLen = vertices.length; v < verticesLen; ++v) {
			var vertexZNodes = vertices[v].zNodes

			for (var z = 0, vertexZNodesLen = vertexZNodes.length; z < vertexZNodesLen; ++z) {
				var zNode = vertexZNodes[z]
				var subNew = {
					node: zNode.node,
					size: zNode.node.size + sub.size,
					next: sub,
					ruleProps: red.ruleProps
				}

				var node = this.addSub(red.LHS, subNew)

				var zNodeVertices = zNode.vertices
				for (var v2 = 0, zNodeVerticesLen = zNodeVertices.length; v2 < zNodeVerticesLen; ++v2) {
					this.addNode(node, zNodeVertices[v2])
				}
			}
		}
	} else {
		sub.ruleProps = red.ruleProps
		var node = this.addSub(red.LHS, sub)

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

Parser.prototype.printNodeGraph = function (sub) {
	var node = sub.node || sub

	var newNode = {
		symbol: node.sym.name,
		ruleProps: sub.ruleProps
	}

	if (node.subs) {
		newNode.subs = node.subs.map(function (sub) {
			var children = []
			for (; sub; sub = sub.next) {
				children.push(this.printNodeGraph(sub))
			}
			return children
		}, this)
	}

	if (sub.node) {
		return newNode
	} else {
		console.log(JSON.stringify(newNode, null, 1)) // Start node
	}
}