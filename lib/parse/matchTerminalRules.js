var util = require('../util/util')
var Parser = require('./Parser')
var semanticReduce = require('../grammar/semantic').reduce


/**
 * Searches for terminal rules that match `query`, including symbols in the query language and entities, and constructs the parse nodes accordingly. Determines the start and end indexes within `query` of each matched rule. Handles deletions and partial matches of multi-token entities, and determines the edit cost associated with these matches.
 *
 * @memberOf Parser
 * @param {string} query The input query.
 * @returns {Object[][]} Returns an array of an array of nodes for each terminal rule match at each index of `query`.
 */
Parser.prototype.matchTerminalRules = function (query) {
	// The input query tokens.
	this.tokens = query.trim().toLowerCase().replace(/[,.]/g, '').split(/\s+/)
	// The number of tokens in input.
	this.tokensLen = this.tokens.length

	// The array of maps of symbol ids to arrays of nodes of varying size (i.e., its span of the input tokens, depending on the node's height within the tree) at each query index. This enables constructing a parse forest (with packed nodes) of all possible parse trees.
	// Use a 2D array to enable separation of terminal rule matching, which adds nodes at every index first, from reduction of nonterminal rules, which returns to the first index after terminal rule matching.
	this.nodeTabs = util.new2DArray(this.tokensLen, this.stateTable.nontermSymbolCount)

	// The array of arrays of nodes for each terminal rule match, as well each match's start index.
	this.termRuleMatchTab = util.new2DArray(this.tokensLen + 1)
	// The array of arrays of original terminal symbol and entity matches for each individual input token. Its contents do not change after invoking `Parser.prototype.tokensLookup()` (i.e., does not contain matches with deletions or merged entity matches) to enable `Parser.prototype.addDeletions()` and `Parser.prototype.addDeletablesForAllTokens()` to add deletions to the original matches.
	this.terminalSymTab = util.new2DArray(this.tokensLen)
	// The array of arrays of multi-token entity matches for each index. This includes original matches, matches with deletions, and merges of adjacent matches of the same entity for multi-token entities.
	this.entityTab = util.new2DArray(this.tokensLen)
	// The semantic arguments created from input matches to entities and integer symbols. This prevents duplicate semantic arguments in the parse forest to enable equality checks by object reference (as opposed to having to check the semantic `name` property).
	this.semanticArgTab = Object.create(null)
	// Perform terminal symbol, integer symbol, and entity lookups for each token in the input query. Add nodes for each single-token terminal rule match, add matches to `terminalSymTab` for use by `Parser.prototype.addDeletions()`, and add multi-token entity matches to `entityTab` for use by `Parser.prototype.mergeEntityMatches()`.
	this.tokensLookup()

	// The map of each token index with a deletable to an object with the `cost` of that deletion and the `length` and `followingCost` of the continuous span of deletables that follow.
	this.deletions = new Array(this.tokensLen)
	// Search the input query for grammar-defined deletables and unrecognized tokens, and add them to `deletions`. Invoke this method after `Parser.prototype.tokensLookup()` to determine unrecognized input tokens, and before `Parser.prototype.addDeletions()`, which adds nodes with the deletions and the adjacent terminal symbol matches.
	this.deletablesLookup()
	// Add nodes that combine deletables in `deletions` with the single token matches in `terminalSymTab`, with spans and cost penalties that include the adjacent deletables. Invoke this method after `Parser.prototype.deletablesLookup()`, which search the input query tokens for deletables.
	this.addDeletions()

	// Merge adjacent token matches for the same multi-token entity in `entityTab`, including deletions, while avoiding ambiguity.
	this.mergeEntityMatches()
	// Add nodes for multi-token entities, including the merged entity matches from `Parser.prototype.mergeEntityMatches()`. Add the merged entity matches separately from `Parser.prototype.mergeEntityMatches()`, which finds and merges all adjacent matches for the same entity and keeps only the cheapest match when there are duplicates (caused by deletions).
	this.addMultiTokenEntityNodes()

	// Append to the end of `nodeTabs` an array with the node that produces the `<blank>` symbol to enable insertion rules that are only recognized at the end of `query`.
	this.addBlankNode()

	return this.termRuleMatchTab
}

/**
 * After failing to reach the start node or failing to generate legal parse trees (due to contradictory semantics) on the initial parse, as a last resort (and a significant performance hit), reparses the input query with all tokens marked deletable (except those already added to `deletions`) and adds new nodes for terminal rule matches that span and include those deletions.
 *
 * @memberOf Parser
 * @returns {Object[][]} Returns an array of an array of nodes for each terminal rule match at each index of `query`.
 */
Parser.prototype.addDeletablesForAllTokens = function () {
	// Add deletables to `deletions` for every input token that `Parser.prototype.deletablesLookup()` did not previously mark as deletable. Invoke this method before `Parser.prototype.addDeletions(true)`, which adds nodes with the new deletables and the adjacent terminal symbol matches.
	this.remainingTokensDeletablesLookup()
	// Add nodes for deletions that include the new deletables which `Parser.prototype.remainingTokensDeletablesLookup()` added.
	this.addDeletions(true)

	// Merge adjacent multi-token entity matches for the same entity that include the new deletions which `Parser.prototype.remainingTokensDeletablesLookup()` added.
	this.mergeEntityMatches(true)
	// Add nodes for multi-token entities, including the merged entity matches, that include the new deletions which `Parser.prototype.remainingTokensDeletablesLookup()` added.
	this.addMultiTokenEntityNodes(true)

	return this.termRuleMatchTab
}

/**
 * Performs terminal symbol, entity, and integer symbol lookups for each token in the input query. Adds nodes for each single-token terminal rule match, adds matches to `terminalSymTab` for use by `Parser.prototype.addDeletions()`, and adds multi-token entity matches to `entityTab` for use by `Parser.prototype.mergeEntityMatches()`.
 *
 * @memberOf Parser
 */
