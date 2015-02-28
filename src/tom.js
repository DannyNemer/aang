function SHOW_STATES(shifts) {
	shifts.forEach(function (state, S) {
		console.log(S + ':')

		if (state.isFinal) console.log('\taccept')

		state.reds.forEach(function (red) {
			var toPrint = '\t[' + red.LHS.name + ' ->'

			red.RHS.forEach(function (sym) {
				toPrint += ' ' + sym.name
			})

			console.log(toPrint + ']')
		})

		state.shifts.forEach(function (shift) {
			console.log('\t' + shift.sym.name + ' => ' +  shift.stateIdx)
		})
	})
}

function SHOW_NODE(node) {
	if (node.sym.isLiteral) {
		return ' \"' + node.sym.name + '\"'
	} else {
		return ' ' + node.sym.name + '_' + node.start + '_' + (node.start + node.size)
	}
}

function SHOW_FOREST(nodeTab) {
	console.log("\nParse Forest:")
	nodeTab.forEach(function (node) {
		if (node.sym.isLiteral) return

		var toPrint = SHOW_NODE(node)

		if (node.subs.length > 0) {
			if (node.subs[0].parNode.sym.isLiteral) toPrint += ':'
			else toPrint += ' ='
		}

		node.subs.forEach(function (sub, S) {
			if (S > 0) toPrint += ' |'
			for (; sub; sub = sub.next)
				toPrint += SHOW_NODE(sub.parNode)
		})

		console.log(toPrint + '.');
	})
}

function SHOW_STACK(vertTab, shifts) {
	console.log("\nParse Stack:")
	vertTab.forEach(function (vertex) {
		var toPrint = ' v_' + vertex.start + '_' + shifts.indexOf(vertex.state)

		if (vertex.list.length > 0) toPrint += ' <=\t'
		else console.log(toPrint)

		vertex.list.forEach(function (zNode, Z) {
			if (Z > 0) toPrint += '\t\t'

			toPrint += ' [' + SHOW_NODE(zNode.node) + ' ] <='

			zNode.list.forEach(function (subVertex) {
				toPrint += ' v_' + subVertex.start + '_' + shifts.indexOf(subVertex.state)
			})

			if (Z === vertex.list.length - 1) console.log(toPrint)
			else toPrint += '\n'
		})
	})
}

function printGraph(startNode) {
	console.log(JSON.stringify(print(startNode), null, 1))
	function print (node) {
		var newNode = { symbol: node.sym.name }
		if (node.subs.length) {
			newNode.children = []
			node.subs.forEach(function (sub) {
				for (; sub; sub = sub.next)
					newNode.children.push(print(sub.parNode))
			})
		}
		return newNode
	}
}



function lookUp(name, isLiteral) {
	var sym = symbolTab[name]
	if (sym && sym.isLiteral === isLiteral && sym.name === name)
		return sym

	return symbolTab[name] = {
		name: name,
		isLiteral: isLiteral,
		index: LABEL++,
		rules: []
	}
}

function insertRule(sym, symBuf) {
	for (var i = 0; i < sym.rules.length; i++) {
		for (var j = 0; symBuf[j] && sym.rules[i][j]; j++) {
			var diff = symBuf[j].index - sym.rules[i][j].index
			if (diff) break
		}

		if (!diff && !sym.rules[i][j]) {
			if (!symBuf[j]) return
			else break
		} else if (diff > 0) {
			break
		}
	}

	sym.rules.splice(i, 0, symBuf.slice())
}

function grammar(inputGrammar) {
	symbolTab = {}
	shifts = []
	LABEL = 0

	Object.keys(inputGrammar.nonTerminals).forEach(function (leftSymName) {
		var LHS = lookUp(leftSymName)
		inputGrammar.nonTerminals[leftSymName].forEach(function (rule) {
			var symBuf = rule.RHS.map(function (rightSymName) {
				return lookUp(rightSymName)
			})
			insertRule(LHS, symBuf)
		})
	})

	Object.keys(inputGrammar.terminals).forEach(function (leftSymName) {
		var symBuf = [ lookUp(leftSymName) ]
		inputGrammar.terminals[leftSymName].forEach(function (rule) {
			insertRule(lookUp(rule.RHS[0], true), symBuf)
		})
	})

	return lookUp(inputGrammar.startSymbol)
}

function compItems(A, B) {
	var diff = A.LHS ? (B.LHS ? A.LHS.index - B.LHS.index : 1) : (B.LHS ? -1 : 0)
	if (diff) return diff

	diff = (A.posIdx - A.RHSIdx) - (B.posIdx - B.RHSIdx)
	if (diff) return diff

	for (var AP = A.RHSIdx, BP = B.RHSIdx; A.RHS[AP] && B.RHS[BP]; AP++, BP++) {
		diff = A.RHS[AP].index - B.RHS[BP].index
		if (diff) break
	}

	return A.RHS[AP] ? (B.RHS[BP] ? diff : 1) : (B.RHS[BP] ? -1 : 0)
}

function next(state, sym) {
	for (var S = 0; S < state.shifts.length; S++) {
		var shift = state.shifts[S]
		if (shift.sym === sym) return shifts[shift.stateIdx]
	}
}

function addState(listTab, list) {
	for (var S = 0; S < listTab.length; S++) {
		var oldList = listTab[S]
		if (oldList.length !== list.length) continue

		var match = oldList.some(function (item, i) {
			return compItems(item, list[i]) !== 0
		})

		if (!match) return S
	}

	return listTab.push(list) - 1
}

