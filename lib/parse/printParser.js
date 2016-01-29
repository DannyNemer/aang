var util = require('../util/util')
var Parser = require('./Parser')


/**
 * Prints an equational representation of the parse forest of the last parse.
 *
 * The forest is listed in equational form as a grammar which even can be constructed into a `StateTable` used by `Parser`. This grammar is characterized as the largest sub-grammar of the input grammar that generates the one element set: { input }.
 *
 * This illustrates that the parsing algorithm also computes the intersection of a context free grammar with a regular/formal grammar.
 *
 * @memberOf Parser
 * @param {boolean} [sort] Specify sorting parse nodes for inspecting and comparing output.
 */
Parser.prototype.printForest = function (sort) {
	util.log(util.colors.bold('\nParse Forest:'))

	if (this.startNode) {
		util.log(this.stringifyNode(this.startNode))
	}

	if (sort) {
		// Sort `nodeTabs` for inspecting and comparing output.
		sortNodeTabs(this.nodeTabs)
	}

	var nodeSetsLen = this.stateTable.symbolCount

	for (var t = 0; t < this.tokensLen; ++t) {
		var nodeSets = this.nodeTabs[t]

		for (var n = 0; n < nodeSetsLen; ++n) {
			var nodes = nodeSets[n]
			if (!nodes) continue

			for (var i = 0, nodesLen = nodes.length; i < nodesLen; ++i) {
				var node = nodes[i]
				var subs = node.subs

				var toPrint = this.stringifyNode(node) + ' ='

				for (var s = 0, subsLen = subs.length; s < subsLen; ++s) {
					var sub = subs[s]

					if (s > 0) {
						toPrint += '  | '
					}

					do {
						toPrint += ' ' + this.stringifyNode(sub.node)
					} while (sub = sub.next)
				}

				util.log(toPrint)
			}
		}
	}
}

/**
 * Sorts `nodeTabs` for inspecting and comparing `Parser.prototype.printForest()` output.
 *
 * @private
 * @static
 * @param {Object[][]} nodeTabs The array of maps of symbol ids to arrays of nodes at each query index to sort.
 * @returns {Object[][]} Returns `nodeTabs` for convenience.
 */
