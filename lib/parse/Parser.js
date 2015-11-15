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
 * Looks up entity matches in `Parser` input, creates nodes for the associated terminal rules with the entities as semantic arguments, and checks for deletables that precede or are within the entity matches and/or that follow entity matches at the end of input.
 *
 * @memberOf Parser
 * @param {string[]} tokens The input tokens.
 */
Parser.prototype.entitiesLookup = function (tokens) {
	var matchedEntitySets = []

	// Check for entity tokens in input, deletables that precede or are within the entity matches, and deletables that follow entity matches at the end of input.
	for (var t = 0; t < this.tokensLen; ++t) {
		var token = tokens[t]
		var entitySet = entities[token]

		// Check if this token is used by an entity.
		if (entitySet) {
			var matchedEntitySet = matchedEntitySets[t] = []
			var matchedTokens = [ token ]

			for (var e = 0, entitySetLen = entitySet.length; e < entitySetLen; ++e) {
				var entity = entitySet[e]

				var entityId = entity.id
				var semanticArg = this.semanticArgTab[entityId] || (this.semanticArgTab[entityId] = [{
					semantic: {
						name: entityId,
					}
				}])

				matchedEntitySet.push({
					entity: entity,
					semanticArg: semanticArg,
					matchedTokens: matchedTokens,
					startIdx: t,
					endIdx: t,
					deletions: 0,
				})

				// Step backward checking for continuous spans of deletable tokens that end at the start of this entity.
				var leadingDelLen = 1
				var startIdx = t - leadingDelLen
				while (this.deletableTokenSpans[startIdx]) {
					matchedEntitySet.push({
						entity: entity,
						semanticArg: semanticArg,
						matchedTokens: matchedTokens,
						startIdx: startIdx,
						endIdx: t,
						deletions: leadingDelLen,
					})

					++leadingDelLen
					--startIdx
				}

				// Check if all remaining tokens in input (that follow this entity) are deletable.
				var trailingDelLen = this.deletableTokenSpans[t + 1]
				var endIdx = t + trailingDelLen
				if (endIdx === this.tokensLen - 1) {
					leadingDelLen = 0
					startIdx = t

					do {
						matchedEntitySet.push({
							entity: entity,
							semanticArg: semanticArg,
							matchedTokens: matchedTokens,
							startIdx: startIdx,
							endIdx: endIdx,
							deletions: trailingDelLen + leadingDelLen,
						})

						++leadingDelLen
						--startIdx
					} while (this.deletableTokenSpans[startIdx])
				}
			}
		}
	}

	// Merge adjacent token matches for the same entity.
	for (var s = 1; s < this.tokensLen; ++s) {
		var matchedEntities = matchedEntitySets[s]
		if (!matchedEntities) continue

		for (var e = 0, matchedEntitiesLen = matchedEntities.length; e < matchedEntitiesLen; ++e) {
			var entityObj = matchedEntities[e]

			// The entity matches that precede this match (and precede any deletables in the match).
			var prevMatchedEntities = matchedEntitySets[entityObj.startIdx - 1]
			if (!prevMatchedEntities) continue

			var entity = entityObj.entity
			var entTokens = entity.tokens

			for (var p = 0, prevMatchedEntitiesLen = prevMatchedEntities.length; p < prevMatchedEntitiesLen; ++p) {
				var prevEntityObj = prevMatchedEntities[p]
				var prevEntity = prevEntityObj.entity

				// Check if a match for the same entity directly precedes this match in input.
				if (prevEntity.id === entity.id) {
					// Concatenate token arrays and sort alphabetically to prevent multiple matches with the same entity token index.
					var matchedTokens = entityObj.matchedTokens.slice()
					Array.prototype.push.apply(matchedTokens, prevEntityObj.matchedTokens)
					matchedTokens.sort()

					// Check if the tokens of the adjacent entity matches are valid; i.e., do not merge if it contains multiple instances of the same entity token index.
					var prevIdx = -1
					for (var m = 0, matchedTokensLen = matchedTokens.length; m < matchedTokensLen; ++m) {
						var token = matchedTokens[m]
						prevIdx = entTokens.indexOf(token, prevIdx + 1)
						if (prevIdx === -1) break
					}

					if (m < matchedTokensLen) continue

					matchedEntities.push({
						entity: entity,
						semanticArg: prevEntityObj.semanticArg,
						matchedTokens: matchedTokens,
						startIdx: prevEntityObj.startIdx,
						endIdx: entityObj.endIdx,
						deletions: prevEntityObj.deletions + entityObj.deletions,
					})

					// Do not remove the unmerged entities, because those entities can enable other results. For example, given the entities "Jeb Bush" and "George Bush", with the input "Jeb and Bush", removing the entity for "jeb" and merging with "<and> Bush" (where "and" is a delatable), prevents the result "Jeb Bush and George Bush".
				}
			}
		}
	}

	// Generate nodes for terminal rules that produce each entity terminal symbol.
	for (var s = 0; s < this.tokensLen; ++s) {
		var matchedEntities = matchedEntitySets[s]
		if (!matchedEntities) continue

		for (var e = 0, matchedEntitiesLen = matchedEntities.length; e < matchedEntitiesLen; ++e) {
			var entityObj = matchedEntities[e]
			var entity = entityObj.entity

			// The terminal symbol that produces this entity.
			var terminalSym = this.stateTable.placeholderSymTab[entity.category]

			// +1.0 cost penalty per inserted entity token or deletion.
			var costPenalty = (entity.size - entityObj.matchedTokens.length) + entityObj.deletions

			// Create nodes for terminal rules that produce the entity.
			this.createWords(terminalSym, entityObj.startIdx, entityObj.endIdx, entityObj.semanticArg, entity.text, costPenalty)
		}
	}
}