Parser.prototype.tokensLookup = function () {
	for (var curIdx = 0; curIdx < this.tokensLen; ++curIdx) {
		var token = this.tokens[curIdx]

		// Save single-token terminal symbol matches at their index within the input query.
		this.symIdToNodesMap = this.nodeTabs[curIdx]
		this.termRuleMatches = this.termRuleMatchTab[curIdx]
		this.matchedSymbols = this.terminalSymTab[curIdx]

		// Check if `token` is numeric.
		// • Use `isNaN()` instead of `parseInt()` or `parseFloat()` to fail on numbers with trailing non-numeric characters (e.g., "20mb") until properly implementing prefixes and suffixes.
		if (isNaN(token)) {
			// Match `token` to a terminal symbol in the grammar's query language, if any.
			this.terminalSymbolLookup(token, curIdx)

			// Match `token` to entities that contain the token, if any.
			this.entityLookup(token, curIdx)
		} else {
			// Convert `intToken` to an integer and remove numeric artifacts.
			var parsedInt = parseIntToken(token)

			// Convert `parsedInt` (after any necessary cleaning and rounding) back to a string for matching terminal symbols and use in display text and as a semantic argument.
			token = String(parsedInt)

			// Match `token` to a non-ranged-based numeric terminal symbol, if any; e.g., "1" -> "January".
			this.terminalSymbolLookup(token, curIdx)

			// Match `token` to integer symbols for which `parsedInt` is within the specified range, if any.
			this.intSymbolLookup(token, parsedInt, curIdx)
		}
	}
}

/**
 * Converts `intToken` to an integer and removes numeric artifacts.
 *
 * For use by `Parser.prototype.tokensLookup()` after `isNaN(intToken)` fails and before matching the returned (cleaned) value to a non-ranged-based numeric terminal symbol, if any, and range-based terminal symbols.
 *
 * Removes the following numeric artifacts from `intToken`:
 * • Strips leading 0s: "02" -> 2.
 * • Converts exponential notation to integers: "1e3" -> 100.
 * • Converts hexadecimals to decimals: "0x10" -> 16.
 * • Rounds parsed floating point numbers: "2.3" -> 2, "2.5" -> 3, "1e-3" -> 0.
 *
 * @private
 * @static
 * @param {string} intToken The input token to convert and clean.
 * @returns {number} Returns the number.
 */
function parseIntToken(intToken) {
	/**
	 * Convert and clean numeric input tokens:
	 * • Parse numbers and maintain any digits after decimal point with `Number()`: "2.7" -> 2.7
	 *   - Maintain any digits after decimal point for proper rounding that follows, if necessary.
	 *   - `parseInt()` would incorrectly convert "2.7" -> 2.
	 *   - `parseFloat()` would work here (but fails other requirements).
	 *
	 * • Strip leading 0s with `Number()`: "02" -> 2.
	 *   - `parseInt()` or `parseFloat()` would work here (but fail other requirements).
	 *
	 * • Convert exponential notation to integers with `Number()`: "1e3" -> 100.
	 *   - `parseInt()` would incorrectly convert "1e3" -> 1.
	 *   - `parseFloat()` would work here (but fails other requirements).
	 *
	 * • Convert hexadecimals to decimals with `Number()`: "0x10" -> 16.
	 *   - `parseFloat()` would incorrectly convert "0x10" -> 0.
	 *   - `parseInt()` would work here (but fails other requirements).
	 *
	 * • Round parsed floating point numbers to integers with `Math.round()`: 2.3 -> 2, 2.5 -> 3, 1e-3 -> 0.
	 *
	 * • For now, fail on trailing or leading non-numeric characters until properly implementing prefixes (e.g., "$20") and suffixes (e.g., "20mb", "20 MB", "Danny's"), which might integrate editing costs.
	 *   - Invoke after `isNaN(token)` check to stop such numbers from reaching here.
	 *   - Use `Number()` to fail on such tokens (even if the preceding `isNaN()` check in `Parser.prototype.tokensLookup()` stops them): "20mb" -> NaN.
	 *     • `parseFloat()` and `parseInt()` would incorrectly strip trailing non-numeric characters: "20mb" -> 20.
	 */
	return Math.round(Number(token))
}

/**
 * Checks if `symToken` is a terminal symbol in the grammar's query language, adds nodes for the rules that produce the matching terminal symbol, if any, and saves the matches to `terminalSymTab` for adding deletions in `Parser.prototype.addDeleltionToAdjacentSymbolMatches()`.
 *
 * @memberOf Parser
 * @param {string} symToken The lexical token to match to a terminal symbol in the query language.
 * @param {number} tokenIdx The index of `symToken` in input.
 */
Parser.prototype.terminalSymbolLookup = function (symToken, tokenIdx) {
	var terminalSym = this.stateTable.terminalSymTab[symToken]

	if (terminalSym) {
		// Add nodes for the terminal rules that produce `terminalSym` (at this index).
		this.addTermRuleNodes(terminalSym, tokenIdx, tokenIdx)

		// Save the terminal symbol match for adding deletions in `Parser.prototype.addDeleltionToAdjacentSymbolMatches()`.
		this.matchedSymbols.push({
			terminalSym: terminalSym,
			semanticArg: undefined,
			text: undefined,
		})
	}
}

/**
 * Finds the integer symbols for which `intToken` is within range, adds nodes for those rules with `intToken` as a semantic argument and display text, and saves the matches to `terminalSymTab` for adding deletions in `Parser.prototype.addDeleltionToAdjacentSymbolMatches()`.
 *
 * Pass `intToken` as an integer after stripping leading 0s, converting from exponential or hexadecimal notation, and/or rounding, if necessary.
 * • For example: "02" -> "2", "1e3" -> "100", "0x10" -> "16", "2.70" -> "3".
 *
 * Pass number `parsedInt` for comparing `intToken` to the numeric min and max value bounds of the range-based integer terminal symbols.
 * • It is faster to compare the numeric bounds to another number than the stringified numeric value, `intToken`, though identical.
 *
 * @memberOf Parser
 * @param {string} intToken The integer input token to match to range-based integer symbols.
 * @param {number} parsedInt The integer form of `intToken`.
 * @param {number} tokenIdx The index of `intToken` in input.
 */