function addItem(items, item) {
	for (var i = 0; i < items.list.length; i++) {
		var diff = compItems(items.list[i], item)
		if (diff === 0) return
		if (diff > 0) break
	}

	items.list.splice(i, 0, {
		LHS: item.LHS,
		RHS: item.RHS,
		RHSIdx: item.RHSIdx,
		pos: item.pos,
		posIdx: item.posIdx
	})
}

function generate(startSym) {
	var listTab = []

	var startRule = [ startSym ]
	addState(listTab, [ { RHS: startRule, RHSIdx: 0, pos: startRule, posIdx: 0 } ])

	for (var S = 0; S < listTab.length; S++) {
		var QBuf = listTab[S].slice(),
				XTab = [],
				newState = { reds: [] }

		for (var Q = 0; Q < QBuf.length; Q++) {
			var item = QBuf[Q]
			if (!item.pos[item.posIdx]) {
				if (!item.LHS) newState.isFinal = true
			} else {
				var sym = item.pos[item.posIdx++],
						items = null

				XTab.some(function (X) {
					if (X.sym === sym)
						return items = X
				})

				if (!items) {
					items = { sym: sym, list: [] }
					XTab.push(items)
					sym.rules.forEach(function (rule) {
						QBuf.push({ LHS: sym, RHS: rule, RHSIdx: 0, pos: rule, posIdx: 0 })
					})
				}

				addItem(items, item)
				item.posIdx--
			}
		}

		shifts.push(newState)

		QBuf.forEach(function (item) {
			if (!item.pos[item.posIdx] && item.LHS) {
				newState.reds.push({
					LHS: item.LHS,
					RHS: item.RHS
				})
			}
		})

		newState.shifts = XTab.map(function (shift) {
			return { sym: shift.sym, stateIdx: addState(listTab, shift.list) }
		})
	}
}

/* TOMITA PARSER */
function Parser(query) {
	var tokens = query.split(' ')

	this.position = 0
	this.vertTab = []
	this.vertTabIdx = 0
	this.nodeTab = []
	this.nodeTabIdx = 0
	this.reds = []
	this.redsIdx = 0

	this.addVertex(shifts[0])

	while (true) {
		/* REDUCE */
		while (this.redsIdx < this.reds.length)
			this.reduce(this.reds[this.redsIdx++])

		/* SHIFT */
		this.position++
		var token = tokens.shift()
		if (!token) break
		var word = lookUp(token, true)

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
		word.rules.forEach(function (rule) {
			var node = this.addSub(rule[0], sub)
			for (var vertIdx = oldVertTabIdx; vertIdx < this.vertTabIdx; vertIdx++)
				this.addNode(node, this.vertTab[vertIdx])
		}, this)
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

Parser.prototype.addSub = function (sym, sub) {
	var size = sym.isLiteral ? 1 : (sub ? sub.size : 0),
			node

	for (var N = this.nodeTabIdx; N < this.nodeTab.length; N++) {
		node = this.nodeTab[N]
		if (node.sym === sym && node.size === size) break
	}

	if (N === this.nodeTab.length) {
		node = {
			sym: sym,
			size: size,
			start: sym.isLiteral ? (this.position - 1) : (sub ? sub.parNode.start : this.position),
			subs: []
		}

		this.nodeTab.push(node)
	}

	if (!sym.isLiteral) {
		var match = node.subs.some(function (oldSub) {
			for (; oldSub && sub; oldSub = oldSub.next, sub = sub.next)
				if (oldSub.size !== sub.size || oldSub.parNode !== sub.parNode) return false

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

Parser.prototype.addNode = function (node, oldVertex) {
	var state = next(oldVertex.state, node.sym)
	if (!state) return

	var vertex = this.addVertex(state),
			zNode

	vertex.list.some(function (subZnode) {
		if (subZnode.node === node)
			return zNode = subZnode
	})

	if (!zNode) {
		zNode = { node: node, list: [] }
		vertex.list.push(zNode)

		Array.prototype.push.apply(this.reds, state.reds.map(function (red) {
			return {
				zNode: zNode,
				LHS: red.LHS,
				RHS: red.RHS
			}
		}))
	}

	if (zNode.list.indexOf(oldVertex) === -1)
		zNode.list.push(oldVertex)
}

Parser.prototype.reduce = function (red) {
	var pathTab = [ {
		zNode: red.zNode,
		sub: {
			size: red.zNode.node.size,
			parNode: red.zNode.node,
		}
	} ]

	for (var RHSIdx = 1, pathTabIdx = 0; RHSIdx < red.RHS.length; RHSIdx++) {
		var path = pathTab[pathTabIdx++],
				sub = path.sub

		path.zNode.list.forEach(function (vertex) {
			vertex.list.forEach(function (zNode) {
				pathTab.push({
					zNode: zNode,
					sub: {
						size: zNode.node.size + sub.size,
						parNode: zNode.node,
						next: sub
					}
				})
			})
		})
	}

	while (pathTabIdx < pathTab.length) {
		var path = pathTab[pathTabIdx++],
				node = this.addSub(red.LHS, path.sub)

		path.zNode.list.forEach(function (vertex) {
			this.addNode(node, vertex)
		}, this)
	}
}


generate(grammar(require('../gram0.json')))
SHOW_STATES(shifts)

var parser = new Parser('the girl in the park saw a boy with a telescope')
SHOW_FOREST(parser.nodeTab)
SHOW_STACK(parser.vertTab, shifts)
// if (parser.startNode) printGraph(parser.startNode)