/**
 * Finds the integer symbols for which `intToken` is within range, and creates nodes for those rules with `intToken` as a semantic argument.
 *
 * @memberOf Parser
 * @param {string} intToken The integer input token.
 * @param {string} tokenIndex The index of `intToken` in input.
 */
Parser.prototype.intSymbolLookup = function (intToken, tokenIndex) {
	// It is faster to parse the number from the string and compare it to the numeric min and max values than to compare the original string, though they have the same outcome.
	var parsedFloat = parseFloat(intToken)

	// Assuming `intSymbols` is already sorted by increasing minimum value and then by increasing maximum value.
	for (var i = 0, intSymbolsLen = intSymbols.length; i < intSymbolsLen; ++i) {
		var intSymbol = intSymbols[i]

		// Integer symbols are sorted by increasing minimum value, so all following values are equal to or greater than this.
		if (parsedFloat < intSymbol.min) return

		if (parsedFloat <= intSymbol.max) {
			var terminalSym = this.stateTable.placeholderSymTab[intSymbol.name]

			// Create a new semantic argument using the integer. Reuse if it already exists (same integer used in multiple places in same query) so semantics can be found identical just by their object references (without needing to compare names).
			// Use string version of integer for the semantic.
			var semanticArg = this.semanticArgTab[intToken] || (this.semanticArgTab[intToken] = [ {
				semantic: {
					name: intToken,
				}
			} ])

			// Generate all nodes for rules that produce the terminal symbol.
			this.createWords(terminalSym, tokenIndex, tokenIndex, semanticArg, intToken)
		}
	}
}

/**
 * Create nodes for terminal rules that produce `terminalSym`.
 *
 * @memberOf Parser
 * @param {Object} terminalSym The terminal symbol.
 * @param {number} startIdx The start index of a terminal symbol in input.
 * @param {number} endIdx The end index of a terminal symbol in input.
 * @param {Object[]} [semanticArg] The semantic argument if the terminal symbol is a placeholder (i.e., the semantic created from an entity or integer in input).
 * @param {string} [text] The display text if the terminal symbol is a placeholder (i.e., entities and integers).
 * @param {number} [costPenalty] The cost penalty if the terminal symbol is an entity with deletions and/or insertions.
 */
