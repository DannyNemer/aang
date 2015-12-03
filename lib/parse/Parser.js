var util = require('../util/util')

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
 * Parses and constructs a parse forest for an input query using the state table generated for the grammar.
 *
 * @memberOf Parser
 * @param {string} query The input query to parse.
 * @returns {Object} Returns the start node of the parse forest if the parse succeeds, else `null`.
 */
Parser.prototype.parse = function (query) {
	this.nodeTabs = []

	// An array of arrays of matched terms, sorted where the matched term is at the wordTab index of its end index.
	var wordTab = this.matchTerminalRules(query)

	// The current input token index.
	this.position = 0

	this.reds = []
	var redsIdx = 0

	this.vertTabs = []
	this.vertTab = this.vertTabs[this.position] = []
	this.addVertex(this.stateTable.states[0])

	while (true) {
		// Terminal symbol matches whose span ends at this index.
		var words = wordTab[this.position]

		if (!words) {
			// Stop if scanned entire input and the inserted `<blank>` symbol.
			if (this.position > this.tokensLen) break

			// No token at index - either unrecognized word, or a multi-token terminal symbol.
			// This array will not be used, but creating and checking its length (which occurs anyway) is faster than always checking for if array exists.
			this.vertTabs[++this.position] = []

			continue
		}

		// Use a separate `nodeTab` for each token index, but share the same `nodeTab` for the last lexical token and the `<blank>` symbol which follows it. This allows the new nodes for insertions that use `<blank>` to merge with the trees that do not and would otherwise have a different span (i.e., size). It also enables multiple instances of insertions that use `<blank>` within a single tree.
		if (this.position < this.tokensLen) {
			this.nodeTab = this.nodeTabs[this.position]
		}

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
			var redObj = this.reds[redsIdx++]
			var zNode = redObj.zNode
			var reds = redObj.reds
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
			// Only one zNode because only the start node can point to the vertex for the accept state.
			return vertex.zNodes[0].node
		}
	}

	// When no start symbol is found in the last `vertTab` (above), which is for the inserted `<blank>` symbol, then there were no successful reductions (for insertions) that included `<blank>`. This prevented the nodes in the final lexical token index from being brought over to the final `vertTab`. Hence, search the `vertTab` for the final lexical token index.
	var vertTab = this.vertTabs[this.vertTabs.length - 2]
	for (var v = vertTab.length - 1; v > -1; --v) {
		var vertex = vertTab[v]
		if (vertex.state.isFinal) {
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
	var lastIdx = this.nodeTab.length - 1
	for (var n = lastIdx; n > -1; --n) {
		var node = this.nodeTab[n]

		if (node.sym === nontermSym && node.size === size) {
			// Sort by LRU.
			if (n !== lastIdx) {
				this.nodeTab[n] = this.nodeTab[lastIdx]
				this.nodeTab[lastIdx] = node
			}

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
 * @returns {boolean} Returns `true` if `newSub` already exists, else `false`.
 */
function subIsNew(existingSubs, newSub) {
	var newSubNext = newSub.next

	// Tests show 1.15x more likely to find the subnode faster by iterating backward.
	for (var s = existingSubs.length - 1; s > -1; --s) {
		var oldSub = existingSubs[s]

		if (oldSub.node !== newSub.node || oldSub.size !== newSub.size) {
			continue
		}

		var oldSubNext = oldSub.next
		if (newSubNext && oldSubNext) {
			if (oldSubNext.node !== newSubNext.node || oldSubNext.size !== newSubNext.size) {
				continue
			}
		} else if (newSubNext || oldSubNext) {
			// This only occurs for the `<blank>` symbol, which has a size of zero and can produce a binary reduction for a node with the same size as a non-binary reduction for the same node.
			continue
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
	// Get the vertex for `state` if it exists.
	var lastIdx = this.vertTab.length - 1
	for (var v = lastIdx; v > -1; --v) {
		var vertex = this.vertTab[v]

		if (vertex.state === state) {
			// Sort by LRU.
			if (v !== lastIdx) {
				this.vertTab[v] = this.vertTab[lastIdx]
				this.vertTab[lastIdx] = vertex
			}

			return vertex
		}
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
 * Gets the next state for `node.sym` that follows `oldVertex.state`. Then, gets the vertex for that state if it exists, else creates a new vertex. Then, gets that vertex's zNode for `node` if it exists, else creates a new zNode. Then, adds `oldVertex` to that zNode if it is unique.
 *
 * @memberOf Parser
 * @param {Object} node The new node.
 * @param {Object} oldVertex The vertex which points to the new node (i.e., the previous state).
 */
Parser.prototype.addNode = function (node, oldVertex) {
	// Get the next state that follows `oldVertex.state` for `node.sym`, if any.
	var state = oldVertex.state.shifts[node.sym.index]
	if (!state) return

	// Get the vertex for `state` if it exists, else creates a new vertex.
	var vertex = this.addVertex(state)
	// The zNodes that point to `vertex`.
	var vertexZNodes = vertex.zNodes

	// Get the zNode for `node` that points to `vertex`.
	var lastIdx = vertexZNodes.length - 1
	for (var v = lastIdx; v > -1; --v) {
		var zNode = vertexZNodes[v]

		if (zNode.node === node) {
			// Sort by LRU.
			if (v !== lastIdx) {
				vertexZNodes[v] = vertexZNodes[lastIdx]
				vertexZNodes[lastIdx] = zNode
			}

			// Add `oldVertex` to the existing zNode's vertices if unique.
			var zNodeVertices = zNode.vertices
			if (zNodeVertices.indexOf(oldVertex) === -1) {
				// `oldVertex` points to `zNode`.
				zNodeVertices.push(oldVertex)
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
		reds: state.reds,
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
		var ruleProps = red.ruleProps
		var isTransposition = ruleProps.isTransposition

		for (var v = 0, verticesLen = vertices.length; v < verticesLen; ++v) {
			// The zNodes that point to this vertex.
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
						ruleProps: ruleProps,
						minCost: undefined,
					}
				} else {
					subNew = {
						node: zNodeNode,
						size: zNodeNode.size + sub.size,
						next: sub,
						ruleProps: ruleProps,
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

		// Get the shift, if any, from each vertex to `node`, then create a vertex for `node` with the original vertex pointing to it.
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
 *
 * @memberOf Parser
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

// Extend `Parser` with methods for matching terminal rules in input.
require('./matchTerminalRules')