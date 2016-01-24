var util = require('../util/util')
var g = require('./grammar')


// Matches regex-style terminal symbols.
var reRegexSymbol = /[ |]/
// Matches multi-token terminal symbols.
var reMultiTokenSymbol = / /
// Matches terminal symbols without the regex `|` character for logical OR.
var reNoRegexLogicalOr = /^[^|]+$/

// The map of the grammar's nonterminal symbols to rules.
var _ruleSets

/**
 * Converts the grammar's regex-style terminal symbols into rules that yield only uni-token terminal symbols. This is necessary to enable partial matches and deletions within what would otherwise be regex-style terminal symbols.
 *
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 */
module.exports = function (ruleSets) {
	_ruleSets = ruleSets

	// Calculate the insertion cost, if any, of each lexical token in the grammar.
	var insertionCosts = calculateInsertionCosts()

	createTerminalRuleSet = createTerminalRuleSet.bind(null, insertionCosts)

	forEachTerminalRule(function (rule) {
		// Convert regex-style terminal rules to nonterminal rules that produce the terminal symbol's individual tokens.
		if (reRegexSymbol.test(rule.rhs[0])) {
			convertNonterminalRuleToTerminal(rule, createTerminalRuleSet)
		}
	})
}

/**
 * Converts `rule`, which is a terminal rule with a regex-style terminal symbol, to a nonterminal rule by replacing the RHS terminal symbol with nonterminal symbols that produce the individual tokens, and updating the associated rule properties accordingly.
 *
 * To convert the terminal rule's `rhs`, tokenizes its terminal symbol by spaces, denoting a separate token set at each term index, and invokes `createTerminalRuleSetFunc` for each set with one argument: (tokenSet). `createTerminalRuleSetFunc` must return the name of a symbol that produces the tokens in the set.
 *
 * @private
 * @static
 * @param {Object} rule The terminal rule to convert.
 * @param {Function} createTerminalRuleSetFunc The function invoked per token set.
 */
function convertNonterminalRuleToTerminal(rule, createTerminalRuleSetFunc) {
	// Replace the terminal symbol with nonterminal symbols that produce the individual tokens.
	rule.rhs = splitRegexTerminalSymbol(rule.rhs[0], createTerminalRuleSetFunc)

	// Temporarily add to comply with `createEditRules`, which will remove this property.
	rule.gramProps = {}

	// Specify nonterminal rules whose RHS produces neither display text nor semantics. This enables `calcHeuristicCosts` to reduce the associated node's subnode's costs (which include deletion costs on the terminal nodes) so that `pfsearch` does not wastefully traverse those subnodes. This includes nonterminal substitutions and stop-words created from regex-style terminal rules, and rules that produce only stop-words. In addition, this enables these nonterminal rules to share existing terminal rules that also have `text` values by only using their `text` value and not traversing those nodes.
	rule.rhsDoesNotProduceText = rule.isStopWord || rule.isSubstitution || rule.text instanceof Object || reNoRegexLogicalOr.test(rule.text)

	// Define the rule as nonterminal.
	delete rule.isTerminal
}

/**
 * Tokenizes `terminalSymbol` by spaces, denoting a separate token set at each term index, and invokes `createTerminalRuleSetFunc` for each set with one argument: (tokenSet). `createTerminalRuleSetFunc` must return the name of a symbol that produces the tokens in the set. Creates an array of nonterminal symbol names that produces the token sets in `terminalSymbol` for use as a nonterminal rule's `rhs`.
 *
 * @private
 * @static
 * @param {string} terminalSymbol The regex-style terminal symbol to split into a tree of single-token terminal rules.
 * @param {Function} createTerminalRuleSetFunc The function invoked per token set.
 * @returns {string[]} Returns an array of nonterminal symbol names that produce `terminalSymbol` for use as a nonterminal rule's `rhs`.
 */
function splitRegexTerminalSymbol(terminalSymbol, createTerminalRuleSetFunc) {
	// Check `terminalSymbol` is a regex-style symbol.
	if (!reRegexSymbol.test(terminalSymbol)) {
		throw new Error('Terminal symbol is not a regex-style symbol:', terminalSymbol)
	}

	var prevSymbolName

	// Create rules that produce the tokens in `terminalSymbol`.
	return forEachTokenSet(terminalSymbol, function (tokenSet, isLastSet) {
		// Gets the name of a symbol that produces `tokenSet`.
		var newSymbolName = createTerminalRuleSetFunc(tokenSet)

		if (isLastSet) {
			// Return the array of `NSymbol`s that produces `terminalSymbol` for use as a nonterminal rule's `rhs`.
			if (prevSymbolName) {
				return [ prevSymbolName, newSymbolName ]
			} else {
				return [ newSymbolName ]
			}
		} else {
			// Create a binary rule using the symbol that produces the previous token sets and the new symbol for this token set.
			if (prevSymbolName) {
				// Get the name of an existing nonterminal symbol that produces the binary rule, if any.
				var parentSymbolName = getBinarySymbolName(prevSymbolName, newSymbolName)

				if (parentSymbolName) {
					prevSymbolName = parentSymbolName
				} else {
					// Use `name` property because cannot get existing `NSymbol` instances, only their names.
					prevSymbolName = g.newBinaryRule({ rhs: [ prevSymbolName, newSymbolName ] }).name
				}
			} else {
				prevSymbolName = newSymbolName
			}
		}
	})
}

