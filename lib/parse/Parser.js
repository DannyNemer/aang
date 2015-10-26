var util = require('../util/util')
var semantic = require('../grammar/semantic')
var grammar = require('../grammar.json')
var entities = grammar.entities
var intSymbols = grammar.intSymbols
var deletables = grammar.deletables


/**
 * The `Parser` constructor.
 *
 * @constructor
 * @param {StateTable} stateTable The `StateTable` instance generated from the grammar.
 */
function Parser(stateTable) {
	this.stateTable = stateTable
}

/**
 * Checks if an n-gram from the input query is an entity. This is a simple, temporary entity resolution implementation that will be replaced by language models for each category and Elasticsearch for look up.
 *
 * @memberOf Parser
 * @param {number} endPos The end index in the input query of `nGram`.
 * @param {string} nGram A token from the input query.
 */
Parser.prototype.entityLookup = function (endPos, nGram) {
	var entityInstances = entities[nGram]
	if (entityInstances) {
		for (var e = 0, entityInstancesLen = entityInstances.length; e < entityInstancesLen; ++e) {
			var entity = entityInstances[e]
			var terminalSym = this.stateTable.symbolTab[entity.category]

			var entityId = entity.id
			var semanticArg = this.newSemanticArgs[entityId] || (this.newSemanticArgs[entityId] = [ { semantic: { name: entityId } } ])

			// Generate all nodes for rules that produce the terminal symbol.
			this.createWords(terminalSym, endPos, semanticArg, entity.text)
		}
	}
}

/**
 * Finds the integer symbols for which `unigramNum` is within range, and creates nodes for those rules with `unigramNum` as a semantic argument.
 *
 * @memberOf Parser
 * @param {string} unigramNum A token of an integer from input.
 */
Parser.prototype.intSymbolLookup = function (unigramNum) {
	// It is faster to parse the number from the string and compare it to the numeric min and max values than to compare the original string, though they have the same outcome.
	var parsedFloat = parseFloat(unigramNum)

	// Assuming `intSymbols` is already sorted by increasing minimum value and then by increasing maximum value.
	for (var i = 0, intSymbolsLen = intSymbols.length; i < intSymbolsLen; ++i) {
		var intSymbol = intSymbols[i]

		// Integer symbols are sorted by increasing minimum value, so all following values are equal to or greater than this.
		if (parsedFloat < intSymbol.min) return

		if (parsedFloat <= intSymbol.max) {
			var terminalSym = this.stateTable.symbolTab[intSymbol.name]

			// Create a new semantic argument using the integer. Reuse if it already exists (same integer used in multiple places in same query) so semantics can be found identical just by their object references (without needing to compare names).
			// Use string version of integer for the semantic.
			var semanticArg = this.newSemanticArgs[unigramNum] || (this.newSemanticArgs[unigramNum] = [ { semantic: { name: unigramNum } } ])

			// Generate all nodes for rules that produce the terminal symbol
			this.createWords(terminalSym, this.position, semanticArg, unigramNum)
		}
	}
}

/**
 * Create nodes for terminal rules.
 *
 * @memberOf Parser
 * @param {Object} terminalSym The terminal symbol.
 * @param {number} endPos The end index of a terminal symbol in input.
 * @param {Object[]} [semanticArg] The semantic argument if the terminal symbol is a placeholder (i.e., the semantic created from an entity or integer in input).
 * @param {string} [text] The display text if the terminal symbol is a placeholder (i.e., entities and integers).
 */
Parser.prototype.createWords = function (terminalSym, endPos, semanticArg, text) {
	// Add nodes to the input index of the terminal symbol's last lexical token.
	this.nodeTab = this.nodeTabs[endPos]

	// Create node for terminal symbol. Do not use `this.nodeTab`, because every node must be unique. If the two terminal nodes use the same terminal symbol, then the symbol is an entity category, however those entities are different and must be separate to produce separate parse trees.
	var terminalNode = {
		sym: terminalSym,
		// Compute size for every terminal symbol, because it varies for entities of the same entity category and terminal symbols built from regular expressions.
		size: endPos - this.position + 1,
		start: this.position,
	}

	// Loop through all terminal rules that produce the terminal symbol.
	var wordNodes = []
	var wordSize = terminalNode.size
	var rules = terminalSym.rules

	// Create a node for each terminal rule producing `terminalSym`.
	for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
		var rule = rules[r]
		var sub = {
			node: terminalNode,
			// The number of lexical tokens in the terminal symbol.
			size: wordSize,
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

		// Create a node with LHS of terminal rule.
		wordNodes.push(this.addSub(rule.RHS[0], sub))
	}

	// Save word to the input query index of its last lexical token.
	var words = this.wordTab[endPos] || (this.wordTab[endPos] = [])
	words.push({
		start: this.position,
		nodes: wordNodes,
	})

	this.createDeletions(terminalNode, wordNodes, words)
}