Parser.prototype.createWords = function (terminalSym, startIdx, endIdx, semanticArg, text, costPenalty) {
	// Add nodes (in `this.addSub()`) to the input index of the terminal symbol's last lexical token.
	this.nodeTab = this.nodeTabs[endIdx]

	// Create node for terminal symbol. Do not use `this.nodeTab`, because every node must be unique. If the two terminal nodes use the same terminal symbol, then the symbol is an entity category, however those entities are different and must be separate to produce separate parse trees.
	var terminalNode = {
		sym: terminalSym,
		// Compute size for every terminal symbol, because it varies for entities of the same entity category and terminal symbols built from regular expressions.
		size: endIdx - startIdx + 1,
		start: startIdx,
	}

	// The nodes for terminal rules that produce the `terminalSym`.
	var wordNodes = []
	// The rules that produce the entity terminal symbol.
	var rules = terminalSym.rules
	// The number of lexical tokens in the terminal symbol.
	var wordSize = terminalNode.size
	// The cost penalty if the terminal symbol is an entity with deletions and/or insertions.
	if (costPenalty === undefined) costPenalty = 0

	// Create a node for each terminal rule that produces `terminalSym`.
	for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
		var rule = rules[r]
		var sub = {
			node: terminalNode,
			size: wordSize,
			ruleProps: undefined,
			minCost: 0,
		}

		// Recreate `ruleProps` if terminal symbol is a placeholder and special display text and creates a semantic argument from input.
		if (semanticArg) {
			var origRuleProps = rule.ruleProps
			sub.ruleProps = {
				cost: origRuleProps.cost + costPenalty,
				// Use the semantic argument created from input (e.g., an entity or integer).
				semantic: origRuleProps.semantic ? semantic.reduce(origRuleProps.semantic, semanticArg) : semanticArg,
				// Entities: use saved text with correct capitalization.
				// Integers: use string of the number to avoid converting number to string later.
				text: text,
			}
		} else {
			sub.ruleProps = rule.ruleProps
		}

		// Create a node with LHS of terminal rule.
		wordNodes.push(this.addSub(rule.RHS[0], sub))
	}

	// Save word to the input query index of its last lexical token.
	var words = this.wordTab[endIdx] || (this.wordTab[endIdx] = [])
	words.push({
		start: startIdx,
		nodes: wordNodes,
	})
}

/**
 * Searches input for deletables that precede each terminal symbol and/or follow each terminal symbol at the end of input, and creates new nodes based on the terminal nodes with spans and cost penalties that include the deletables.
 *
 * @memberOf Parser
 */
Parser.prototype.deletablesLookup = function () {
	// Save the initial length of each word array, because words will be added to the arrays before iterating to them when creating deletions at the end of input.
	var origWordTabLengths = []
	for (var w = 0; w < this.tokensLen; ++w) {
		var words = this.wordTab[w]
		origWordTabLengths[w] = words ? words.length : 0
	}

	// Check for deletables that precede each terminal node and/or follow each terminal node at the end of input.
	for (var endIdx = 0; endIdx < this.tokensLen; ++endIdx) {
		var words = this.wordTab[endIdx]

		for (var w = 0, wordsLen = origWordTabLengths[endIdx]; w < wordsLen; ++w) {
			var word = words[w]
			var wordNodes = word.nodes
			var terminalNode = wordNodes[0].subs[0].node
			this.createDeletions(terminalNode, wordNodes, word.start, endIdx)
		}
	}
}

/**
 * Searches input for deletables that precede `terminalNode` and/or follow `terminalNode` if at the end of input, and creates new nodes based on `origWordNodes` with spans and cost penalties that include the deletables.
 *
 * @param {Object} terminalNode The node for the terminal symbol to check for adjacent deletables.
 * @param {Object[]} origWordNodes The nodes for the terminal rules that produce `terminalNode`.
 * @param {number} origStartIdx The start index of the terminal symbol in input.
 * @param {number} endIdx The end index of the terminal symbol in input.
 */
