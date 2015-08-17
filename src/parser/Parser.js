var util = require('../util')
var intSymbol = require('../grammar/grammar').intSymbol
var entities = require('../aang.json').entities
var semantic = require('../grammar/semantic')


module.exports = Parser

function Parser(stateTable) {
	this.stateTable = stateTable

	// Use a search index for partial-matches of input to terminal symbols
	// this.matchTerminalRules = require('./util/matchTerminalRulesWithSearchIndex')(this)
}

// Check if nGram is an entity
// This simple entity resolution implementation will be replaced by language models for each category
Parser.prototype.entityLookup = function (wordTab, endPos, newSemanticArgs, text) {
	var entityInstances = entities[text]
	if (entityInstances) {
		for (var e = entityInstances.length; e-- > 0;) {
			var entity = entityInstances[e]
			var wordSym = this.stateTable.symbolTab[entity.category]
			// create node with terminal symbol
			var wordNode = this.addSub(wordSym)

			var entityId = entity.id
			var semanticArg = newSemanticArgs[entityId] || (newSemanticArgs[entityId] = [ { semantic: { name: entityId } } ])

			// Loop through all term rules that produce term sym
			var wordNodes = []
			var wordSize = wordSym.size
			for (var rules = wordSym.rules, r = rules.length; r-- > 0;) {
				var rule = rules[r]
				var ruleProps = rule.ruleProps

				var sub = {
					size: wordSize, // size of literal
					node: wordNode,
					ruleProps: {
						cost: ruleProps.cost,
						semantic: ruleProps.semantic ? semantic.insertSemantic(ruleProps.semantic, semanticArg) : semanticArg,
						text: entity.text,
					},
					minCost: undefined,
				}

				// create node with LHS of terminal rule
				wordNodes.push(this.addSub(rule.RHS[0], sub)) // FIX: rename prop - rule.RHS[0] is LHS for terms
			}

			var words = wordTab[endPos] || (wordTab[endPos] = [])
			words.push({
				start: this.position,
				nodes: wordNodes,
			})
		}
	}
}

// Look up terminal symbol matches in input
Parser.prototype.matchTerminalRules = function (query) {
	var tokens = query.toLowerCase().split(/\s+/)
	this.tokensLen = tokens.length
	var wordTab = []

	// Create semantic arguments for input matches to '<int>'
	// Prevent making duplicate semantic arguments to detect duplicity by Object reference (not semantic name)
	var newSemanticArgs = {}

	for (; this.position < this.tokensLen; ++this.position) {
		var nGram = tokens[this.position]
		this.nodeTab = this.nodeTabs[this.position] = []

		if (isNaN(nGram)) {
			// Check every possible n-gram for multi-word terminal symbols
			var endPos = this.position
			while (true) {
				this.entityLookup(wordTab, endPos, newSemanticArgs, nGram)

				// this.nodeTab = this.nodeTabs[endPos] // should I be doing this?
				var wordSym = this.stateTable.symbolTab[nGram]
				// Prevent terminal symbol match with placeholder symbols: <int>, entities category names (e.g., {user})
				if (wordSym && !wordSym.isPlaceholder) {
					// create node with terminal symbol
					var wordNode = this.addSub(wordSym)

					// Loop through all term rules that produce term sym
					var wordNodes = []
					var wordSize = wordSym.size
					for (var rules = wordSym.rules, r = rules.length; r-- > 0;) {
						var rule = rules[r]
						var sub = {
							size: wordSize, // size of literal
							node: wordNode,
							ruleProps: rule.ruleProps,
							minCost: undefined,
						}

						// create node with LHS of terminal rule
						wordNodes.push(this.addSub(rule.RHS[0], sub)) // FIX: rename prop - rule.RHS[0] is LHS for terms
					}

					// Save word to index of last token
					var words = wordTab[endPos] || (wordTab[endPos] = [])
					words.push({
						start: this.position,
						nodes: wordNodes,
					})
				}

				if (++endPos === this.tokensLen) break

				nGram += ' ' + tokens[endPos]
			}
		}

		// If unigram is a number, match with rules with '<int>' term symbol, using unigram as entity
		else {
			var wordSym = this.stateTable.symbolTab[intSymbol]
			// create node with terminal symbol
			var wordNode = this.addSub(wordSym)

			var semanticArg = newSemanticArgs[nGram] || (newSemanticArgs[nGram] = [ { semantic: { name: nGram } } ])

			// Loop through all term rules that produce term sym
			var wordNodes = []
			var wordSize = wordSym.size
			for (var rules = wordSym.rules, r = rules.length; r-- > 0;) {
				var rule = rules[r]
				var ruleProps = rule.ruleProps

				if (nGram <= ruleProps.intMax && nGram >= ruleProps.intMin) {
					var sub = {
						size: wordSize, // size of literal
						node: wordNode,
						ruleProps: {
							cost: ruleProps.cost,
							semantic: semanticArg,
							text: nGram,
						},
						minCost: undefined,
					}

					// create node with LHS of terminal rule
					wordNodes.push(this.addSub(rule.RHS[0], sub)) // FIX: rename prop - rule.RHS[0] is LHS for terms
				}
			}

			// will only be one term sym match (<int>) and only of length 1
			wordTab[this.position] = [ {
				start: this.position,
				nodes: wordNodes,
			} ]
		}
	}

	this.position = 0 // reset

	return wordTab
}