/**
 * Searches input for deletables, and creates new nodes for existing nodes that follow the deletables, with a span overlapping the deletables and cost penalty.
 *
 * @param {Object} terminalNode The node of a terminal symbol.
 * @param {Object[]} oldWordNodes Nodes for the LHS of terminal rules producing `terminalNode`
 * @param {Object[]} words Sets of nodes for the LHS of terminal rules at the current input position.
 */
Parser.prototype.createDeletions = function (terminalNode, oldWordNodes, words) {
	var wordSize = terminalNode.size
	var oldWordNodesLen = oldWordNodes.length

	// Step backward checking for continuous spans of deletable tokens end at the start of this token.
	for (var deletionLen = 1; this.deletionTokenIndxes[this.position - deletionLen]; ++deletionLen) {
		var wordNodes = []
		var startPos = this.position - deletionLen
		++wordSize

		// For each terminal rule, create a new node with a deletion cost penalty and the new token span.
		for (var n = 0; n < oldWordNodesLen; ++n) {
			var oldNode = oldWordNodes[n]
			var oldRuleProps = oldNode.subs[0].ruleProps

			var sub = {
				node: terminalNode,
				// The number of lexical tokens spanned by this node.
				size: wordSize,
				ruleProps: {
					// Add cost penalty of 1 per deleted token.
					cost: oldRuleProps.cost + deletionLen,
					// Reuse previously created semantic arguments or semantic reductions.
					semantic: oldRuleProps.semantic,
					// Reuse previously determined text (e.g., properly capitalized).
					text: oldRuleProps.text,
				},
				minCost: undefined,
			}

			var newNode = this.addSub(oldNode.sym, sub)
			newNode.start = startPos
			wordNodes.push(newNode)
		}

		// Add new nodes at same `endPos` (the index of `words` in `this.wordTab`).
		words.push({
			start: startPos,
			nodes: wordNodes,
		})
	}
}

/**
 * Tokenizes the input query and look for terminal symbol matches using n-gram analysis.
 *
 * @memberOf Parser
 * @param {string} query The input query.
 * @returns {Object[][]} Returns the array of matches for each index of `query`.
 */
Parser.prototype.matchTerminalRules = function (query) {
	var tokens = query.toLowerCase().split(/\s+/)
	this.tokensLen = tokens.length
	this.wordTab = []

	// Deletable token indexes, each with a cost of 1.
	this.deletionTokenIndxes = []

	// Prevent making duplicate semantic arguments to detect duplicity by `Object` reference (not semantic name).
	this.newSemanticArgs = {}

	// Initialize a nodes array for each input token index.
	for (var i = this.position; i < this.tokensLen; ++i) {
		this.nodeTabs[i] = []
	}

	// Lookup every n-gram input the input query.
	for (; this.position < this.tokensLen; ++this.position) {
		var nGram = tokens[this.position]

		if (isNaN(nGram)) {
			// Check every possible n-gram for multi-word terminal symbols.
			var endPos = this.position

			// Mark index as deletable if lexical token is deletable.
			if (deletables.indexOf(nGram) !== -1) {
				this.deletionTokenIndxes[endPos] = true
			}

			// Lookup every query segment from `this.position` to the end of the input query.
			while (true) {
				this.entityLookup(endPos, nGram)

				var terminalSym = this.stateTable.symbolTab[nGram]

				// Prevent terminal symbol match with placeholder symbols; e.g., entities category names (e.g., {user}).
				if (terminalSym && !terminalSym.isPlaceholder) {
					this.createWords(terminalSym, endPos)
				}

				// Stop at end of input query.
				if (++endPos === this.tokensLen) break

				nGram += ' ' + tokens[endPos]
			}
		}

		else {
			// If unigram is a number, match with rules with integer terminal symbol placeholders, using the unigram as the semantic argument.
			this.intSymbolLookup(nGram)
		}
	}

	return this.wordTab
}

