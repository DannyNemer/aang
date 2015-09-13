var util = require('../util')
var semantic = require('../grammar/semantic')
var inputFile = require('../aang.json')
var entities = inputFile.entities
var intSymbols = inputFile.intSymbols
var deletables = inputFile.deletables


module.exports = Parser

function Parser(stateTable) {
	this.stateTable = stateTable

	// Use a search index for partial-matches of input to terminal symbols
	// this.matchTerminalRules = require('./util/matchTerminalRulesWithSearchIndex')(this)
}

/**
 * Checks if an n-gram from the input query is an entity. This is a simple, temporary entity resolution implementation that will be replaced by language models for each category and Elasticsearch for look up.
 *
 * @param {number} endPos The end index in the input query of `nGram`.
 * @param {string} nGram A token from the input query.
 */
Parser.prototype.entityLookup = function (endPos, nGram) {
	var entityInstances = entities[nGram]
	if (entityInstances) {
		for (var e = 0, entityInstancesLen = entityInstances.length; e < entityInstancesLen; ++e) {
			var entity = entityInstances[e]
			var wordSym = this.stateTable.symbolTab[entity.category]

			var entityId = entity.id
			var semanticArg = this.newSemanticArgs[entityId] || (this.newSemanticArgs[entityId] = [ { semantic: { name: entityId } } ])

			// Generate all nodes for rules that produce the terminal symbol
			this.createWords(wordSym, endPos, semanticArg, entity.text)
		}
	}
}

// If unigram is a number, match with rules with '<int>' term symbol, using unigram as semantic argument
Parser.prototype.intSymbolLookup = function (nGram) {
	// It is faster to parse the number from the string and compare it to the numeric min and max values than to compare the original string, though they have the same outcome.
	var parsedFloat = parseFloat(nGram)

	// Assuming the intSymbols are already sorted by increasing minimum value and then by increasing maximum value.
	for (var i = 0, intSymbolsLen = intSymbols.length; i < intSymbolsLen; ++i) {
		var intSymbol = intSymbols[i]

		// Integer symbols are sorted by increasing minimum value, so all following values are equal to or greater than this.
		if (parsedFloat < intSymbol.min) return

		if (parsedFloat <= intSymbol.max) {
			var wordSym = this.stateTable.symbolTab[intSymbol.name]

			// Create a new semantic argument using the integer. Reuse if it already exists (same integer used in multiple places in same query) so semantics can be found identical just by their object references (without needing to compare names).
			// Use string version of integer for the semantic.
			var semanticArg = this.newSemanticArgs[nGram] || (this.newSemanticArgs[nGram] = [ { semantic: { name: nGram } } ])

			// Generate all nodes for rules that produce the terminal symbol
			this.createWords(wordSym, this.position, semanticArg, nGram)
		}
	}
}

/**
 * Create nodes for terminal rules.
 *
 * @param {Object} wordSym The terminal symbol.
 * @param {number} endPos The end index of a terminal symbol in input.
 * @param {Array} [semanticArg] The semantic argument if the terminal symbol is a placeholder (i.e., the semantic created from an entity or integer in input).
 * @param {string} [text] The display text if the terminal symbol is a placeholder (i.e., entities and integers).
 */
Parser.prototype.createWords = function (wordSym, endPos, semanticArg, text) {
	// Create node with terminal symbol.
	var wordNode = this.addSub(wordSym)

	// Loop through all terminal rules that produce the terminal symbol.
	var wordNodes = []
	var wordSize = wordNode.size
	var rules = wordSym.rules

	for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
		var rule = rules[r]
		var sub = {
			// The number of lexical tokens in the terminal symbol.
			size: wordSize,
			node: wordNode,
			ruleProps: undefined,
			minCost: undefined,
		}

		// Recreate `ruleProps` if terminal symbol is a placeholder and special display text and creates a semantic argument from input.
		if (semanticArg) {
			var origRuleProps = rule.ruleProps
			sub.ruleProps = {
				cost: origRuleProps.cost,
				// Use the semantic argument created from input (e.g., an entity or integer).
				semantic: origRuleProps.semantic ? semantic.reduce(origRuleProps.semantic, semanticArg) : semanticArg,
				// Entities: use saved text with correct capitalization.
				// Integers: use string of number to avoid converting number to string later.
				text: text,
			}
		} else {
			sub.ruleProps = rule.ruleProps
		}

		// Create a node with LHS of terminal rule
		wordNodes.push(this.addSub(rule.RHS[0], sub)) // FIXME: rename prop - rule.RHS[0] is LHS for terms
	}

	// Save word to index of last lexical token
	var words = this.wordTab[endPos] || (this.wordTab[endPos] = [])
	words.push({
		start: this.position,
		nodes: wordNodes,
	})

	this.createDeletions(words, wordNode)
}