Parser.prototype.parse = function (query) {
	this.nodeTabs = []
	this.position = 0
	// var wordTab = this.lunr(query)
	var wordTab = this.matchTerminalRules(query)
	// util.log(wordTab)

	this.reds = []
	var redsIdx = 0

	this.vertTabs = []
	this.vertTab = this.vertTabs[this.position] = []
	this.addVertex(this.stateTable.shifts[0])

	while (true) {
		var words = wordTab[this.position]

		if (!words) {
			// scanned entire input
			if (this.position === this.tokensLen) break

			// no token at index - either unrecognized word, or a multi-token term sym
			this.vertTab = this.vertTabs[++this.position] = this.vertTab
			continue
		}

		this.nodeTab = this.nodeTabs[this.position]
		this.vertTab = this.vertTabs[++this.position] = []

		for (var w = words.length; w-- > 0;) {
			var word = words[w]
			var oldVertTab = this.vertTabs[word.start]
			var oldVertTabLen = oldVertTab.length

			// Loop through all term rules that produce term sym
			for (var nodes = word.nodes, n = nodes.length; n-- > 0;) {
				var node = nodes[n]
				for (var v = oldVertTabLen; v-- > 0;) {
					this.addNode(node, oldVertTab[v])
				}
			}
		}

		// REDUCE
		while (redsIdx < this.reds.length) {
			this.reduce(this.reds[redsIdx++])
		}
	}

	// ACCEPT
	for (var v = this.vertTab.length; v-- > 0;) {
		var vertex = this.vertTab[v]
		if (vertex.state.isFinal) {
			var zNodes = vertex.zNodes
			for (var z = zNodes.length; z-- > 0;) {
				var node = zNodes[z].node
				if (node.size === this.tokensLen) {
					return node
				}
			}
		}
	}

	return null
}

// no sub for term syms
// sym is either term sym or nonterm sym
Parser.prototype.addSub = function (sym, sub) {
	var size = sub ? sub.size : sym.size // no sub -> literal
	var node

	for (var n = this.nodeTab.length; n-- > 0;) {
		node = this.nodeTab[n]
		if (node.sym === sym && node.size === size) break
	}

	if (n < 0) {
		node = {
			sym: sym,
			size: size,
			start: undefined,
			subs: undefined,
		}

		if (sub) { // nonterminal
			node.start = sub.node.start
			node.subs = [ sub ]
		} else {
			node.start = this.position
		}

		this.nodeTab.push(node)
	}

	// Existing nonterminal
	else if (sub && subIsNew(node.subs, sub)) {
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

		// Sub exists
		return false
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
		// Index of state in stateTable of reds + shifts
		state: state,
		// Index in input string tokens array
		start: this.position,
		// zNodes that point to this vertex
		zNodes: [],
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
		zNode = vertexZNodes[v]
		if (zNode.node === node) break
	}

	if (v < 0) {
		// vertices are those which lead to this zNode
		zNode = { node: node, vertices: [ oldVertex ] }
		vertexZNodes.push(zNode)

		var stateReds = state.reds
		for (var r = stateReds.length; r-- > 0;) {
			var red = stateReds[r]
			this.reds.push({
				zNode: zNode,
				LHS: red.LHS,
				binary: red.binary,
				ruleProps: red.ruleProps,
			})
		}
	}

	else if (zNode.vertices.indexOf(oldVertex) === -1) {
		zNode.vertices.push(oldVertex)
	}
}

Parser.prototype.reduce = function (red) {
	var vertices = red.zNode.vertices
	var sub = {
		node: red.zNode.node,
		size: red.zNode.node.size,
		minCost: undefined,
		ruleProps: undefined,
	}

	if (red.binary) {
		var isTransposition = red.ruleProps.transposition

		for (var v = vertices.length; v-- > 0;) {
			var vertexZNodes = vertices[v].zNodes

			for (var z = vertexZNodes.length; z-- > 0;) {
				var zNode = vertexZNodes[z]
				var subNew

				// Flip RHS for transposition
				if (isTransposition) {
					subNew = {
						node: sub.node,
						size: zNode.node.size + sub.size,
						next: {
							node: zNode.node,
							size: zNode.node.size,
						},
						ruleProps: red.ruleProps,
						minCost: undefined,
					}
				} else {
					subNew = {
						node: zNode.node,
						size: zNode.node.size + sub.size,
						next: sub,
						ruleProps: red.ruleProps,
						minCost: undefined,
					}
				}

				var node = this.addSub(red.LHS, subNew)

				var zNodeVertices = zNode.vertices
				for (var v2 = zNodeVertices.length; v2-- > 0;) {
					this.addNode(node, zNodeVertices[v2])
				}
			}
		}
	} else {
		sub.ruleProps = red.ruleProps
		var node = this.addSub(red.LHS, sub)

		for (var v = vertices.length; v-- > 0;) {
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

Parser.prototype.printForest = function (startNode) {
	console.log("\nParse Forest:")

	if (startNode) {
		console.log('*' + printNode(startNode) + '.')
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
		ruleProps: sub.ruleProps,
		subs: undefined,
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
		util.log(newNode) // Start node
	}
}