Parser.prototype.intSymbolLookup = function (intToken, parsedInt, tokenIdx) {
	// `intSymbols` is sorted by increasing minimum value and then by increasing maximum value.
	for (var i = 0, intSymbolsLen = this.stateTable.intSymbols.length; i < intSymbolsLen; ++i) {
		var intSymbol = this.stateTable.intSymbols[i]

		// Integer symbols are sorted by increasing minimum value, so all following values are equal to or greater than this value.
		if (parsedInt < intSymbol.min) {
			return
		}

		if (parsedInt <= intSymbol.max) {
			var terminalSym = this.stateTable.placeholderSymTab[intSymbol.name]

			// Get the semantic argument for `intToken` if it exists, else create a new semantic using the integer (as a string).
			var semanticArg = this.getSemanticArg(intToken)

			// Add nodes for the terminal rules that produce `terminalSym` (at this index), with `ruleProps` that includes the integer as the semantic argument and `intToken` as display text.
			this.addTermRuleNodes(terminalSym, tokenIdx, tokenIdx, semanticArg, intToken)

			// Save the integer symbol match for adding deletions in `Parser.prototype.addDeleltionToAdjacentSymbolMatches()`.
			this.matchedSymbols.push({
				terminalSym: terminalSym,
				semanticArg: semanticArg,
				text: intToken,
			})
		}
	}
}

/**
 * Checks for entities that include `entToken`. Adds nodes for single-token entities, using the entity for for the semantic argument and display text, saves matches for multi-token entities to `entityTab` for use by `Parser.prototype.mergeEntityMatches()`, and saves all matches to `terminalSymTab` for adding deletions in `Parser.prototype.addDeleltionToAdjacentSymbolMatches()`.
 *
 * @memberOf Parser
 * @param {string} entToken The lexical token to match to entities.
 * @param {number} tokenIdx The index of `entToken` in input.
 */
Parser.prototype.entityLookup = function (entToken, tokenIdx) {
	// Entities that contain `entToken`.
	var entitySet = this.stateTable.entitySets[entToken]

	if (entitySet) {
		var entityMatches = this.entityTab[tokenIdx]
		// Track the matched tokens to prevent multiple matches of the same entity token index (in `Parser.prototype.mergeEntityMatches()`).
		var matchedTokens = [ entToken ]

		for (var e = 0, entitySetLen = entitySet.length; e < entitySetLen; ++e) {
			var entity = entitySet[e]

			// Get the terminal symbol for the entity category. Terminal nodes for multiple entities in the same category use the same symbol, but use the node's parent subnode's `ruleProps`, which contains the entities' semantic and display text, to distinguish them.
			var terminalSym = this.stateTable.placeholderSymTab[entity.category]

			// Get the semantic argument for the entity category if it exists, else create a new semantic using the entity id.
			var semanticArg = this.getSemanticArg(entity.id, entity.anaphoraPersonNumber)

			if (entity.size > 1) {
				var entityMatch = {
					entity: entity,
					terminalSym: terminalSym,
					semanticArg: semanticArg,
					matchedTokens: matchedTokens,
					startIdx: tokenIdx,
					deletionsCost: 0,
					/**
					 * Specify there exists a uni-token alias for the same entity (id and display text) as this multi-token entity object, that is contained within this `entity.name`.
					 *
					 * If `true`, instructs `Parser.prototype.addMultiTokenEntityNodes()` to not add a parse node for this single-token entity match because the uni-token alias (for this entity) for the same token is added below. I.e., avoid multiple matches for the same entity (id and display) via different names/aliases over the same one-token span. Keep this match for merging with adjacent matches to the same entity name (to form a multi-token match).
					 *
					 * For example, a match to "Iroh" can be for either the alias "Iroh" or "General Iroh", both of which map to "Iroh".
					 *
					 * Note: It is likely the overhead from this additional check for this rare edge case is more detrimental to performance than having `Parser` and `pfsearch` absorb additional load, and allowing `pfsearch` to catch the ambiguity at the end.
					 *
					 * Note: This check can be improved by making entity objects unique for each token that maps to it, thereby specifying whether each entity match has the token that will be ambiguous, instead of checking every instance of the entity. This requires removing the operation in `initEntities` that replaces multiple instances of the same object with pointers to the same object, and instead accomplishing the same with the `tokens` array. This additional complexity is excessive for such a rare edge case.
					 */
					hasAmbigUniTokenAlias: entity.ambigUniTokenAliases && entity.ambigUniTokenAliases.indexOf(entToken) !== -1,
				}

				// Add multi-token entities to `entityTab` at this index (instead of adding nodes here) for use by `Parser.prototype.mergeEntityMatches()`. This enables merging adjacent token matches for the same entity while avoiding duplicates (i.e., ambiguity).
				entityMatches.push(entityMatch)

				// Save the entity match for adding deletions in `Parser.prototype.addDeleltionToAdjacentSymbolMatches()`. Include `entityMatch` for multi-token entities so that expansions of this match with adjacent deletables are also added to `entityMatches` (for use by `Parser.prototype.mergeEntityMatches()`).
				this.matchedSymbols.push({
					terminalSym: terminalSym,
					semanticArg: semanticArg,
					text: entity.text,
					entityMatch: entityMatch,
				})
			} else {
				// Add nodes for the terminal rules that produce `terminalSym` (at this index), with `ruleProps` that include the entity id as the semantic argument and the display text which `entity` defines.
				this.addTermRuleNodes(terminalSym, tokenIdx, tokenIdx, semanticArg, entity.text)

				// Save the entity match for adding deletions in `Parser.prototype.addDeleltionToAdjacentSymbolMatches()`.
				this.matchedSymbols.push({
					terminalSym: terminalSym,
					semanticArg: semanticArg,
					text: entity.text,
				})
			}
		}
	}
}

/**
 * Merges adjacent multi-token entity matches for the same entity in `entityTab`, including deletions, while avoiding ambiguity.
 *
 * @memberOf Parser
 * @param {boolean} [onlyNewDeletables] Specify this invocation is after failing the initial parse, and to only add nodes using the new deletables.
 */