Parser.prototype.createDeletions = function (terminalNode, origWordNodes, origStartIdx, endIdx) {
	var leadingDelLen = 1
	var startIdx = origStartIdx - leadingDelLen

	// Add nodes (in `this.addSub()`) to the input index of the terminal symbol's last lexical token.
	this.nodeTab = this.nodeTabs[endIdx]

	// Step backward checking for continuous spans of deletable tokens that end at the start of this terminal symbol.
	while (this.deletableTokenSpans[startIdx]) {
		// Create new nodes based on `origWordNodes` for the span beginning with the deletable(s) at `startIdx` and ending with this terminal symbol. Each new node has a cost penalty equal to the number of deleted tokens.
		this.baseCreateDeletions(terminalNode, origWordNodes, startIdx, endIdx, leadingDelLen)

		++leadingDelLen
		--startIdx
	}

	// Check if all remaining tokens in input (that follow this terminal symbol) are deletable.
	var trailingDelLen = this.deletableTokenSpans[endIdx + 1]
	endIdx += trailingDelLen
	if (endIdx === this.tokensLen - 1) {
		leadingDelLen = 0
		startIdx = origStartIdx

		// Create new nodes based on `origWordNodes` for the span beginning with this terminal symbol and ending with the deletables that extend to the end of input, and for each distinct span of preceding deletables found above, if any, ending with the deletables that extend to the end of input. Each new node has a cost penalty equal to the number of deleted tokens.
		do {
			this.nodeTab = this.nodeTabs[endIdx]
			this.baseCreateDeletions(terminalNode, origWordNodes, startIdx, endIdx, trailingDelLen + leadingDelLen)

			++leadingDelLen
			--startIdx
		} while (this.deletableTokenSpans[startIdx])
	}
}

/**
 * Create new nodes based on `origWordNodes` with spans and cost penalties that include adjacent deletables.
 *
 * @param {Object} terminalNode The node for the terminal symbol to check for adjacent deletables.
 * @param {Object[]} origWordNodes The nodes for the terminal rules that produce `terminalNode`.
 * @param {number} startIdx The start index of the span of the terminal symbol and deletables.
 * @param {number} endIdx The end index of the span of the terminal symbol and deletables.
 * @param {number} costPenalty The cost penalty for the deletions, which is equal to 1 per deleted token.
 */
