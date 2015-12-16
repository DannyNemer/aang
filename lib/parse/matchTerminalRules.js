var semantic = require('../grammar/semantic')
var grammar = require('../grammar.json')
var entities = grammar.entities
var intSymbols = grammar.intSymbols
var deletables = grammar.deletables

var Parser = require('./Parser')

/**
 * Tokenizes the input query and looks for terminal symbol matches.
 *
 * @memberOf Parser
 * @param {string} query The input query.
 * @returns {Object[][]} Returns the array of matches for each index of `query`.
 */
Parser.prototype.matchTerminalRules = function (query) {
	this.tokens = query.toLowerCase().split(/\s+/)
	// The number of tokens in input.
	this.tokensLen = this.tokens.length

	// The array of arrays for each lexical token index, each of which holds nodes for terminal rules that produce matched terminal symbols in `query`.
	this.wordTab = []

	// The semantic arguments created from input (e.g., entities and integer symbols). Prevent making duplicate to able equality checks by object reference (as opposed to having to check the semantic `name`).
	this.semanticArgTab = {}

	// Initialize `nodeTabs` with an array for nodes at each index.
	for (var t = 0; t < this.tokensLen; ++t) {
		this.nodeTabs[t] = []
	}

	// Lookup every token in the input query.
	for (var startIdx = 0; startIdx < this.tokensLen; ++startIdx) {
		var token = this.tokens[startIdx]

		if (isNaN(token)) {
			// Check if `token` is a terminal symbol in the grammar.
			var terminalSym = this.stateTable.terminalSymTab[token]
			if (terminalSym) {
				this.createWords(terminalSym, startIdx, startIdx)
			}
		} else {
			// If token is a number, match with rules with integer terminal symbol placeholders, using the token as the semantic argument.
			this.intSymbolLookup(token, startIdx)
		}
	}

	// Initialize the possible deletions in input for use by `Parser.prototype.addWordTabDeletions()` and `Parser.prototype.entitiesLookup()`.
	this.deletablesLookup()

	// Search input for deletables that precede each terminal symbol and/or follow each terminal symbol at the end of input, and creates new nodes based on the terminal nodes in `this.wordTab` with spans and cost penalties that include the deletables.
	this.addWordTabDeletions()

	// Look up entity matches in `this.tokens`, create nodes for the associated terminal rules with the entities as semantic arguments, and check for adjacent deletables.
	this.entitiesLookup()

	// Append the node that produces the `<blank>` symbol to enable insertion rules that are only recognized at the end of `query`.
	// The node has `size` of zero, enabling the returned parse forest to include both trees that end with the `<blank>` symbol and those without, which would otherwise be excluded because of a different size (and seemingly not spanning the entire input).
	this.wordTab[this.tokensLen] = [ {
		start: this.tokensLen,
		nodes: this.stateTable.blankWordNodes,
	} ]

	return this.wordTab
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
		wordNodes.push(this.addSub(rule.rhs[0], sub))
	}

	// Save word to the input query index of its last lexical token.
	var words = this.wordTab[endIdx] || (this.wordTab[endIdx] = [])
	words.push({
		start: startIdx,
		nodes: wordNodes,
	})
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
 * Looks up entity matches in input, creates nodes for the associated terminal rules with the entities as semantic arguments, and checks for deletables that precede or are within the entity matches and/or that follow entity matches at the end of input.
 *
 * @memberOf Parser
 */
