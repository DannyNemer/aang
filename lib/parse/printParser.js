var util = require('../util/util')
var Parser = require('./Parser')


/**
 * Prints an equational representation of the parse forest of the last parse.
 *
 * This forest is listed in equational form as a grammar which even can be constructed into a `StateTable` used by `Parser` This grammar is characterized as the largest sub-grammar of the input grammar that generates the one element set { the input }.
 *
 * This illustrates that the parsing algorithm also computes the intersection of a context free grammar with a regular grammar.
 *
 * @memberOf Parser
 */
Parser.prototype.printForest = function () {
	util.log(util.colors.bold('\nParse Forest:'))

	if (this.startNode) {
		util.log(this.stringifyNode(this.startNode))
	}

	for (var i = 0, nodeTabsLen = this.nodeTabs.length; i < nodeTabsLen; ++i) {
		var nodes = this.nodeTabs[i]

		for (var n = 0, nodesLen = nodes.length; n < nodesLen; ++n) {
			var node = nodes[n]

			if (!node.sym.isTerminal) {
				var toPrint = this.stringifyNode(node) + ' ='

				var subs = node.subs
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

	for (var i = 0, vertTabsLen = this.vertTabs.length; i < vertTabsLen; ++i) {
		var vertices = this.vertTabs[i]

		for (var v = 0, verticesLen = vertices.length; v < verticesLen; ++v) {
			var vertex = vertices[v]
			var zNodes = vertex.zNodes

			util.log(util.colors.yellow(vertex.startIdx + '_' + states.indexOf(vertex.state)))

			for (var z = 0, zNodesLen = zNodes.length; z < zNodesLen; ++z) {
				var zNode = zNodes[z]
				var subVertices = zNode.vertices

				util.log('  <= [' + this.stringifyNode(zNode.node) + ' ]')

				for (var v2 = 0, subVerticesLen = subVertices.length; v2 < subVerticesLen; ++v2) {
					var subVertex = subVertices[v2]
					var zNodesStr = subVertex.zNodes.map(function (z2) { return z2.node.sym.name }).toString() || 'ACCEPT'
					util.log('     <= v_' + subVertex.startIdx + '_' + states.indexOf(subVertex.state) + ' ' + zNodesStr)
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
 * where M and N are the start and end positions, respectively, of the span of [symbol] in the input.
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
 * Prints a graph representation of the parse forest of the last parse, if the parse reached the start node. Most often, the graph will be too large to print.
 *
 * @static
 * @memberOf Parser
 */
Parser.prototype.printForestGraph = function () {
	if (!this.startNode) return

	var startNode = {
		symbol: this.startNode.sym.name,
		subs: this.startNode.subs.slice(),
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