Parser.prototype.baseCreateDeletions = function (terminalNode, origWordNodes, startIdx, endIdx, costPenalty) {
	// The nodes for terminal rules that produce the `terminalSym`.
	var wordNodes = []
	// The size (i.e., span) of the terminal symbol and surround deletions.
	var wordSize = endIdx - startIdx + 1

	// For each terminal rule, create a new node with a deletion cost penalty and the new token span.
	for (var n = 0, origWordNodesLen = origWordNodes.length; n < origWordNodesLen; ++n) {
		var oldNode = origWordNodes[n]
		// Get ruleProps from the first sub because there will always be one. There are never two instances of the same terminal symbol for the same nonterminal symbol because that would be a duplicate rule.
		var oldRuleProps = oldNode.subs[0].ruleProps

		var sub = {
			node: terminalNode,
			// The number of lexical tokens spanned by this node.
			size: wordSize,
			ruleProps: {
				// Add cost penalty of 1 per deleted token.
				cost: oldRuleProps.cost + costPenalty,
				// Reuse previously created semantic arguments or semantic reductions.
				semantic: oldRuleProps.semantic,
				// Reuse previously determined text (e.g., properly capitalized).
				text: oldRuleProps.text,
			},
			minCost: 0,
		}

		var newNode = this.addSub(oldNode.sym, sub)
		newNode.start = startIdx
		wordNodes.push(newNode)
	}

	// Add new nodes at the index of the end of their span.
	var words = this.wordTab[endIdx] || (this.wordTab[endIdx] = [])
	words.push({
		start: startIdx,
		nodes: wordNodes,
	})
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
	// The number of tokens in input.
	this.tokensLen = tokens.length

	// An array of arrays for each lexical token index, each of which holds nodes for terminal rules that produce matched terminal symbols in `query`.
	this.wordTab = []

	// The semantic arguments created from input (e.g., entities and integer symbols). Prevent making duplicate to able equality checks by object reference (as opposed to having to check the semantic `name`).
	this.semanticArgTab = {}

	// The length of continuous deletables beginning at each token index; 0 if token is not deletables.
	this.deletableTokenSpans = []

	var deletionSpan = 0
	for (var i = this.tokensLen - 1; i > -1; --i) {
		// Initialize an array for nodes at index.
		this.nodeTabs[i] = []

		// Assign the length of the continuous span of deletables that begins at index; 0 if token is not deletable.
		if (deletables.indexOf(tokens[i]) !== -1) {
			this.deletableTokenSpans[i] = ++deletionSpan
		} else {
			this.deletableTokenSpans[i] = deletionSpan = 0
		}
	}

	// Lookup every n-gram input the input query.
	for (var startIdx = 0; startIdx < this.tokensLen; ++startIdx) {
		var nGram = tokens[startIdx]

		if (isNaN(nGram)) {
			// Lookup every query segment from `this.position` to the end of the input query.
			var endIdx = startIdx
			while (true) {
				// Check if `nGram` is a terminal symbol in the grammar.
				var terminalSym = this.stateTable.terminalSymTab[nGram]
				if (terminalSym) {
					this.createWords(terminalSym, startIdx, endIdx)
				}

				// Stop at end of input query.
				if (++endIdx === this.tokensLen) break

				nGram += ' ' + tokens[endIdx]
			}
		} else {
			// If unigram is a number, match with rules with integer terminal symbol placeholders, using the unigram as the semantic argument.
			this.intSymbolLookup(nGram, startIdx)
		}
	}

	// Search input for deletables that precede each terminal symbol and/or follow each terminal symbol at the end of input, and creates new nodes based on the terminal nodes with spans and cost penalties that include the deletables.
	this.deletablesLookup()

	// Look up entity matches in `tokens`, create nodes for the associated terminal rules with the entities as semantic arguments, and check for adjacent deletables.
	this.entitiesLookup(tokens)

	// Append the node that produces the `<blank>` symbol to enable insertion rules that are only recognized at the end of `query`.
	// The node has `size` of zero, enabling the returned parse forest to include both trees that end with the `<blank>` symbol and those without, which would otherwise be excluded because of a different size (and seemingly not spanning the entire input).
	this.wordTab[this.tokensLen] = [ {
		start: this.tokensLen,
		nodes: this.stateTable.blankWordNodes,
	} ]

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

	// When no start symbol is found found in the last `vertTab` (above), which is for the inserted `<blank>` symbol, then there were no successful reductions (for insertions) that included `<blank>`. This prevented the nodes in the final lexical token index from being brought over to the final `vertTab`. Hence, search the `vertTab` for the final lexical token index.
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
 * @returns {boolean} Returns `true` if `newSub` already exists, else `false`.
 */
function subIsNew(existingSubs, newSub) {
	var newSubNext = newSub.next

	// Tests show 1.15x more likely to find the subnode faster by iterating backward.
	for (var s = existingSubs.length - 1; s > -1; --s) {
		var oldSub = existingSubs[s]

		if (oldSub.size !== newSub.size || oldSub.node !== newSub.node) {
			continue
		}

		var oldSubNext = oldSub.next
		if (newSubNext && oldSubNext) {
			if (oldSubNext.size !== newSubNext.size || oldSubNext.node !== newSubNext.node) {
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