Parser.prototype.createDeletions = function (words, wordNode) {
	// Avoid as much as possible before knowing there are deletions
	var wordSize = wordNode.size
	var oldWordNodes = words[words.length - 1].nodes
	var oldWordNodesLen = oldWordNodes.length

	// Step backward checking for continuous spans of deletable tokens end at the start of this token
	for (var deletionLen = 1; this.deletionTokenIdxes[this.position - deletionLen]; ++deletionLen) {
		var wordNodes = []
		var startPos = this.position - deletionLen
		++wordSize

		// Create a new node for each terminal rule with a deletion cost penalty and the new token span
		for (var n = 0; n < oldWordNodesLen; ++n) {
			var oldNode = oldWordNodes[n]
			var oldRuleProps = oldNode.subs[0].ruleProps

			var sub = {
				// The number of lexical tokens spanned by this node.
				size: wordSize,
				node: wordNode,
				ruleProps: {
					// Add cost penalty of 1 per deleted token
					cost: oldRuleProps.cost + deletionLen,
					// Reuse previously created semantic arguments or semantic reductions
					semantic: oldRuleProps.semantic,
					// Reuse previously determined text (e.g., properly capitalized)
					text: oldRuleProps.text,
				},
				minCost: undefined,
			}

			// Add to nodeTab, because of the edge cases where the node can be reused:
					// X -> "not word" | "word" - both are X with size of 2
					// X -> 'x' | (Y -> 'x')
			var newNode = this.addSub(oldNode.sym, sub)
			newNode.start = startPos
			wordNodes.push(newNode)
		}

		// Add new nodes at same `endPos` (the index of `words` in `this.wordTab`)
		words.push({
			start: startPos,
			nodes: wordNodes,
		})
	}
}

/**
 * Tokenizes the input query and look for terminal symbol matches using n-gram analysis.
 *
 * @param {string} query The input query.
 * @returns {Array} Returns the array of matches for each index of `query`.
 */
Parser.prototype.matchTerminalRules = function (query) {
	var tokens = query.toLowerCase().split(/\s+/)
	this.tokensLen = tokens.length
	this.wordTab = []

	// Deletable token indexes, each with a cost of 1
	this.deletionTokenIdxes = []

	// Create semantic arguments for input matches to '<int>'
	// Prevent making duplicate semantic arguments to detect duplicity by Object reference (not semantic name)
	this.newSemanticArgs = {}

	for (; this.position < this.tokensLen; ++this.position) {
		var nGram = tokens[this.position]
		this.nodeTab = this.nodeTabs[this.position] = []

		if (isNaN(nGram)) {
			// Check every possible n-gram for multi-word terminal symbols
			var endPos = this.position

			// Mark index as deletable if lexical token is deletable
			// Could be faster because `deletables` is alphabetically sorted, but elasticsearch will take care of that
			if (deletables.indexOf(nGram) !== -1) {
				this.deletionTokenIdxes[endPos] = true
			}

			while (true) {
				this.entityLookup(endPos, nGram)

				var wordSym = this.stateTable.symbolTab[nGram]
				// Prevent terminal symbol match with placeholder symbols: <int>, entities category names (e.g., {user})
				if (wordSym && !wordSym.isPlaceholder) {
					// No `makeRuleProps` to avoid unnecessarily duplicating `ruleProps`
					this.createWords(wordSym, endPos)
				}

				if (++endPos === this.tokensLen) break

				nGram += ' ' + tokens[endPos]
			}
		}

		// If unigram is a number, match with rules with integer terminal symbol placeholders, using the unigram as the semantic argument.
		else {
			this.intSymbolLookup(nGram)
		}
	}

	// Reset token scan position.
	this.position = 0

	return this.wordTab
}

/**
 * Parses and constructs a parse forest for an input query using the state table generated for the grammar.
 *
 * @param {string} query The input query to parse.
 * @returns {Object} Returns the start node of the parse forest if the parse succeeds, else `null`.
 */