/**
 * Parses and constructs a parse forest for an input query using the state table generated for the grammar.
 *
 * @memberOf Parser
 * @param {string} query The input query to parse.
 * @returns {Object} Returns the start node of the parse forest if the parse succeeds, else `null`.
 */
Parser.prototype.parse = function (query) {
	this.nodeTabs = []
	this.position = 0

	// An array of arrays of matched terms, sorted where the matched term is at the wordTab index of its end index.
	var wordTab = this.matchTerminalRules(query)
	// Reset input query index.
	this.position = 0

	this.reds = []
	var redsIdx = 0

	this.vertTabs = []
	this.vertTab = this.vertTabs[this.position] = []
	this.addVertex(this.stateTable.states[0])

	while (true) {
		// Terminal symbol matches who span ends at this index.
		var words = wordTab[this.position]

		if (!words) {
			// Scanned entire input
			if (this.position === this.tokensLen) break

			// No token at index - either unrecognized word, or a multi-token terminal symbol.
			// This array will not be used, but creating and checking its length (which occurs anyway) is faster than always checking for if array exists.
			this.vertTabs[++this.position] = []
			continue
		}

		this.nodeTab = this.nodeTabs[this.position]
		this.vertTab = this.vertTabs[++this.position] = []

		for (var w = 0, wordsLen = words.length; w < wordsLen; ++w) {
			var word = words[w]
			// The previous vertices at the start of this terminal symbol's span.
			var oldVertTab = this.vertTabs[word.start]
			var oldVertTabLen = oldVertTab.length

			// Loop through all terminal rules that produce the terminal symbol.
			var nodes = word.nodes
			for (var n = 0, nodesLen = nodes.length; n < nodesLen; ++n) {
				var node = nodes[n]

				for (var v = 0; v < oldVertTabLen; ++v) {
					this.addNode(node, oldVertTab[v])
				}
			}
		}

		// Reduce.
		while (redsIdx < this.reds.length) {
			var red = this.reds[redsIdx++]
			var zNode = red.zNode
			var reds = red.reds
			for (var r = 0, redsLens = reds.length; r < redsLens; ++r) {
				this.reduce(zNode, reds[r])
			}
		}
	}

	// Find the start node at the accepting state; otherwise the parse failed.
	// Tests show 1.9x more likely to find the start node faster by iterating backward.
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
 * Gets the node for `nontermSym` if it exists, else creates a new node. Then adds `sub` to that node if it is unique.
 *
 * @memberOf Parser
 * @param {Object} nontermSym The new nonterminal symbol.
 * @param {Object} sub The subnode (i.e., RHS) produced by `nontermSym`.
 * @return {Object} The node to which `sub` was added to.
 */
Parser.prototype.addSub = function (nontermSym, sub) {
	var size = sub.size

	// Get the node of `nontermSym` if it exists.
	// Tests show 1.25x more likely to find the node faster by iterating backward.
	for (var n = this.nodeTab.length - 1; n > -1; --n) {
		var node = this.nodeTab[n]

		if (node.sym === nontermSym && node.size === size) {
			// Add `sub` to the existing node's subnodes if unique.
			if (subIsNew(node.subs, sub)) {
				node.subs.push(sub)
			}

			return node
		}
	}

	// Create a new node.
	var node = {
		// The LHS of `sub`.
		sym: nontermSym,
		// The number of lexical tokens spanned by this node.
		size: size,
		// The token index of input at which this node's span begin. This is only used for debugging.
		start: sub.ruleProps.isTransposition ? sub.next.node.start : sub.node.start,
		// The child nodes produces by this node's rules (i.e., the RHS).
		subs: [ sub ],
	}

	// Save the new node.
	this.nodeTab.push(node)

	return node
}

/**
 * Checks if `newSub` already exists in `existingSubs`.
 *
 * @static
 * @param {Object[]} existingSubs The subnodes of the parent node.
 * @param {Object} newSub The new subnode.
 * @returns {boolean} Returns `true` if `newSub` already exists, else `falas`.
 */
function subIsNew(existingSubs, newSub) {
	var newSubNext = newSub.next

	// Tests show 1.15x more likely to find the subnode faster by iterating backward.
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

		// Subnode exists.
		return false
	}

	return true
}