/**
 * Gets the name of a symbol that produces the tokens in `tokenSet`, delimited by the `|` character`. Creates a new terminal rule set if no existing set exists.
 *
 * @param {string} tokenSet The token set for which to produce rules.
 * @returns {string} Returns the name of the symbol that produces `tokenSet`.
 */
function createTerminalRuleSet(insertionCosts, tokenSet) {
	// Get the name of an existing nonterminal symbol that produces `tokenSet`, if any.
	var newSymbolName = getTokenSetSymbolName(tokenSet)
	if (newSymbolName) return newSymbolName

	// Create a new terminal rule set for `tokenSet`.
	var newSymbol = g.newSymbol(tokenSet, 'blank')

	forEachToken(tokenSet, function (token) {
		var newRule = {
			isTerminal: true,
		}

		if (token === '') {
			newRule.rhs = g.emptySymbol
		} else {
			// Assign `token` as `text` because the original (now nonterminal) rule defines `rhsDoesNotProduceText` as `true`, preventing the `text` values on the rules it produces from being read; hence, this does not affect it, but allows this terminal rule set to be shared by other rules that need its `text` value.
			newRule.rhs = token
			newRule.text = token

			if (insertionCosts.hasOwnProperty(token)) {
				newRule.insertionCost = insertionCosts[token]
			}
		}

		newSymbol.addRule(newRule)
	})

	// Use `name` property because cannot get existing `NSymbol` instances, only their names.
	return newSymbol.name
}

/**
 * Gets the name of an existing nonterminal symbol that produces the tokens in `tokenSet`, if any.
 *
 * @private
 * @static
 * @param {string} tokenSet The terminal symbol with instances of the `|` character denoting different acceptable terms for a single token index.
 * @param {number} [insertionCost] The insertion cost for which the symbol that produces `tokenSet` must match.
 * @returns {string|undefined} Returns the name of the nonterminal symbol that produces `tokenSet` if it exists, else `undefined`.
 */
function getTokenSetSymbolName(tokenSet, insertionCost) {
	// Sorts `tokenSet` alphabetically to find an existing terminal rule set that produces the same terminal symbols regardless of the rule order.
	var regexStr = tokenSet.split('|').sort().join('|')

	for (var symbolName in _ruleSets) {
		// Check if the `symbolName` produces the same terminal rule set (regardless of rule order).
		if (symbolToRegex(symbolName) === regexStr) {
			// If `insertionCost` is provided, check the rule set produces that insertion cost.
			if (insertionCost === undefined || getTokenSetSymbolInsertionCost(symbolName) === insertionCost) {
				return symbolName
			}
		}
	}
}

/**
 * Gets the total insertion cost of the terminal rule sets `symbolName` produces.
 *
 * @param {string} symbolName The name of the symbol whose rightmost terminal symbols' insertion costs to sum.
 * @returns {number} Returns the total insertion cost produced by the symbol named `symbolName`.
 */
function getTokenSetSymbolInsertionCost(symbolName) {
	var rules = _ruleSets[symbolName]
	var rulesLen = rules.length

	// If the symbol produces a single binary nonterminal rule, then recursively sum the insertion costs of the terminal rules it produces.
	if (rulesLen === 1) {
		var rule = rules[0]
		if (!rule.isTerminal) {
			return rule.rhs.reduced(function (accumInsertionCost, rhsSymbolName) {
				return accumInsertionCost + getTokenSetSymbolInsertionCost(rhsSymbolName)
			}, 0)
		}
	}

	// Reject rules that do not produce only terminal rules or do not produce only a single binary nonterminal rule.
	for (var r = 0; r < rulesLen; ++r) {
		if (!rules[r].isTerminal) {
			throw 'getTokenSetSymbolInsertionCost only accepts symbols that produce a regex-style terminal string'
		}
	}

	// Determine this terminal rule set's smallest insertion cost.
	var minInsertCost
	for (var r = 0; r < rulesLen; ++r) {
		var insertionCost = rules[r].insertionCost
		if (insertionCost !== undefined && (minInsertCost === undefined || insertionCost < minInsertCost)) {
			minInsertCost = insertionCost
		}
	}

	return minInsertCost
}

