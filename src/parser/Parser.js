module.exports = Parser
var util = require('../util')
var lunr = require('lunr')

function Parser(stateTable) {
	this.stateTable = stateTable

	this.index = new lunr.Index
	this.index.field('text')

	for (var symName in this.stateTable.symbolTab) {
		var sym = this.stateTable.symbolTab[symName]
		if (sym.isLiteral) {
			this.index.add({
				id: symName,
				text: symName
			})
		}
	}
}

// Lunr could support "cont to" -> [ "contributors to", "contributed to" ]
// But we are not currently permitting that
// That should not matter because this is temporary solution
Parser.prototype.lunr = function (query) {
	var tokens = query.split(' ')
	this.tokensLen = tokens.length

	// First, match input to term symbols
	// If it is a multi-word term sym, check out far the match extends
	// This must be seperate because resorting is required after checking for extending matches
	var multiTokenWords = []
	var matchTab = []
	for (var t = 0; t < this.tokensLen; ++t) {
		var nGram = tokens[t]

		if (!isNaN(nGram)) continue

		var matches = matchTab[t] = this.index.search(nGram)

		for (var m = 0, matchesLen = matches.length; m < matchesLen; ++m) {
			var match = matches[m]
			var matchRef = match.ref
			match.score = matchRef === nGram ? 0 : 1 - match.score

			// Loop through all term rules that produce term sym
			var wordNodes = []
			match.size = 1
			var symSize = matchRef.split(' ').length

			if (symSize > 1 && t < this.tokensLen - 1) {
				var mults = multiTokenWords[t]
				if (mults && mults.indexOf(matchRef) !== -1) continue

				var nGramNew = null
				var bound = Math.min(this.tokensLen, t + symSize)

				for (var i = t + 2; i <= bound; ++i) {
					nGramNew = tokens.slice(t, i).join(' ')
					if (matchRef.indexOf(nGramNew) === -1) {
						nGramNew = tokens.slice(t, i - 1).join(' ')
						break
					} else {
						var idx = i - 1
						var arr = multiTokenWords[idx] || (multiTokenWords[idx] = [])
						arr.push(matchRef)
					}
				}

				match.size = i - 1 - t

				if (match.size > 1) { // otherwise match did not begin at first token and only matched one
					var matchesNew = this.index.search(nGramNew)
					for (var m2 = 0, matchesNewLen = matchesNew.length; m2 < matchesNewLen; ++m2) {
						var matchNew = matchesNew[m2]
						if (matchNew.ref === matchRef) {
							match.score = matchRef === nGramNew ? 0 : 1 - matchNew.score
							break
						}
					}
				}
			}
		}
	}


	var wordTab = []

	// Create semantic arguments for input matches to '<int>'
	// Prevent making duplicate semantic arguments to detect duplicity by Object reference (not semantic name)
	var newSemanticArgs = {}

	for (; this.position < this.tokensLen; ++this.position) {
		var nGram = tokens[this.position]
		this.nodeTab = this.nodeTabs[this.position] = []

		if (isNaN(nGram)) {
			// Score can change after checking for extent of multi-word term sym matches
			// Must reorder because choose the first terminal symbol to match to a term rule
			var matches = matchTab[this.position].sort(function (a, b) {
				return a.score - b.score
			})
			// Multiple terminal symbols can match to the same term rule, so choose the first (best match)
			// Ex: 'repos' -> [ 'repos', 'repositories' ]
			var LHSSeen = []

			for (var m = 0, matchesLen = matches.length; m < matchesLen; ++m) {
				var match = matches[m]
				var wordSym = this.stateTable.symbolTab[match.ref]
				var wordNode = this.addSub(wordSym)

				// Loop through all term rules that produce term sym
				var wordNodes = []
				var wordSize = match.size

				for (var rules = wordSym.rules, r = rules.length; r-- > 0;) {
					var rule = rules[r]
					var LHS = rule.RHS[0] // FIX: rename prop - rule.RHS[0] is LHS for terms

					if (LHSSeen.indexOf(LHS) !== -1) continue
					LHSSeen.push(LHS)

					// Make new ruleProps with match score
					var origRuleProps = rule.ruleProps
					var sub = {
						size: wordSize, // number of positions spanned in input
						node: wordNode,
						ruleProps: {
							cost: origRuleProps.cost + match.score,
							text: origRuleProps.text,
							semantic: origRuleProps.semantic
						}
					}

					// create node with LHS of terminal rule
					wordNodes.push(this.addSub(LHS, sub))
				}

				if (wordNodes.length) {
					var endIdx = this.position + wordSize - 1
					var words = wordTab[endIdx] || (wordTab[endIdx] = [])
					words.push({
						start: this.position,
						nodes: wordNodes
					})
				}
			}
		}

		// Handle numbers in input (same as other implementation)
		else {
			var wordSym = this.stateTable.symbolTab['<int>']
			// create node with terminal symbol
			var wordNode = this.addSub(wordSym)

			var semanticArg = newSemanticArgs[nGram] || (newSemanticArgs[nGram] = [ { semantic: { name: nGram } } ])

			// Loop through all term rules that produce term sym
			var wordNodes = []
			var wordSize = wordSym.size
			for (var rules = wordSym.rules, r = rules.length; r-- > 0;) {
				var rule = rules[r]
				var sub = {
					size: wordSize, // size of literal
					node: wordNode,
					ruleProps: {
						cost: rule.ruleProps.cost,
						semantic: semanticArg,
						text: nGram
					}
				}

				// create node with LHS of terminal rule
				wordNodes.push(this.addSub(rule.RHS[0], sub)) // FIX: rename prop - rule.RHS[0] is LHS for terms
			}

			// will only be one term sym match (<int>) and only of length 1
			wordTab[this.position] = [ {
				start: this.position,
				nodes: wordNodes
			} ]
		}
	}

	this.position = 0 // reset

	return wordTab
}