/**
 * Gets the vertex for `state` if it exists, else creates a new vertex.
 *
 * @memberOf Parser
 * @param {Object} state The new state.
 * @returns {Object} Returns a new vertex if no vertex for `state` exists, else the existing vertex for `state`.
 */
Parser.prototype.addVertex = function (state) {
	// Gets the vertex for `state` if it exists.
	// Tests show 3x more likely to find the vertex faster by iterating backward.
	for (var v = this.vertTab.length - 1; v > -1; --v) {
		var vertex = this.vertTab[v]
		if (vertex.state === state) return vertex
	}

	// Create a new vertex for `state`.
	var vertex = {
		// The state in `stateTable` with reds and shifts.
		state: state,
		// The index within the input string tokens array. This is only used for debugging.
		start: this.position,
		// The zNodes that point to this vertex.
		zNodes: [],
	}

	this.vertTab.push(vertex)

	return vertex
}

/**
 * Gets the next state table state that follows `state` for `sym`, if it exists.
 *
 * @memberOf Parser
 * @param {Object} state The previous state.
 * @param {Object} sym The symbol to shift to.
 * @returns {Object|undefined} Returns the next state if it exists, else `undefined`.
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
 * Gets the next state for `node.sym` that follows `oldVertex.state`. Then, gets the vertex for that state if it exists, else creates a new vertex. Then, gets that vertex's zNode for `node` if it exists, else creates a new zNode. Then, adds `oldVertex` to that zNode if it is unique.
 *
 * @memberOf Parser
 * @param {Object} node The new node.
 * @param {Object} oldVertex The vertex which points to the new node (i.e., the previous state).
 */
Parser.prototype.addNode = function (node, oldVertex) {
	// Get the state, if any, of when the symbol in `node` follows the state in `oldVertex`.
	var state = this.nextState(oldVertex.state, node.sym)
	if (!state) return

	// Get the vertex for `state` if it exists, else creates a new vertex
	var vertex = this.addVertex(state)
	// The zNodes that point to `vertex`.
	var vertexZNodes = vertex.zNodes

	// Get the zNode for `node` that points to `vertex`.
	// Tests show 1.5x more likely to find the zNode faster by iterating backward.
	for (var v = vertexZNodes.length - 1; v > -1; --v) {
		var zNode = vertexZNodes[v]

		if (zNode.node === node) {
			// Add `oldVertex` to the existing zNode's vertices if unique.
			if (zNode.vertices.indexOf(oldVertex) === -1) {
				// `oldVertex` points to `zNode`.
				zNode.vertices.push(oldVertex)
			}

			// Stop after finding existing zNode.
			return
		}
	}

	// Create a new zNode for `node` that points to `vertex`.
	// `oldVertex` points to `zNode`.
	var zNode = { node: node, vertices: [ oldVertex ] }
	vertexZNodes.push(zNode)

	// Save reductions for this `node` and its next state.
	this.reds.push({
		zNode: zNode,
		reds: state.reds
	})
}

/**
 * Reduces a node using `red`.
 *
 * @memberOf Parser
 * @param {Object} redZNode The zNode from which to build subnodes using `red`.
 * @param {Object} red The reduction to execute on `redZNode`.
 */