Parser.prototype.parse = function (query) {
	this.nodeTabs = []
	this.position = 0
	// var wordTab = this.lunr(query)
	// An array of arrays of matched terms, sorted where the matched term is at the wordTab index of its end idx
	var wordTab = this.matchTerminalRules(query)

	this.reds = []
	var redsIdx = 0

	this.vertTabs = []
	this.vertTab = this.vertTabs[this.position] = []
	this.addVertex(this.stateTable.states[0])

	while (true) {
		// Terminal symbol matches who span ends at this index
		var words = wordTab[this.position]

		if (!words) {
			// Scanned entire input
			if (this.position === this.tokensLen) break

			// No token at index - either unrecognized word, or a multi-token terminal symbol
			// This array will not be used, but creating and checking its length (which occurs anyway) is faster than always checking for if array exists
			this.vertTabs[++this.position] = []
			continue
		}

		this.nodeTab = this.nodeTabs[this.position]
		this.vertTab = this.vertTabs[++this.position] = []

		for (var w = 0, wordsLen = words.length; w < wordsLen; ++w) {
			var word = words[w]
			// The previous vertices at the start of this terminal symbol's span
			var oldVertTab = this.vertTabs[word.start]
			var oldVertTabLen = oldVertTab.length

			// Loop through all terminal rules that produce the terminal symbol
			var nodes = word.nodes
			for (var n = 0, nodesLen = nodes.length; n < nodesLen; ++n) {
				var node = nodes[n]

				for (var v = 0; v < oldVertTabLen; ++v) {
					this.addNode(node, oldVertTab[v])
				}
			}
		}

		// REDUCE
		while (redsIdx < this.reds.length) {
			var red = this.reds[redsIdx++]
			var zNode = red.zNode
			var reds = red.reds
			for (var r = 0, redsLens = reds.length; r < redsLens; ++r) {
				this.reduce(zNode, reds[r])
			}
		}
	}

	// ACCEPT
	// Find the start node; otherwise the parse failed
	// Tests show 1.9x more likely to find the start node faster by iterating backward
	for (var v = this.vertTab.length - 1; v > -1; --v) {
		var vertex = this.vertTab[v]
		if (vertex.state.isFinal) {
			// Only one zNode because only the start node can point to the vertex for the accept state
			return vertex.zNodes[0].node
		}
	}

	return null
}

/**
 * Adds a new subnode.
 *
 * @param {Object} sym The new symbol.
 * @param {Object} [sub] The subnode (i.e., RHS) which is produced by `sym`. Does not exist if `sym` is a terminal symbol.
 * @return {Object} The node to which `sub` was added to.
 */
Parser.prototype.addSub = function (sym, sub) {
	var size = sub ? sub.size : sym.size // no sub -> terminal symbol
	var node

	// Tests show 1.25x more likely to find the node faster by iterating backward
	for (var n = this.nodeTab.length - 1; n > -1; --n) {
		node = this.nodeTab[n]
		if (node.sym === sym && node.size === size) break
	}

	// Create a new node
	if (n === -1) {
		node = {
			// The LHS of `sub`
			sym: sym,
			// The number of lexical tokens spanned by this node.
			size: size,
			// The token index of input at which this node's span begin; only used for debugging
			start: undefined,
			// The child nodes produces by this node's rules (i.e., the RHS)
			subs: undefined,
		}

		// Nonterminal
		if (sub) {
			// Only used for debugging
			if (sub.ruleProps.isTransposition) {
				node.start = sub.next.node.start
			} else {
				node.start = sub.node.start
			}

			node.subs = [ sub ]
		} else {
			node.start = this.position
		}

		// Save the new node
		this.nodeTab.push(node)
	}

	// Existing nonterminal
	// Add subnode if does not exist
	else if (sub && subIsNew(node.subs, sub)) {
		node.subs.push(sub)
	}

	return node
}

/**
 * Checks if `newSub` already exists in `existingSubs`.
 *
 * @param {Array} existingSubs The subnodes of the parent node.
 * @param {Object} newSub The new subnode.
 * @returns {boolean} Returns `true` if `newSub` already exists, else `falas`.
 */