Parser.prototype.mergeEntityMatches = function (onlyNewDeletables) {
	// Merge adjacent token matches for the same entity.
	for (var endIdx = 1; endIdx < this.tokensLen; ++endIdx) {
		var entityMatches = this.entityTab[endIdx]

		// Add nodes at the last index of the multi-token entity match.
		this.symIdToNodesMap = this.nodeTabs[endIdx]
		this.termRuleMatches = this.termRuleMatchTab[endIdx]

		for (var e = 0, entityMatchesLen = entityMatches.length; e < entityMatchesLen; ++e) {
			var entityMatch = entityMatches[e]
			// Skip if this entity match already spans to the start of the input query via deletions.
			if (entityMatch.startIdx === 0) continue

			// The entity matches that precede this match (and any deletables within the match).
			var prevEntityMatches = this.entityTab[entityMatch.startIdx - 1]
			var entity = entityMatch.entity
			var entTokens = entity.tokens

			for (var p = 0, prevEntityMatchesLen = prevEntityMatches.length; p < prevEntityMatchesLen; ++p) {
				var prevEntityMatch = prevEntityMatches[p]
				// If `onlyNewDeletables`, require at least one of the two entity matches (to merge) to contain a new deletable.
				if (onlyNewDeletables && !prevEntityMatch.hasNewDeletable && !entityMatch.hasNewDeletable) continue

				// Check if `prevEntityMatch`, which directly precedes `entityMatch` in input, is a match for the same entity object. `initEntities` enables this by replacing duplicate entity objects with references to the same object. Do not compare entity id, because there can be different entity objects (for different names/aliases) for the same entity.
				if (prevEntityMatch.entity === entity) {
					// Concatenate token arrays and sort alphabetically to prevent multiple matches of the same entity token index.
					var matchedTokens = prevEntityMatch.matchedTokens.concat(entityMatch.matchedTokens).sort()

					// Check if the merged tokens of the adjacent entity matches are valid; i.e., do not merge if it contains multiple matches for the same entity token index. Otherwise, skip if a matched token is a duplicate. E.g., "John John" for "John von Neumann".
					if (matchedTokensAreValid(entTokens, matchedTokens)) {
						/**
						 * Add the merged multi-token entity match to `entityMatches`, for which nodes will be added at the end (to avoid duplicates; i.e., ambiguity). If the merged entity is identical to an existing one, keep the cheapest. Deletions of entity tokens cause this, which occur when an entity token is a grammar-defined deletable or after invoking `Parser.prototype.addDeletablesForAllTokens()`.
						 *
						 * Must save multiple matches to the same entity via different names/aliases for that entity because the tokens that follow will determine which name/alias match has the total cheapest cost.
						 */
						var newDeletionsCost = prevEntityMatch.deletionsCost + entityMatch.deletionsCost
						var newIdx = getEntityMatchIndex(entityMatches, entity, prevEntityMatch.startIdx, newDeletionsCost)
						if (newIdx !== -1) {
							entityMatches[newIdx] = {
								entity: entity,
								terminalSym: entityMatch.terminalSym,
								semanticArg: entityMatch.semanticArg,
								matchedTokens: matchedTokens,
								startIdx: prevEntityMatch.startIdx,
								deletionsCost: newDeletionsCost,
								hasNewDeletable: onlyNewDeletables,
							}
						}

						/**
						 * Do not remove the non-merged entities, because those entities can enable other results. For example, given the entities "Jeb Bush" and "George Bush", with the input "Jeb and Bush", removing the entity for "Jeb" when merging with "<and> Bush" (where "and" is a deletable) prevents the result "Jeb Bush and George Bush".
						 */
					}
				}
			}
		}
	}
}

/**
 * Checks if the newly merged `matchedTokens` from adjacent entity matches is valid. I.e., the merge does not contain multiple matches for the same entity token index; e.g., "John John" for "John von Neumann".
 *
 * `Parser.prototype.mergeEntityMatches()` invokes this function.
 *
 * Note: A possible improvement is to distinguish each entity object that an entity token maps to (i.e., removing the memory consolidation in `initEntities`) and identifying the index of each entity token match within the entity's tokens. E.g., 'Max Planck Max' -> [ 1, 1, 2 ] (order still does not matter, only the number of occurrences of each token). This optimization might not scale because removing the memory consolidation can double the store of entities.
 *
 * @private
 * @static
 * @param {string[]} entTokens [description]
 * @param {string[]} matchedTokens [description]
 * @returns {boolean} Returns `true` if `matchedTokens` is valid, else `false`.
 */
function matchedTokensAreValid(entTokens, matchedTokens) {
	var prevIdx = -1
	for (var t = 0, matchedTokensLen = matchedTokens.length; t < matchedTokensLen; ++t) {
		prevIdx = entTokens.indexOf(matchedTokens[t], prevIdx + 1)

		// Matched token index is a duplicate. Instruct `Parser.prototype.mergeEntityMatches()` to discard this merge of adjacent entity matches.
		if (prevIdx === -1) return false
	}

	return true
}

/**
 * Gets the index of where to add the entity with the provided parameters in `entityMatches` to avoid duplicates in `Parser.prototype.mergeEntityMatches()`.
 *
 * If `newDeletionsCost` is less than an existing match in `entityMatches` for the same entity object, then returns the existing match's index with which to overwrite. Else if `newDeletionsCost` is greater than or equal to an an existing match for the same entity, then returns `-1` to discard the new entity match. Else, the entity is unique and returns the length of `entityMatches` with which to append the new entity.
 *
 * @private
 * @static
 * @param {Object[]} entityMatches The existing entity matches at this index.
 * @param {number} entity The matched entity.
 * @param {number} startIdx The start index within the input query of the entity match (including deletions).
 * @param {number} newDeletionsCost The total cost of deletables in the entity match.
 * @returns {number} Returns the index of `entityMatches` where to add the specified entity. If `-1`, the entity is to be discarded (i.e., not added).
 */