/**
 * Gets the name of an existing nonterminal symbol that produces a single binary nonterminal rule that yields the terminal symbols produced by `a` and `b`, if any.
 *
 * @private
 * @static
 * @param {string} a The name of the first RHS symbol.
 * @param {string} b The name of the second RHS symbol.
 * @returns {string|undefined} Returns the name of the nonterminal symbol that produces `a` and `b` if it exists, else `undefined`.
 */
function getBinarySymbolName(a, b) {
	for (var symbolName in _ruleSets) {
		var rules = _ruleSets[symbolName]

		// Check if the symbol produces a single binary nonterminal rule.
		if (rules.length === 1) {
			var rhs = rules[0].rhs

			// Check if each pair of `rhs` symbols produces the same terminal symbols regardless of rule structure (e.g., terminal rule set order).
			if (rhs.length === 2 && symbolsMatch(rhs[0], a) && symbolsMatch(rhs[1], b)) {
				return symbolName
			}
		}
	}
}

/**
 * Checks if nonterminal symbols `a` and `b` produce the same terminal symbols, irrespective of the structure of the rules they produce.
 *
 * @private
 * @static
 * @param {string} a The name of the symbol to compare.
 * @param {string} b The name of the other symbol to compare.
 * @returns {boolean} Returns `true` if `a` and `b` produce the same terminal symbols, else `false`.
 */
function symbolsMatch(a, b) {
	return a === b || symbolToRegex(a) === symbolToRegex(b)
}

/**
 * Creates a regex-style string representation of the terminal symbols produced by the nonterminal symbol `symbolName`. Used to determine if two nonterminal symbols accept the same terminal symbols, irrespective of the rules' structure (e.g., terminal rule set order).
 *
 * For example, the following rule produce the same regex-style string representation:
 * X -> Y -> 'a' 'b'      X -> 'a'
 *   -> 'c' | 'd' | 'e'     -> Z -> 'b'
 *                               -> 'e' | 'd' | 'c'
 * Both yield: 'a b c|d|e'
 *
 * @private
 * @static
 * @param {string} symbolName The name of the nonterminal symbol.
 * @returns {string} Returns the regex-style string representation of the terminal symbols produced by `symbolName`.
 */
function symbolToRegex(symbolName) {
	var rules = _ruleSets[symbolName]
	var rulesLen = rules.length

	// If `symbolName` produces a single binary nonterminal rule, return a string of the string representations produced by the rule's RHS symbols joined by a separating space.
	if (rulesLen === 1) {
		var rule = rules[0]
		if (!rule.isTerminal) {
			return rule.rhs.map(symbolToRegex).join(' ')
		}
	}

	// Reject rules that do not produce only terminal rules or do not produce only a single binary nonterminal rule.
	for (var r = 0; r < rulesLen; ++r) {
		if (!rules[r].isTerminal) return
	}

	// Return a string representation of the the terminal rule set with the different accepted symbols separated by the `|` character, sorted alphabetically to detect identical rule sets irrespective of rule definition order.
	return rules.map(function (rule) {
		return rule.rhs[0]
	}).sort().join('|')
}

/**
 * Calculates the insertion cost, if any, of each lexical token in the grammar.
 *
 * @returns {Object} Returns a map of lexical tokens to their insertion costs.
 */
function calculateInsertionCosts(nonterminalRuleSets) {
	// The map of lexical tokens to their insertion costs.
	var insertionCosts = {}

	// Get the insertion cost, if any, of each uni-token terminal symbol.
	forEachTerminalRule(function (rule) {
		var terminalSymbol = rule.rhs[0]
		if (rule.insertionCost !== undefined && !reMultiTokenSymbol.test(terminalSymbol)) {
			// Check if there are multiple insertion costs for the same symbol.
			var existingCost = insertionCosts[terminalSymbol]
			if (existingCost !== undefined && existingCost !== rule.insertionCost) {
				util.logError('Conflicting insertion costs:', util.stylize(terminalSymbol), '=', existingCost, 'vs.', rule.insertionCost)
				throw 'Conflicting insertion costs'
			}

			insertionCosts[terminalSymbol] = rule.insertionCost
		}
	})

	// Derive the insertion cost of each token in each multi-token terminal symbol with an insertion cost.
	forEachTerminalRule(function (rule) {
		var terminalSymbol = rule.rhs[0]
		if (rule.insertionCost !== undefined && reMultiTokenSymbol.test(terminalSymbol)) {
			// The number of tokens in `terminalSymbol` that do not yet have an insertion cost.
			var newTokensCount = terminalSymbol.split(' ').length
			var insertionCost = rule.insertionCost

			// Subtract the existing insertion costs, if any, of token sets in `terminalSymbol` from the symbol's total insertion cost.
			forEachTokenSet(terminalSymbol, function (tokenSet) {
				var minInsertCost

				// Get the cheapest insertion cost in the token set, if any.
				forEachToken(tokenSet, function (token) {
					var insertCost = insertionCosts[token]
					if (insertCost !== undefined && (minInsertCost === undefined || insertCost < minInsertCost)) {
						minInsertCost = insertCost
					}
				})

				if (minInsertCost !== undefined) {
					insertionCost -= minInsertCost
					--newTokensCount
				}
			})

			if (insertionCost >= 0) {
				// Evenly distribute the insertion cost for each token in `terminalSymbol` without an existing insertion cost.
				insertionCost /= newTokensCount

				forEachTokenSet(terminalSymbol, function (tokenSet) {
					forEachToken(tokenSet, function (token) {
						if (!insertionCosts.hasOwnProperty(token)) {
							insertionCosts[token] = insertionCost
						}
					})
				})
			} else {
				// If the sum of existing insertion costs, if any, of token sets in `terminalSymbol` is greater than `rule.insertionCost`, then create new rules for the token sets with `rule.insertionCost` evenly distributed.
				insertionCost = rule.insertionCost / terminalSymbol.split(' ').length

				// Convert regex-style the terminal rule to a nonterminal rule that produces the terminal symbol's individual tokens with this unique insertion cost.
				convertNonterminalRuleToTerminal(rule, createRulesWithUniqueInsertionCost.bind(null, insertionCost))
			}
		}
	})

	return insertionCosts
}