function subIsNew(existingSubs, newSub) {
	var newSubNext = newSub.next

	// Tests show 1.15x more likely to find the subnode faster by iterating backward
	for (var s = existingSubs.length - 1; s > -1; --s) {
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

/**
 * Creates a vertex for a new state if no vertex exists; otherwise return the existing vertex.
 *
 * @param {Object} state The new state.
 * @returns {Object} Returns a new vertex if no vertex for `state` exists, else the existing vertex for `state`.
 */
Parser.prototype.addVertex = function (state) {
	// Tests show 3x more likely to find the vertex faster by iterating backward
	for (var v = this.vertTab.length - 1; v > -1; --v) {
		var vertex = this.vertTab[v]
		if (vertex.state === state) return vertex
	}

	var vertex = {
		// State in stateTable with reds + shifts
		state: state,
		// Index in input string tokens array; only used for debugging
		start: this.position,
		// zNodes that point to this vertex
		zNodes: [],
	}

	this.vertTab.push(vertex)

	return vertex
}

/**
 * Gets the next state from the state table.
 *
 * @param {Object} state The previous state.
 * @param {Object} sym The symbol to check.
 * @returns {Object} Returns the next state.
 */
Parser.prototype.nextState = function (state, sym) {
	var stateShifts = state.shifts

	// Tests show 1.25x more likely to find the state faster by iterating forward. Should be checked if StateTable sorting or grammar changes.
	for (var s = 0, stateShiftsLen = stateShifts.length; s < stateShiftsLen; ++s) {
		var shift = stateShifts[s]
		if (shift.sym === sym) {
			// Tests show it is >2x faster to get the state directly using its index rather than saving a pointer to the state.
			return this.stateTable.states[shift.stateIdx]
		}
	}
}

/**
 * Adds a new node.
 *
 * @param {Object} node The new node.
 * @param {Objkect} oldVertex The vertex which points to the new node (i.e., the previous state).
 */
Parser.prototype.addNode = function (node, oldVertex) {
	var state = this.nextState(oldVertex.state, node.sym)
	if (!state) return

	var vertex = this.addVertex(state)
	var vertexZNodes = vertex.zNodes
	var zNode // holds a node and vertices that point to that node

	// Tests show 1.5x more likely to find the zNode faster by iterating backward
	for (var v = vertexZNodes.length - 1; v > -1; --v) {
		zNode = vertexZNodes[v]
		if (zNode.node === node) break
	}

	if (v === -1) {
		// vertices are those which lead to this zNode
		zNode = { node: node, vertices: [ oldVertex ] }
		vertexZNodes.push(zNode)

		this.reds.push({
			zNode: zNode,
			reds: state.reds
		})
	}

	else if (zNode.vertices.indexOf(oldVertex) === -1) {
		zNode.vertices.push(oldVertex)
	}
}

/**
 * Reduces a node using reductions.
 *
 * @param {Object} redZNode The zNode from which to build subnodes using the reductions.
 * @param {Object} red The reduction to execute on `redZNode`.
 */
Parser.prototype.reduce = function (redZNode, red) {
	var vertices = redZNode.vertices
	var sub = {
		node: redZNode.node,
		size: redZNode.node.size,
		minCost: undefined,
		ruleProps: undefined,
	}

	if (red.isBinary) {
		var isTransposition = red.ruleProps.isTransposition

		for (var v = 0, verticesLen = vertices.length; v < verticesLen; ++v) {
			var vertexZNodes = vertices[v].zNodes

			for (var z = 0, vertexZNodesLen = vertexZNodes.length; z < vertexZNodesLen; ++z) {
				var zNode = vertexZNodes[z]
				var zNodeNode = zNode.node
				var subNew

				// Flip RHS for transposition
				if (isTransposition) {
					subNew = {
						node: sub.node,
						size: zNodeNode.size + sub.size,
						next: {
							node: zNodeNode,
							size: zNodeNode.size,
						},
						ruleProps: red.ruleProps,
						minCost: undefined,
					}
				} else {
					subNew = {
						node: zNodeNode,
						size: zNodeNode.size + sub.size,
						next: sub,
						ruleProps: red.ruleProps,
						minCost: undefined,
					}
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
	if (node.sym.isTerminal) {
		return ' \"' + node.sym.name + '\"'
	} else {
		return ' ' + node.sym.name + '_' + node.start + '_' + (node.start + node.size)
	}
}

Parser.prototype.printForest = function (startNode) {
	util.log("\nParse Forest:")

	if (startNode) {
		util.log('*' + printNode(startNode) + '.')
	}

	this.nodeTabs.forEach(function (nodeTab) {
		nodeTab.forEach(function (node) {
			if (node.sym.isTerminal) return

			var toPrint = printNode(node)

			if (node.subs.length > 0) {
				if (node.subs[0].node.sym.isTerminal) toPrint += ':'
				else toPrint += ' ='
			}

			node.subs.forEach(function (sub, S) {
				if (S > 0) toPrint += ' |'
				for (; sub; sub = sub.next)
					toPrint += printNode(sub.node)
			})

			util.log(toPrint + '.');
		})
	})
}

Parser.prototype.printStack = function () {
	var states = this.stateTable.states

	util.log("\nParse Stack:")

	this.vertTabs.forEach(function (vertTab) {
		vertTab.forEach(function (vertex) {
			var toPrint = ' v_' + vertex.start + '_' + states.indexOf(vertex.state)

			if (vertex.zNodes.length > 0) toPrint += ' <=\t'
			else util.log(toPrint)

			vertex.zNodes.forEach(function (zNode, Z) {
				if (Z > 0) toPrint += '\t\t'

				toPrint += ' [' + printNode(zNode.node) + ' ] <='

				zNode.vertices.forEach(function (subVertex) {
					toPrint += ' v_' + subVertex.start + '_' + states.indexOf(subVertex.state)
				})

				if (Z === vertex.zNodes.length - 1) util.log(toPrint)
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
		util.dir(newNode) // Start node
	}
}