function getEntityMatchIndex(entityMatches, entity, startIdx, newDeletionsCost) {
	for (var e = 0, entityMatchesLen = entityMatches.length; e < entityMatchesLen; ++e) {
		var existingEntityObj = entityMatches[e]

		// Compare `entity` instead of `entity.id` because `initEntities` replaced multiple instance of the same entity objects with references to the same object, yet there are multiple entity objects with the same `id` but are distinguished by `name` (i.e., aliases).
		if (existingEntityObj.entity === entity && existingEntityObj.startIdx === startIdx) {
			// Only compare `deletionsCost` because if it is the same token span (i.e., same `startIdx` and same end index because within the same `entityMatches` array), then the only difference is deletions. If deletables ever have costs less than insertion costs for partial multi-token entity matches, then this check must be amended to account for such.
			if (newDeletionsCost < existingEntityObj.deletionsCost) {
				// The new entity match is cheaper and the existing match and should replace it.
				return e
			}

			// The new entity match is more expensive than the existing match and should be discarded.
			return -1
		}
	}

	// The new entity match is unique and should be appended.
	return entityMatchesLen
}

/**
 * Adds nodes for multi-token entities, including the merged entity matches from `Parser.prototype.mergeEntityMatches()`. Adds the merged entity matches separately from `Parser.prototype.mergeEntityMatches()`, which finds and merges all adjacent matches for the same entity and keeps only the cheapest match when there are duplicates (caused by deletions).
 *
 * @memberOf Parser
 * @param {boolean} [onlyNewDeletables] Specify this invocation is after failing the initial parse, and to only add nodes using the new deletables.
 */
Parser.prototype.addMultiTokenEntityNodes = function (onlyNewDeletables) {
	for (var endIdx = 0; endIdx < this.tokensLen; ++endIdx) {
		var entityMatches = this.entityTab[endIdx]

		// Add nodes at the last index of the multi-token entity match.
		this.symIdToNodesMap = this.nodeTabs[endIdx]
		this.termRuleMatches = this.termRuleMatchTab[endIdx]

		for (var e = 0, entityMatchesLen = entityMatches.length; e < entityMatchesLen; ++e) {
			var entityMatch = entityMatches[e]
			// If `onlyNewDeletables`, only add entity matches that contain deletables which `Parser.prototype.remainingTokensDeletablesLookup()` added.
			if (onlyNewDeletables && !entityMatch.hasNewDeletable) continue

 			/**
 			 * Do not add a parse node for a single-token entity match via a token for which a uni-token alias for the same entity exists and a parse node was already added (with a guaranteed smaller cost). I.e., avoids multiple matches for the same entity (id and display) via different names/aliases over the same one-token span.
 			 *
 			 * For example, a match to "Iroh" can be for either the alias "Iroh" or "General Iroh", both of which map to "Iroh".
 			 */
			if (entityMatch.hasAmbigUniTokenAlias) continue

			var entity = entityMatch.entity

			/**
			 * Check for matches to the same entity (id and display text) via multiple (ambiguous) names/aliases, over the same token span, and keep the cheapest match. E.g., a match to "Alan" can be for either the alias "Alan Kay" or "Alan Curtis", both of which map to "Alan Kay".
			 *
			 * This check can not occur earlier because all entity matches are needed for merging matches to the same entity object and determining which matches alias is the best match.
			 *
			 * Keep multiple matches to the same entity (id and display text) via multiple names/aliases over different token spans, just as multiple matches to the same entity object over different spans are kept, because all possible spans must be examined to explore all possible insertions.
			 */
			if (entity.hasAmbigMultiTokenAlias && isAmbigMultiTokenEntityMatch(entityMatches, e)) {
				// Do not add terminal node for entity match if there exists other matches for the same entity (id and display text) across the same token span. If other matches have the same cost, then the last match will be added because this only compares entities to those that follow within `entityMatches`.
				continue
			}

			/**
			 * Calculate cost penalty using `matchedTokens.length` instead of the match's span, because the span can include interspersed deletions.
			 *
			 * Calculate cost using division so that "John not" produces different edit costs for "John <not>" and "John not Neumann".
			 */
			var costPenalty = 1 - entityMatch.matchedTokens.length / entity.size + entityMatch.deletionsCost

			// Add nodes for the terminal rules that produce `terminalSym` (at this index), with `ruleProps` that include the entity id as the semantic argument and the display text which `entity` defines.
			this.addTermRuleNodes(entityMatch.terminalSym, entityMatch.startIdx, endIdx, entityMatch.semanticArg, entity.text, costPenalty)
		}
	}
}

/**
 * Checks if the multi-token entity match at index `matchIdx` in `entityMatches` is ambiguous with another match in the array following index `matchIdx`, and this match should be discarded (i.e., not added as a terminal node) because it has a greater cost.
 *
 * Matches are ambiguous if they are for the same entity (id and display text), but with different names/aliases, and have the same token span. E.g., a match to "Alan" can be for either the alias "Alan Kay" or "Alan Curtis", both of which map to "Alan Kay".
 *
 * `Parser.prototype.addMultiTokenEntityNodes()` invokes this function, and only if the entity has the property `hasAmbigMultiTokenAlias`, which is `true` if this entity object is multi-token and shares a token with another multi-token name for same entity id (because this function could not return `true` otherwise).
 *
 * Note: It is likely the overhead from this additional check for this rare edge case is more detrimental to performance than having `Parser` and `pfsearch` absorb additional load, and allowing `pfsearch` to catch the ambiguity at the end.
 *
 * Note: This check can be improved by making entity objects unique for each token that maps to it, thereby specifying whether each entity match has the token that will be ambiguous, instead of checking every instance of the entity. This requires removing the operation in `initEntities` that replaces multiple instances of the same object with pointers to the same object, and instead accomplishing the same with the `tokens` array. This additional complexity is excessive for such a rare edge case.
 *
 * @private
 * @static
 * @param {Object[]} entityMatches The multi-token entity matches to check for another (ambiguous) match to the same entity over the same token span via a different entity name/alias.
 * @param {number} matchIdx The index of the match within `entityMatches` to compare against.
 * @returns {boolean} Returns `true` if the entity match at index `matchIdx` within `entityMatches` is ambiguous with, and has a greater cost than, another match that follows it within the array and should be discarded, else `false`.
 */