function sortNodeTabs(nodeTabs) {
	for (var t = 0, nodeTabsLen = nodeTabs.length; t < nodeTabsLen; ++t) {
		var nodeSets = nodeTabs[t]

		// Nodes already sorted alphabetically (by nonterminal symbol `id`).
		for (var n = 0, nodeSetsLen = nodeSets.length; n < nodeSetsLen; ++n) {
			var nodes = nodeSets[n]
			if (!nodes) continue

			// Sort nodes in each set by size.
			nodes.sort(function (a, b) {
				return a.size - b.size
			})

			// Sort subnodes alphabetically (by symbol `id`). The `sort()` function will never return 0 because each subnode is unique.
			for (var i = 0, nodesLen = nodes.length; i < nodesLen; ++i) {
				nodes[i].subs.sort(function (a, b) {
					var diff = a.node.sym.id - b.node.sym.id
					if (diff !== 0) return diff

					if (a.next && b.next) {
						return a.next.node.sym.id - b.next.node.sym.id
					}

					return a.next ? -1 : (b.next ? 1 : 0)
				})
			}
		}
	}

	return nodeTabs
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
 *   v_N_S: N = the input query index
 *          S = the parsing state number
 *   SYM_M_N: SYM = the name of the nonterminal symbol
 *            M, N = the start and end indexes of the span of SYM in the input
 *
 * @memberOf Parser
 * @example
 *
 * If the input is labeled as follows:
 *   0   1   2   3   4    5
 *    the boy saw the girl
 * then the edge:
 *   v_5_11 <= [ NP_3_5 ] <= v_3_7
 * indicates that the parser went from state 7 at index 3 to state 11 at index 5 by shifting a symbol named "NP", which spans the tokens "the girl".
 */
Parser.prototype.printStack = function () {
	util.log(util.colors.bold('\nParse Stack:'))

	for (var inputIdx = 0, vertTabLen = this.vertTab.length; inputIdx < vertTabLen; ++inputIdx) {
		var vertices = this.vertTab[inputIdx]

		for (var v = 0, verticesLen = vertices.length; v < verticesLen; ++v) {
			var vertex = vertices[v]
			var zNodes = vertex.zNodes

			util.log(util.colors.yellow(inputIdx + '_' + getShiftsStateIndex(this.stateTable, vertex.shifts)))

			for (var z = 0, zNodesLen = zNodes.length; z < zNodesLen; ++z) {
				var zNode = zNodes[z]
				var subVertices = zNode.vertices

				util.log('  <= [' + this.stringifyNode(zNode.node) + ' ]')

				for (var v2 = 0, subVerticesLen = subVertices.length; v2 < subVerticesLen; ++v2) {
					var subVertex = subVertices[v2]
					var stateIdx = getShiftsStateIndex(this.stateTable, subVertex.shifts)
					var zNodesStr = subVertex.zNodes.map(zNode => zNode.node.sym.name).toString() || 'ACCEPT'
					util.log('     <= v_' + getVertexIndex(this.vertTab, subVertex) + '_' + stateIdx + ' ' + zNodesStr)
				}
			}
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
 * where M and N are the start and end indexes, respectively, of the input query span of [symbol].
 *
 * @memberOf Parser
 * @param {Object} node The node of which to construct a string representation.
 * @returns {string} Returns the string representation of `node`.
 */
Parser.prototype.stringifyNode = function (node) {
	if (node.sym.isTerminal) {
		return util.stylize(node.sym.name)
	} else {
		// Handle `<blank>` node, which lacks `startIdx` because it is created during `StateTable` generation instead of parsing.
		var startIdx = isNaN(node.startIdx) ? this.tokensLen : node.startIdx
		return node.sym.name + '_' + startIdx + '_' + (startIdx + node.size)
	}
}

/**
 * Gets the index of the `StateTable` state to which `shifts` belongs.
 *
 * `Parser.prototype.printStack()` uses this function to derive the corresponding state index of a parse vertex, which holds the state's `shifts` array instead of the state itself.
 *
 * @private
 * @static
 * @param {Object} StateTable The state table to search.
 * @param {Object[]} shifts The vertex's shifts array belonging to a `StateTable` state.
 * @returns {number} Returns the index of the `StateTable` state to which `shifts` belongs.
 */
function getShiftsStateIndex(stateTable, shifts) {
	var states = stateTable.states
	for (var s = 0, statesLen = states.length; s < statesLen; ++s) {
		if (states[s].shifts === shifts) {
			return s
		}
	}

	throw new Error('State not found')
}

/**
 * Gets the input query index of `vertex` (i.e., its `vertTab` index).
 *
 * `Parser.prototype.printStack()` uses this function to derive a state's corresponding index in the input query.
 *
 * @private
 * @static
 * @param {Object[][]} vertTab The array of sets of vertices to search.
 * @param {Object} vertex The vertex for which to derive the input query index.
 * @returns {number} Returns the input query index of `vertex`.
 */
function getVertexIndex(vertTab, vertex) {
	for (var inputIdx = 0, vertTabLen = vertTab.length; inputIdx < vertTabLen; ++inputIdx) {
		var vertices = vertTab[inputIdx]

		for (var v = 0, verticesLen = vertices.length; v < verticesLen; ++v) {
			if (vertices[v] === vertex) {
				return inputIdx
			}
		}
	}

	throw new Error('Vertex not found')
}

/**
 * Prints a graph representation of the parse forest beginning at `node`. This is most commonly used with the start node of the last parse. Most often, the graph will be too large to print.
 *
 * @static
 * @memberOf Parser
 * @param {Object} node The root of the parse forest to graph.
 */
Parser.prototype.printNodeGraph = function (node) {
	var startNode = {
		symbol: node.sym.name,
		subs: node.subs.slice(),
	}

	var stack = [ startNode ]

	while (stack.length > 0) {
		var node = stack.pop()
		var subs = node.subs

		for (var s = 0, subsLen = subs.length; s < subsLen; ++s) {
			var sub = subs[s]
			var children = subs[s] = []

			do {
				var subNode = sub.node

				var childNode = {
					symbol: subNode.sym.name,
					ruleProps: sub.ruleProps,
				}

				children.push(childNode)

				if (subNode.subs) {
					// Copy `subs` array because the node for `[blank-inserted]` is saved to the `StateTable` instances and shared for every parse.
					childNode.subs = subNode.subs.slice()
					stack.push(childNode)
				}
			} while (sub = sub.next)
		}
	}

	util.dir(startNode)
}