Parser.prototype.entitiesLookup = function () {
	var matchedEntitySets = []

	// Check for entity tokens in input, deletables that precede or are within the entity matches, and deletables that follow entity matches at the end of input.
	for (var t = 0; t < this.tokensLen; ++t) {
		var token = this.tokens[t]
		var entitySet = entities[token]

		// Check if this token is used by an entity.
		if (entitySet) {
			var matchedEntities = matchedEntitySets[t] = []
			var matchedTokens = [ token ]

			for (var e = 0, entitySetLen = entitySet.length; e < entitySetLen; ++e) {
				var entity = entitySet[e]

				var entityId = entity.id
				var semanticArg = this.semanticArgTab[entityId] || (this.semanticArgTab[entityId] = [{
					semantic: {
						name: entityId,
					}
				}])

				matchedEntities.push({
					entity: entity,
					semanticArg: semanticArg,
					matchedTokens: matchedTokens,
					startIdx: t,
					endIdx: t,
					deletionsCost: 0,
				})

				// Search input for deletables that precede `token` and/or follow `token` if at the end of input. Create a new entity object for each span of adjacent deletables, if any.
				this.findDeletions(t, t, function (startIdx, endIdx, deletionCost) {
					matchedEntities.push({
						entity: entity,
						semanticArg: semanticArg,
						matchedTokens: matchedTokens,
						startIdx: startIdx,
						endIdx: endIdx,
						deletionsCost: deletionCost,
					})
				})
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

					// Skip if a matched token is a duplicate. E.g., "John John" for "John von Neumann".
					if (m < matchedTokensLen) continue

					matchedEntities.push({
						entity: entity,
						semanticArg: prevEntityObj.semanticArg,
						matchedTokens: matchedTokens,
						startIdx: prevEntityObj.startIdx,
						endIdx: entityObj.endIdx,
						deletionsCost: prevEntityObj.deletionsCost + entityObj.deletionsCost,
					})

					// Do not remove the non-merged entities, because those entities can enable other results. For example, given the entities "Jeb Bush" and "George Bush", with the input "Jeb and Bush", removing the entity for "Jeb" and merging with "<and> Bush" (where "and" is a delatable), prevents the result "Jeb Bush and George Bush".
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
			var costPenalty = (entity.size - entityObj.matchedTokens.length) + entityObj.deletionsCost

			// Create nodes for terminal rules that produce the entity.
			this.createWords(terminalSym, entityObj.startIdx, entityObj.endIdx, entityObj.semanticArg, entity.text, costPenalty)
		}
	}
}

/**
 * Searches input for deletables and unrecognized tokens. Uses `Parser.prototype.deletions` to map each token index with a deletable to an object with the length and cost of the continuous span of deletables that begins at that index.
 *
 * @memberOf Parser
 */
Parser.prototype.deletablesLookup = function () {
	// Map each token index with a deletable to an object with the length and cost of the continuous span of deletables that begins at that index.
	this.deletions = []

	// Look for deletables at each index.
	for (var t = this.tokensLen - 1; t > -1; --t) {
		var token = this.tokens[t]
		var cost = null
		if (deletables.indexOf(token) !== -1) {
			// `token` is a recognized deletable (as defined in the grammar).
			cost = 1
		} else if (!this.wordTab[t] && !entities[token]) {
			// `token` is not a recognized lexical token in the query language or the entities, nor is a legal integer symbol (i.e., within the symbols' specified bounds).
			// This implementation will change with the integration of input strings and language models.
			cost = 3
		}

		if (cost !== null) {
			var nextDeletion = this.deletions[t + 1]
			if (nextDeletion) {
				this.deletions[t] = {
					// The cost of deletion of this token.
					cost: cost,
					// The total deletion cost of the continuous span of deletables that follows this deletion, if any.
					followingCost: nextDeletion.cost + nextDeletion.followingCost,
					// The length of continuous deletables beginning at this index.
					length: nextDeletion.length + 1,
				}
			} else {
				this.deletions[t] = {
					cost: cost,
					followingCost: 0,
					length: 1,
				}
			}
		}
	}
}

/**
 * Searches input for deletables that precede each terminal symbol and/or follow each terminal symbol at the end of input, and creates new nodes based on the terminal nodes in `this.wordTab` with spans and cost penalties that include the deletables.
 *
 * @memberOf Parser
 */
Parser.prototype.addWordTabDeletions = function () {
	// Save the initial length of each word array, because words will be added to the arrays before iterating to them when creating deletions at the end of input.
	var origWordTabLengths = []
	for (var endIdx = 0; endIdx < this.tokensLen; ++endIdx) {
		var words = this.wordTab[endIdx]
		origWordTabLengths[endIdx] = words ? words.length : 0
	}

	// Check for deletables that precede each terminal node and/or follow each terminal node at the end of input.
	for (var endIdx = 0; endIdx < this.tokensLen; ++endIdx) {
		var words = this.wordTab[endIdx]

		for (var w = 0, wordsLen = origWordTabLengths[endIdx]; w < wordsLen; ++w) {
			var word = words[w]
			var wordNodes = word.nodes
			var terminalNode = wordNodes[0].subs[0].node

			// Create new nodes based on `wordNodes` with spans and cost penalties that include adjacent deletables.
			this.findDeletions(word.start, endIdx, this.addDeletion.bind(this, terminalNode, wordNodes))
		}
	}
}

/**
 * Searches input for deletables that precede `startIdx` and/or follow `endIdx` if at the end of input. For each span of adjacent deletions, invokes `addDeletionFunc` with three arguments: (delStartIdx, delEndIdx, deletionCost).
 *
 * @param {number} startIdx The start index of the terminal symbol in input.
 * @param {number} endIdx The end index of the terminal symbol in input.
 * @param {Function} addDeletionFunc The function invoked per continuous span of adjacent deletables.
 */
Parser.prototype.findDeletions = function (startIdx, endIdx, addDeletionFunc) {
	// Add nodes (in `this.addSub()`) to the input index of the terminal symbol's last lexical token.
	this.nodeTab = this.nodeTabs[endIdx]

	// Step backward checking for continuous spans of deletable tokens that end at the start of this terminal symbol.
	var delStartIdx = startIdx
	var deletionCost = 0
	var deletion
	while (deletion = this.deletions[--delStartIdx]) {
		deletionCost += deletion.cost

		// Create new nodes based on `origWordNodes` for the span beginning with the deletable(s) at `delStartIdx` and ending with this terminal symbol. Each new node has a cost penalty equal to the number of deleted tokens.
		addDeletionFunc(delStartIdx, endIdx, deletionCost)
	}

	// Check if all remaining tokens in input (that follow this terminal symbol) are deletable.
	if (deletion = this.deletions[endIdx + 1]) {
		endIdx += deletion.length
		if (endIdx === this.tokensLen - 1) {
			delStartIdx = startIdx
			deletionCost = deletion.followingCost

			// Create new nodes based on `wordNodes` for the span beginning with this terminal symbol and ending with the deletables that extend to the end of input, and for each distinct span of preceding deletables found above, if any, ending with the deletables that extend to the end of input. Each new node has a cost penalty equal to the number of deleted tokens.
			do {
				deletionCost += deletion.cost
				this.nodeTab = this.nodeTabs[endIdx]

				addDeletionFunc(delStartIdx, endIdx, deletionCost)
			} while (deletion = this.deletions[--delStartIdx])
		}
	}
}

/**
 * Create new nodes based on `wordNodes` with spans and cost penalties that include adjacent deletables.
 *
 * @param {Object} terminalNode The node for the terminal symbol to check for adjacent deletables.
 * @param {Object[]} wordNodes The nodes for the terminal rules that produce `terminalNode`.
 * @param {number} startIdx The start index of the span of the terminal symbol and deletables.
 * @param {number} endIdx The end index of the span of the terminal symbol and deletables.
 * @param {number} costPenalty The cost penalty for the deletions, which is equal to 1 per deleted token.
 */
Parser.prototype.addDeletion = function (terminalNode, wordNodes, startIdx, endIdx, costPenalty) {
	// The nodes for terminal rules that produce the `terminalSym`.
	var newWordNodes = []
	// The size (i.e., span) of the terminal symbol and surround deletions.
	var wordSize = endIdx - startIdx + 1

	// For each terminal rule, create a new node with a deletion cost penalty and the new token span.
	for (var n = 0, origWordNodesLen = wordNodes.length; n < origWordNodesLen; ++n) {
		var oldNode = wordNodes[n]
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
		newWordNodes.push(newNode)
	}

	// Add new nodes at the index of the end of their span.
	var words = this.wordTab[endIdx] || (this.wordTab[endIdx] = [])
	words.push({
		start: startIdx,
		nodes: newWordNodes,
	})
}