function isAmbigMultiTokenEntityMatch(entityMatches, matchIdx) {
	var entityMatch = entityMatches[matchIdx]
	var entityId = entityMatch.entity.id

	for (var o = matchIdx + 1, entityMatchesLen = entityMatches.length; o < entityMatchesLen; ++o) {
		var otherEntityObj = entityMatches[o]

		/**
		 * Matches are ambiguous if they are for the same entity id but with different names/aliases, and have the same token span. (Check `id` instead of the entity objects themselves.)
		 *
		 * Check all other entities even if `onlyNewDeletables` because ambiguity can occur across both iterations of entity matches.
		 */
		if (otherEntityObj.entity.id === entityId && otherEntityObj.startIdx === entityMatch.startIdx && otherEntityObj.deletionsCost <= entityMatch.deletionsCost) {
			return true
		}
	}

	return false
}

/**
 * Searches the input query tokens for grammar-defined deletables and unrecognized tokens. Saves deletables to `deletions`, which maps each token index to an object with the `cost` of that deletable and the `length` and `followingCost` of the continuous span of deletables that follow.
 *
 * Invoke this method after `Parser.prototype.tokensLookup()` to determine unrecognized input tokens, and before `Parser.prototype.addDeletions()`, which adds nodes with the deletions and the adjacent terminal symbol matches.
 *
 * @memberOf Parser
 */