// Look up terminal symbol matches in input
Parser.prototype.matchTerminalRules = function (query) {
	var tokens = query.split(' ')
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
			var j = this.position
			while (true) {
				// this.nodeTab = this.nodeTabs[j] // should I be doing this?
				var wordSym = this.stateTable.symbolTab[nGram]
				if (wordSym) {
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
							ruleProps: rule.ruleProps
						}

						// create node with LHS of terminal rule
						wordNodes.push(this.addSub(rule.RHS[0], sub)) // FIX: rename prop - rule.RHS[0] is LHS for terms
					}

					var words = wordTab[j] || (wordTab[j] = [])
					words.push({
						start: this.position,
						nodes: wordNodes
					})
				}

				if (++j === this.tokensLen) break

				nGram += ' ' + tokens[j]
			}
		}

		// If unigram is a number, match with rules with '<int>' term symbol, using unigram as entity
		else {
			var wordSym = this.stateTable.symbolTab['<int>']
			// create node with terminal symbol
			var wordNode = this.addSub(wordSym)

			var semanticArg = newSemanticArgs[nGram] || (newSemanticArgs[nGram] = [ { semantic: { name: nGram } } ])

			// Loop through all term rules that produce term sym
			var wordNodes = []
			var wordSize = wordSym.size
			for (var rules = wordSym.rules, r = rules.length; r-- > 0;) {
				var rule = rules[r]
				var sub = {
					size: wordSize, // size of literal
					node: wordNode,
					ruleProps: {
						cost: rule.ruleProps.cost,
						semantic: semanticArg,
						text: nGram
					}
				}

				// create node with LHS of terminal rule
				wordNodes.push(this.addSub(rule.RHS[0], sub)) // FIX: rename prop - rule.RHS[0] is LHS for terms
			}

			// will only be one term sym match (<int>) and only of length 1
			wordTab[this.position] = [ {
				start: this.position,
				nodes: wordNodes
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
					this.startNode = node
					break
				}
			}

			break
		}
	}
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
			size: size
		}

		if (sub) { // nonterminal
			node.start = sub.node.start
			node.subs = [ sub ]
		} else {
			node.start = this.position
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
				ruleProps: red.ruleProps
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
	}

	if (red.binary) {
		var isTransposition = red.ruleProps.transposition

		for (var v = vertices.length; v-- > 0;) {
			var vertexZNodes = vertices[v].zNodes

			for (var z = vertexZNodes.length; z-- > 0;) {
				var zNode = vertexZNodes[z]
				var subNew

				if (isTransposition) { // Flip RHS for transposition
					subNew = {
						node: sub.node,
						size: zNode.node.size + sub.size,
						next: {
							node: zNode.node,
							size: zNode.node.size
						},
						ruleProps: red.ruleProps
					}
				} else {
					subNew = {
						node: zNode.node,
						size: zNode.node.size + sub.size,
						next: sub,
						ruleProps: red.ruleProps
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