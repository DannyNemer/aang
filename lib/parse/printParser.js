var util = require('../util/util')
var Parser = require('./Parser')


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
			util.log(util.colors.yellow(vertex.startIdx + '_' + states.indexOf(vertex.state)))

			vertex.zNodes.forEach(function (zNode, z) {
				util.log('  <= [' + stringifyNode(zNode.node) + ' ]')

				zNode.vertices.forEach(function (subVertex) {
					var zNodesStr = subVertex.zNodes.map(function (z) { return z.node.sym.name }).toString() || 'ACCEPT'
					util.log('     <= v_' + subVertex.startIdx + '_' + states.indexOf(subVertex.state) + ' ' + zNodesStr)
				})
			})
		})
	})
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
		return node.sym.name + '_' + node.startIdx + '_' + (node.startIdx + node.size)
	}
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