Parser.prototype.deletablesLookup = function () {
	// Look for deletables at each index. Iterate backward to determine the continuous span of deletables that follow each index.
	for (var t = this.tokensLen - 1; t > -1; --t) {
		var cost
		if (this.stateTable.deletables.indexOf(this.tokens[t]) !== -1) {
			// `token` is a grammar-defined deletable.
			cost = 1
		} else if (this.termRuleMatchTab[t].length === 0 && this.entityTab[t].length === 0) {
			// `token` is neither a recognized token in the query language or the entities, nor is a legal integer symbol (i.e., within the symbols' specified bounds). This implementation will change with the integration of input strings and language models.
			cost = 3
		} else {
			continue
		}

		var nextDeletion = this.deletions[t + 1]
		if (nextDeletion) {
			this.deletions[t] = {
				// The cost of deleting this token.
				cost: cost,
				// The total deletion cost of the continuous span of deletables that follow this deletion.
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

/**
 * After failing to reach the start node or generate legal parse trees on the initial parse, adds deletables to `deletions` for every input token that `Parser.prototype.deletablesLookup()` did not previously mark as deletable.
 *
 * Invoke this method before `Parser.prototype.addDeletions(true)`, which adds nodes with the new deletables and the adjacent terminal symbol matches.
 *
 * @memberOf Parser
 */
Parser.prototype.remainingTokensDeletablesLookup = function () {
	var lastIdx = this.tokensLen - 1
	for (var t = lastIdx; t > -1; --t) {
		var thisDeletion = this.deletions[t]

		if (t < lastIdx) {
			var nextDeletion = this.deletions[t + 1]

			if (!thisDeletion) {
				this.deletions[t] = {
					// The cost of deleting this token.
					cost: remainingTokenDeletableCost(t, lastIdx),
					// The total deletion cost of the continuous span of deletables that follow this deletion.
					followingCost: nextDeletion.cost + nextDeletion.followingCost,
					// The length of continuous deletables beginning at this index.
					length: nextDeletion.length + 1,
					// Specify this deletion was added on the second parse (after failing the initial parse) to distinguish the deletable from existing deletions from which nodes were already created. This enables `Parser.prototype.addDeletions(true)` to avoid adding duplicate nodes.
					isNew: true,
				}
			} else if (nextDeletion.isNew) {
				// Update existing deletables for `followingCost` and specify `isNew` as `true`, for use in spans of deletables that extend to the end of input.
				thisDeletion.followingCost = nextDeletion.cost + nextDeletion.followingCost
				thisDeletion.length = nextDeletion.length + 1
				thisDeletion.isNew = true
			}
		} else if (!thisDeletion) {
			this.deletions[t] = {
				cost: remainingTokenDeletableCost(t, lastIdx),
				followingCost: 0,
				length: 1,
				isNew: true,
			}
		}
	}
}

/**
 * Calculates the deletion cost for an input token at `curIdx` when marking all tokens as deletable in `Parser.prototype.remainingTokensDeletablesLookup()` (after failing the initial parse).
 *
 * Each deletable has a cost of 10 plus an epsilon value which decreases for each index. This enables sorting of output suggestions, which would otherwise have identical costs, to favor deletions closer to the query's end, limiting disorientation.
 *
 * For example, given the input "my JavaScript Ruby Swift repos", the output suggestions are sorted as follows:
 *   "my JavaScript repos"
 *   "my Ruby repos"
 *   "my Swift repos"
 *
 * Without the epsilon value, these suggestions would have identical costs that yield arbitrary, disorienting sorting.
 *
 * @private
 * @static
 * @param {number} curIdx The index of the token to mark deletable.
 * @param {number} lastIdx The index of the last token in input.
 * @returns {number} Returns the deletion cost for the token at `curIdx`.
 */
function remainingTokenDeletableCost(curIdx, lastIdx) {
	return 10 + 1e-7 * (lastIdx - curIdx)
}

/**
 * Adds nodes that combine deletables in `deletions` with the single token matches in `terminalSymTab`, with spans and cost penalties that include the adjacent deletables. Adds deletions for multi-token entity matches to `entityTab` for use by `Parser.prototype.mergeEntityMatches()`.
 *
 * Invoke this method after `Parser.prototype.deletablesLookup()`, which search the input query tokens for deletables.
 *
 * @memberOf Parser
 * @param {boolean} [onlyNewDeletables] Specify this invocation is after failing the initial parse, and to only add nodes using the new deletables.
 */
Parser.prototype.addDeletions = function (onlyNewDeletables) {
	// Add nodes for every possible continuous span of deletables to the following terminal symbol match.
	var lastIdx = this.tokensLen - 1
	for (var curIdx = 0; curIdx < this.tokensLen; ++curIdx) {
		this.matchedSymbols = this.terminalSymTab[curIdx]

		// Add nodes for deletions that precede a terminal symbol to last index of the match's span.
		this.symIdToNodesMap = this.nodeTabs[curIdx]
		this.termRuleMatches = this.termRuleMatchTab[curIdx]

		var seenNewDeletable = !onlyNewDeletables
		var delStartIdx = curIdx
		var deletionCost = 0
		var deletion

		// Step backward checking for continuous spans of deletable tokens that end at the start of this terminal symbol.
		while (deletion = this.deletions[--delStartIdx]) {
			deletionCost += deletion.cost

			// When parsing after failing the initial parse, only add deletions that contain new deletables (where `cost` is 10) to avoid duplicate deletion spans.
			if (seenNewDeletable || deletion.cost >= 10) {
				seenNewDeletable = true

				// Add nodes based on `terminalSymTab` for the span beginning with the deletable(s) at `delStartIdx` and ending with each terminal symbol. Each new node has a cost penalty equal to the sum of deletables.
				this.addDeleltionToAdjacentSymbolMatches(delStartIdx, curIdx, deletionCost, onlyNewDeletables)
			}
		}

		// Check if all remaining tokens in input (that follow this terminal symbol) are deletable.
		if ((deletion = this.deletions[curIdx + 1]) && curIdx + deletion.length === lastIdx) {
			// Add nodes for deletions that extend to the end of the input query to the last index.
			this.symIdToNodesMap = this.nodeTabs[lastIdx]
			this.termRuleMatches = this.termRuleMatchTab[lastIdx]

			// When parsing after failing the initial parse, only add deletions for new spans of deletables that extend to the end of input as denoted by `isNew`.
			seenNewDeletable = !onlyNewDeletables || deletion.isNew
			delStartIdx = curIdx
			// The total deletion cost of the continuous span of deletables that follow this deletion to the end of input.
			deletionCost = deletion.followingCost

			// Add nodes for deletions spanning from the adjacent terminal symbol to the continuous span of deletions that extend to the end of input, and for each distinct span of preceding deletables found above, if any, to the same span of deletions that extend to the end of input. Each new node has a cost penalty equal to the sum of deletables.
			do {
				deletionCost += deletion.cost

				// When parsing after failing the initial parse, only add deletions that contain new deletables (where `cost` is 10) to avoid duplicate deletion spans.
				if (seenNewDeletable || deletion.cost >= 10) {
					seenNewDeletable = true

					this.addDeleltionToAdjacentSymbolMatches(delStartIdx, lastIdx, deletionCost, onlyNewDeletables)
				}
			} while (deletion = this.deletions[--delStartIdx])
		}
	}
}

/**
 * Adds nodes for the single token terminal symbol matches (in `terminalSymTab`) adjacent to the specified deletable, with spans and cost penalties that include the deletable. For multi-token entities, adds matches to `entityTab` with the deletion's parameters, for which `Parser.prototype.mergeEntityMatches()` will add nodes.
 *
 * @memberOf Parser
 * @param {number} delStartIdx The start index within the input query of the deletion and adjacent terminal symbol match.
 * @param {number} delEndIdx The end index within the input query of the deletion and adjacent terminal symbol match.
 * @param {number} deletionCost The cost penalty for the deletion.
 * @param {boolean} [onlyNewDeletables] Specify this invocation is after failing the initial parse, and to mark entities added to `entityTab` as `new` (for use by `Parser.prototype.mergeEntityMatches()`).
 */
Parser.prototype.addDeleltionToAdjacentSymbolMatches = function (delStartIdx, delEndIdx, deletionCost, onlyNewDeletables) {
	// Add nodes for deletables that precede each terminal node and/or follow each terminal node if at the end of input. Traverses `matchedSymbols` instead of `termRuleMatchTab`, because the latter will include the matches with deletions.
	for (var s = 0, matchedSymbolsLen = this.matchedSymbols.length; s < matchedSymbolsLen; ++s) {
		var symbolObj = this.matchedSymbols[s]

		// Add multi-token entity matches (denoted by presence of `symbolObj.entityMatch`) to `entityTab` at `delEndIdx` (instead of adding nodes here) for use by `Parser.prototype.mergeEntityMatches()`. This enables merging adjacent token matches for the same entity while avoiding duplicates (i.e., ambiguity).
		var entityMatch = symbolObj.entityMatch
		if (entityMatch) {
			var entityMatches = this.entityTab[delEndIdx]

			// Add the match to `entityMatches`. If `onlyNewDeletables`, check for existing matches in `entityMatches`, which only occurs when `onlyNewDeletables` because otherwise there can not be a match for the same entity and length.
			var newIdx = onlyNewDeletables ? getEntityMatchIndex(entityMatches, entityMatch.entity, delStartIdx, deletionCost) : entityMatches.length
			if (newIdx !== -1) {
				entityMatches[newIdx] = {
					entity: entityMatch.entity,
					terminalSym: symbolObj.terminalSym,
					semanticArg: symbolObj.semanticArg,
					matchedTokens: entityMatch.matchedTokens,
					startIdx: delStartIdx,
					deletionsCost: deletionCost,
					hasAmbigUniTokenAlias: entityMatch.hasAmbigUniTokenAlias,
					hasNewDeletable: onlyNewDeletables,
				}
			}
		} else {
			// Add nodes at `delEndIdx` for the adjacent single-token entity or terminal symbol match, with a span and cost penalty that includes the specified deletion.
			this.addTermRuleNodes(symbolObj.terminalSym, delStartIdx, delEndIdx, symbolObj.semanticArg, symbolObj.text, deletionCost)
		}
	}
}

/**
 * Adds nodes for the terminal rules that produce `terminalSym`, with `ruleProps` that integrate semantic arguments, display text, or cost penalties (e.g., deletions), if any.
 *
 * @memberOf Parser
 * @param {Object} terminalSym The matched terminal symbol from the `StateTable`.
 * @param {number} startIdx The start index within the input query of the terminal symbol match.
 * @param {number} endIdx The end index within the input query of the terminal symbol match.
 * @param {Object[]} [semanticArg] The semantic argument of the terminal symbol match for integer symbols and entities, which input determines and grammar does not define.
 * @param {string} [text] The display text of the terminal symbol match for integer symbols and entities, which input determines and grammar does not define.
 * @param {number} [costPenalty] The cost penalty associated with the terminal symbol match. This can be a deletion cost for adjacent symbols, or an insertion cost for a partial match to a multi-token entity.
 */
Parser.prototype.addTermRuleNodes = function (terminalSym, startIdx, endIdx, semanticArg, text, costPenalty) {
	// The span of the terminal symbol match, including deletions.
	var wordSize = endIdx - startIdx + 1

	/**
	 * The unique node for `terminalSym`. `matchTerminalRules` ensures there is only one match per terminal symbol per index. Hence, even without checking existing nodes, there will be no duplicate terminal nodes at the same index (like nonterminal nodes).
	 *
	 * However, there can be multiple matches at the same index for the same entity category, which is the same terminal symbol, though for different entities within the category. The node's parent subnode's `ruleProps` distinguishes these terminal nodes.
	 *
	 * If a terminal symbol is deleted in input, either because it is a grammar-defined deletable or when reparsing with all tokens marked deletable, then there can be duplicate instances of a non-entity terminal node at the same index. Though, it is rare. For example:
	 *   "followers of mine mine"
	 * "mine" and "mine" will obviously be the same terminal rule. With "mine" marked deletable, there will be two subnodes for the same LHS symbol, spanning the last two input tokens: "mine <mine>", "<mine> mine".
	 * • A terminal node table would detect these duplicate instances of the same LHS symbol over the same span, similar to the nonterminal node table, but the overhead is too great for such rarity (even if the table is only used during the second parse).
	 * • The duplicate terminal nodes are not problematic, because if the terminal rule is part of a term sequence (i.e., a terminal rule set), then `calcHeuristicCosts` chooses the cheapest match. Otherwise, `pfsearch` only keeps the cheapest resultant parse tree.
	 */
	var terminalNode = {
		sym: terminalSym,
		size: wordSize,
		startIdx: startIdx,
		// The heuristic estimate of the minimum cost to complete the parse tree from this node, for use in `calcHeuristicCosts`.
		minCost: 0,
	}

	// The terminal rules that produce `terminalSym`.
	var rules = terminalSym.rules
	// The parse nodes for `rules`.
	var termRuleNodes = []
	// The cost penalty associated with the terminal symbol match. This can be a deletion cost for adjacent symbols, or an insertion cost for a partial match to a multi-token entity.
	if (costPenalty === undefined) costPenalty = 0

	// Add a node for each terminal rule that produces `terminalSym`.
	for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
		var rule = rules[r]

		var terminalSub = {
			node: terminalNode,
			size: wordSize,
			ruleProps: undefined,
		}

		if (semanticArg) {
			// Create a new `ruleProps` for entity and integer symbol matches, with a semantic argument and display text created from input.
			var origRuleProps = rule.ruleProps
			terminalSub.ruleProps = {
				cost: origRuleProps.cost + costPenalty,
				semantic: origRuleProps.semantic ? semanticReduce(origRuleProps.semantic, semanticArg) : semanticArg,
				text: text,
			}
		} else if (costPenalty) {
			// Create a new `ruleProps` for terminal symbol matches with adjacent deletions.
			var origRuleProps = rule.ruleProps
			terminalSub.ruleProps = {
				cost: origRuleProps.cost + costPenalty,
				semantic: origRuleProps.semantic,
				text: origRuleProps.text,
				/**
				 * Maintain terminal symbol input tense following a deletion. For use by parent rules with `acceptedTense`, which specifies a tense to accept when input but not to enforce if otherwise (i.e., tense is optional because semantically meaningless). For example:
				 *   "repos I do liked" -> "repos I liked"
				 */
				tense: origRuleProps.tense,
			}
		} else {
			terminalSub.ruleProps = rule.ruleProps
		}

		// Create a node with the LHS of the terminal rule. (In `StateTable`, the LHS of terminal rules is `rhs`.)
		var node = this.addSub(rule.rhs[0], terminalSub)
		// If `node` did not already exists (for another subnode at this index), then add it to the current index of `termRuleMatchTab`.
		if (node) {
			termRuleNodes.push(node)
		}
	}

	if (termRuleNodes.length > 0) {
		// Save the (new) nodes for the terminal rules for `terminalSym` to the last index of the match's span (including deletions) within the input query.
		this.termRuleMatches.push({
			startIdx: startIdx,
			nodes: termRuleNodes,
		})
	}
}

/**
 * Gets the semantic argument for `semanticArgName` if it exists, else creates and returns a new semantic argument. This prevents duplicate semantic arguments in the parse forest to enable equality checks by object reference (as opposed to having to check the semantic `name` property).
 *
 * @memberOf Parser
 * @param {string} semanticArgName The semantic argument name.
 * @param {string} [anaphoraPersonNumber] The grammatical person-number with which to resolve anaphora (of matching person-number), where this semantic is the antecedent.
 * @returns {Object[]} Returns the semantic argument for `semanticArgName`.
 */
Parser.prototype.getSemanticArg = function (semanticArgName, anaphoraPersonNumber) {
	return this.semanticArgTab[semanticArgName] || (this.semanticArgTab[semanticArgName] = [ {
		semantic: {
			name: semanticArgName,
			anaphoraPersonNumber: anaphoraPersonNumber,
		}
	} ])
}

/**
 * Appends to the end of `nodeTabs` an array with the node that produces the `<blank>` symbol to enable insertion rules that are only recognized at the end of the input query.
 *
 * The node has `size` of 0, which enable the returned parse forest to include both trees that end with the `<blank>` symbol and those without, which would otherwise be excluded because of a different size (and seemingly not spanning the entire input).
 *
 * @memberOf Parser
 */
Parser.prototype.addBlankNode = function () {
	this.termRuleMatchTab[this.tokensLen] = [ {
		startIdx: this.tokensLen,
		nodes: this.stateTable.blankNodeArray,
	} ]
}