Parser.prototype.reduce = function (redZNode, red) {
	var vertices = redZNode.vertices
	var sub = {
		node: redZNode.node,
		size: redZNode.node.size,
		ruleProps: undefined,
		minCost: undefined,
	}

	if (red.isBinary) {
		var isTransposition = red.ruleProps.isTransposition

		for (var v = 0, verticesLen = vertices.length; v < verticesLen; ++v) {
			var vertexZNodes = vertices[v].zNodes

			for (var z = 0, vertexZNodesLen = vertexZNodes.length; z < vertexZNodesLen; ++z) {
				var zNode = vertexZNodes[z]
				var zNodeNode = zNode.node
				var subNew

				// Swap RHS symbols for transposition.
				if (isTransposition) {
					subNew = {
						node: sub.node,
						size: zNodeNode.size + sub.size,
						next: {
							node: zNodeNode,
							size: zNodeNode.size,
							minCost: undefined,
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


/**
 * Constructs a string representation of `node`.
 *
 * Terminal symbols are constructed as follows:
 *   '<literal>'
 *
 * Nonterminal symbols are constructed as follows:
 *   [symbol]_M_N
 * where M and N are the start and end positions, respectively, of the span of [symbol] in the input.
 *
 * @private
 * @static
 * @param {Object} node The node of which to construct a string representation.
 * @returns {string} Returns the string representation of `node`.
 */
function stringifyNode(node) {
	if (node.sym.isTerminal) {
		return util.stylize(node.sym.name)
	} else {
		return node.sym.name + '_' + node.start + '_' + (node.start + node.size)
	}
}

/**
 * Prints the parse forest of the last parse.
 *
 * This forest is listed in equational form as a grammar which even can be constructed into a `StateTable` used by `Parser` This grammar is characterized as the largest sub-grammar of the input grammar that generates the one element set { the input }.
 *
 * This illustrates that the parsing algorithm also computes the intersection of a context free grammar with a regular grammar.
 *
 * @memberOf Parser
 * @param {Object} startNode The start node output by the last call to `Parser.prototype.parse()`.
 */
Parser.prototype.printForest = function (startNode) {
	util.log(util.colors.bold('\nParse Forest:'))

	if (startNode) {
		util.log(stringifyNode(startNode))
	}

	this.nodeTabs.forEach(function (nodeTab) {
		nodeTab.forEach(function (node) {
			if (!node.sym.isTerminal) {
				var toPrint = stringifyNode(node) + ' ='

				node.subs.forEach(function (sub, s) {
					if (s > 0) {
						toPrint += '  | '
					}

					do {
						toPrint += ' ' + stringifyNode(sub.node)
					} while (sub = sub.next)
				})

				util.log(toPrint)
			}
		})
	})
}

/**
 * Prints the parsing stack of the last parse.
 *
 * The stack a graph consisting of nodes labeled v_N_S, with edges labeled by nodes of the form [ SYM_M_N ]. All connections are of the form:
 *   v_N_T <= [ SYM_M_N ] <= v_M_S1  v_M_S2 ...
 *
 * The following properties will always hold:
 *   1. SHIFT(S1, X) = SHIFT(S2, X) = ... = T
 *   2. M <= N
 *
 * The labels are defined as follows:
 *   v_N_S: N = the parsing position in the input
 *          S = the parsing state number
 *   SYM_M_N: SYM = the name of the nonterminal symbol
 *            M, N = the start and end positions of the span of SYM in the input
 *
 * @memberOf Parser
 * @example
 *
 * If the input is labeled as follows:
 *   0   1   2   3   4    5
 *    the boy saw the girl
 * then the edge:
 *   v_5_11 <= [ NP_3_5 ] <= v_3_7
 * indicates that the parser went from state 7 at position 3 to state 11 at position 5 by shifting a symbol named "NP", which spans the tokens "the girl".
 */
Parser.prototype.printStack = function () {
	var states = this.stateTable.states

	util.log(util.colors.bold('\nParse Stack:'))

	this.vertTabs.forEach(function (vertTab) {
		vertTab.forEach(function (vertex) {
			util.log(util.colors.yellow(vertex.start + '_' + states.indexOf(vertex.state)))

			vertex.zNodes.forEach(function (zNode, z) {
				util.log('  <= [' + stringifyNode(zNode.node) + ' ]')

				zNode.vertices.forEach(function (subVertex) {
					var zNodesStr = subVertex.zNodes.map(function (z) { return z.node.sym.name }).toString() || 'ACCEPT'
					util.log('     <= v_' + subVertex.start + '_' + states.indexOf(subVertex.state) + ' ' + zNodesStr)
				})
			})
		})
	})
}

/**
 * Prints a graph representation of a parse forest output by `Parser.prototype.parse()`, starting at `startNode`. Most often, this will be too large to print.
 *
 * @static
 * @memberOf Parser
 * @param {Object} startNode The root of the parse forest.
 */
Parser.prototype.printNodeGraph = function (startNode) {
	var startNode = {
		symbol: startNode.sym.name,
		subs: startNode.subs,
	}

	var stack = [ startNode ]

	while (stack.length > 0) {
		var node = stack.pop()

		if (node.subs) {
			node.subs = node.subs.map(function (sub) {
				var children = []

				do {
					var subNode = sub.node

					var childNode = {
						symbol: subNode.sym.name,
						ruleProps: sub.ruleProps,
						subs: subNode.subs,
					}

					children.push(childNode)
					stack.push(childNode)
				} while (sub = sub.next)

				return children
			})
		}
	}

	util.dir(startNode)
}

// Export Parser.
module.exports = Parser