/**
 * Creates a terminal rule set that produces the tokens in `tokenSet` with `insertionCost` applied to the first terminal rule.
 *
 * @param {number} insertionCost The insertion cost to apply to `tokenSet`.
 * @param {string} tokenSet The token set for which to produce rules.
 * @returns {NSymbol} Returns the `NSymbol` that produces the terminal rules for `tokenSet`.
 */
function createRulesWithUniqueInsertionCost(insertionCost, tokenSet) {
	var newSymbolName = getTokenSetSymbolName(tokenSet, insertionCost)
	if (newSymbolName) return newSymbolName

	// Create a new terminal rule set if none exists for `tokenSet`.
	var newSymbol = g.newSymbol(tokenSet, insertionCost)

	var assignedInsertionCost = false
	forEachToken(tokenSet, function (token) {
		var newRule = {
			isTerminal: true,
		}

		if (token === '') {
			newRule.rhs = g.emptySymbol
		} else {
			// Assign `token` as `text` because the original (now nonterminal) rule defines `rhsDoesNotProduceText` as `true`, preventing the `text` values on the rules it produces from being read; hence, this does not affect it, but allows this terminal rule set to be shared by other rules that need its `text` value.
			newRule.rhs = token
			newRule.text = token

			// Add the insertion cost to the first non-empty token.
			if (!assignedInsertionCost) {
				newRule.insertionCost = insertionCost
				assignedInsertionCost = true
			}
		}

		newSymbol.addRule(newRule)
	})

	// Use `name` property because cannot get existing `NSymbol` instances, only their names.
	return newSymbol.name
}

/**
 * Iterates over rules in the nonterminal grammar invoking `iteratee` for each terminal rule. Invokes `iteratee` with one argument: (terminalRule).
 *
 * @param {Function} iteratee The function invoked per iteration.
 */
function forEachTerminalRule(iteratee) {
	for (var nonterminalSymbol in _ruleSets) {
		var rules = _ruleSets[nonterminalSymbol]

		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]

			// Skip placeholder symbols, which are not accepted in input.
			if (rule.isTerminal && !rule.isPlaceholder) {
				iteratee(rule)
			}
		}
	}
}

/**
 * Iterates over token sets in `terminalSymbol`, invoking `predicate` for each token set. Iteration stops if `predicate` returns truthy, and returns its return value. Invokes `predicate` with two arguments: (tokenSet, isLastSet).
 *
 * @param {string} terminalSymbol The terminal symbol to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {*} Returns the value returned by `predicate`, if any.
 */
function forEachTokenSet(terminalSymbol, predicate) {
	var tokenSets = terminalSymbol.split(' ')
	var tokenSetsLen = tokenSets.length

	for (var t = 0; t < tokenSetsLen; ++t) {
		var returnVal = predicate(tokenSets[t], t === tokenSetsLen - 1)
		if (returnVal) return returnVal
	}
}

/**
 * Iterates over tokens in `tokenSet`, invoking `iteratee` for each token. Invokes `iteratee` with one argument: (token).
 *
 * @param {string} tokenSet The string of tokens, separated by `|`, to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 */
function forEachToken(tokenSet, iteratee) {
	var tokens = tokenSet.split('|')
	var tokensLen = tokens.length

	for (var t = 0; t < tokensLen; ++t) {
		iteratee(tokens[t])
	}
}