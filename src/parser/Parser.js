module.exports = Parser

function Parser(stateTable) {
	this.stateTable = stateTable
}

Parser.prototype.parse = function (query) {
	var tokens = query.split(' ')

	// could accelerate lookup by seperating terminal and nonterminal
	// could use lunr, and then identify when the first word is a match before checking other words

	// if we use a lunr thing for partial lookups, we can store the size of each terminal symbol, and know how much to check

	var wordTab = []
	this.vertTabs = []
	this.nodeTabs = []

	for (var i = 0, tokensLen = tokens.length; i < tokensLen; ++i) {
		var nGram = ''
		this.nodeTabs[i] = []

		for (var j = i; j < tokensLen; ++j) {
			nGram += (nGram ? ' ' : '') + tokens[j]

			var word = this.stateTable.symbolTab[nGram]
			if (word) {
				var arr = wordTab[j] || (wordTab[j] = [])
				arr.push({
					sym: word,
					start: i, // same as this.position - word.size
					size: nGram.split(' ').length
					// size: 1 + j - i
				})
			}
		}
	}

	// console.log(wordTab)

	this.vertTabs[tokensLen] = []
	this.nodeTabs[tokensLen] = []

	this.position = 0
	this.reds = []
	var redsIdx = 0
	// this.nodeTab = []
	// this.nodeTabIdx = 0

	this.vertTab = this.vertTabs[this.position] = []
	// this.nodeTab = this.nodeTabs[this.position] = []
	this.addVertex(this.stateTable.shifts[0])

	for (var i = 0; i < tokensLen + 1; ++i) { // +1 to allow final reduction
		var words = wordTab[i]
		if (!words && i < tokensLen) {
			// no token at index - either unrecognized word, or a multi-token term sym
			this.vertTab = this.vertTabs[++this.position] = this.vertTab // do we not need the same for nodeTab
			// this.nodeTab = this.nodeTabs[this.position] = this.nodeTab // do we not need the same for nodeTab
			continue
		}

		while (redsIdx < this.reds.length) {
			this.reduce(this.reds[redsIdx++])
		}

		if (i === tokensLen) break

		this.position++
		this.vertTab = this.vertTabs[this.position] = []
		// this.nodeTab = this.nodeTabs[this.position] = []
		// this.nodeTabIdx = this.nodeTab.length

		for (var w = words.length; w-- > 0;) {
			var word = words[w]
			this.nodeTab = this.nodeTabs[word.start] // uncertain if need to do this with nodeTabs
			var wordNode = this.addSub(word.sym)
			wordNode.start = word.start // no effect

			var oldVertTab = this.vertTabs[word.start]
			this.nodeTab = this.nodeTabs[this.position]

			// Loop through all term rules that produce term sym
			for (var r = 0, rules = word.sym.rules, rulesLen = rules.length; r < rulesLen; ++r) {
				var rule = rules[r]
				var sub = {
					size: word.size,  // size of literal
					node: wordNode,
					ruleProps: rule.ruleProps
				}

				var node = this.addSub(rule.RHS[0], sub) // FIX: rename prop - rule.RHS[0] is LHS for terms

				for (var v = 0; v < oldVertTab.length; ++v) {
					this.addNode(node, oldVertTab[v])
				}
			}
		}
	}

	/* ACCEPT */
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
Parser.prototype.addSub = function (sym, sub) {
	var size = sym.isLiteral ? 1 : (sub ? sub.size : 0)
	var node

	for (var n = 0, nodeTabLen = this.nodeTab.length; n < nodeTabLen; ++n) {
		node = this.nodeTab[n]
		if (node.sym === sym && node.size === size) break
	}
	// for (var n = this.nodeTabIdx, nodeTabLen = this.nodeTab.length; n < nodeTabLen; ++n) {
	// 	node = this.nodeTab[n]
	// 	if (node.sym === sym && node.size === size) break
	// }

	if (n === nodeTabLen) {
		node = {
			sym: sym,
			size: size, // 1 for termsym
			start: sym.isLiteral ? (this.position - 1) : (sub ? sub.node.start : this.position)
		}

		if (!sym.isLiteral) {
			node.subs = [ sub ]
		}

		this.nodeTab.push(node)
	}

	else if (!sym.isLiteral && subIsNew(node.subs, sub)) {
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

Parser.prototype.addNode = function (node, oldVertex) {
	var state = this.nextState(oldVertex.state, node.sym)
	if (!state) return

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