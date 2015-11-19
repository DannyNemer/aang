var util = require('../util/util')
var g = require('./grammar')


// Used to match regex-style terminal symbols.
var reRegexSymbol = /[ |]/

// The map of the grammar's nonterminal symbols to rules.
var _ruleSets

/**
 * Splits the grammar's regex-style terminal symbols into rules that yield only uni-token terminal symbols. This is necessary to enable partial matches and deletions within what would otherwise be regex-style terminal symbols.
 *
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 */
module.exports = function (ruleSets) {
	_ruleSets = ruleSets

	forEachTerminalRule(function (rule) {
		var terminalSymbol = rule.RHS[0]

		if (reRegexSymbol.test(terminalSymbol)) {
			// Temporarily only split regex-style terminal symbols used in substitutions.
			if (rule.isSubstitution || rule.isStopWord) {
				// Replace the terminal symbol with nonterminal symbols that produce the individual tokens.
				rule.RHS = splitRegexTerminalSymbol(terminalSymbol, createTerminalRuleSet)

				// Temporarily add to comply with `createEditRules`, which will remove this property.
				rule.gramProps = {}

				// Define the rule as nonterminal.
				delete rule.isTerminal
			}
		}
	})
}

/**
 * Tokenizes `terminalSymbol` by spaces, denoting a separate token set at each term index, and invokes `createTerminalRuleSetFunc` for each set with one argument: (tokenSet). `createTerminalRuleSetFunc` returns the name of a symbol that produces the tokens in the set. Creates an array of nonterminal symbol names that produces the token sets in `terminalSymbol` for use as a nonterminal rule's `RHS`.
 *
 * @private
 * @static
 * @param {string} terminalSymbol The regex-style terminal symbol to split into a tree of single-token terminal rules.
 * @param {Function} createTerminalRuleSetFunc The function invoked per token set.
 * @returns {string[]} Returns an array of nonterminal symbol names that produce `terminalSymbol` for use as a nonterminal rule's `RHS`.
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
			// Return the array of `Symbol`s that produces `terminalSymbol` for use as a nonterminal rule's `RHS`.
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
					// Use `name` property because cannot get existing `Symbol` instances, only their names.
					prevSymbolName = g.newBinaryRule({ RHS: [ prevSymbolName, newSymbolName ] }).name
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
function createTerminalRuleSet(tokenSet) {
	// Get the name of an existing nonterminal symbol that produces `tokenSet`, if any.
	var newSymbolName = getTokenSetSymbolName(tokenSet)

	if (!newSymbolName) {
		// Create a new terminal rule set for `tokenSet`.
		newSymbol = g.newSymbol(tokenSet, 'blank')

		forEachToken(tokenSet, function (token) {
			newSymbol.addRule({
				isTerminal: true,
				// Use `token` as `text` for non-substitutions. Nonterminal substitutions will not traverse the rule's RHS, and therefore will not use these rules' `text` values.
				RHS: token === '' ? g.emptySymbol : token,
			})
		})

		// Use `name` property because cannot get existing `Symbol` instances, only their names.
		newSymbolName = newSymbol.name
	}

	return newSymbolName
}

/**
 * Gets the name of an existing nonterminal symbol that produces the tokens in `tokenSet`, if any.
 *
 * @private
 * @static
 * @param {string} tokenSet The terminal symbol with instances of the `|` character denoting different acceptable terms for a single token index.
 * @returns {string|undefined} Returns the name of the nonterminal symbol that produces `tokenSet` if it exists, else `undefined`.
 */
function getTokenSetSymbolName(tokenSet) {
	// Sorts `tokenSet` alphabetically to find an existing terminal rule set that produces the same terminal symbols regardless of the rule order.
	var regexStr = tokenSet.split('|').sort().join('|')

	for (var symbolName in _ruleSets) {
		// Check if the `symbolName` produces the same terminal rule set (regardless of rule order).
		if (symbolToRegex(symbolName) === regexStr) {
			return symbolName
		}
	}
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
			var rhs = rules[0].RHS

			// Check if each pair of `RHS` symbols produces the same terminal symbols regardless of rule structure (e.g., terminal rule set order).
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
			return rule.RHS.map(symbolToRegex).join(' ')
		}
	}

	// Reject rules that do not produce only terminal rules or do not produce only a single binary nonterminal rule.
	for (var r = 0; r < rulesLen; ++r) {
		if (!rules[r].isTerminal) return
	}

	// Return a string representation of the the terminal rule set with the different accepted symbols separated by the `|` character, sorted alphabetically to detect identical rule sets irrespective of rule definition order.
	return rules.map(function (rule) {
		return rule.RHS[0]
	}).sort().join('|')
}

/**
 * Iterates over rules in the nonterminal grammar invoking `iteratee` for each terminal rule. `iteratee` is invoked with one argument: (terminalRule).
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
 * Iterates over token sets in `terminalSymbol`, invoking `predicate` for each token set. Iteration stops if `predicate` returns truthy, and returns its return value. `predicate` is invoked with two arguments: (tokenSet, isLastSet).
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
 * Iterates over tokens in `tokenSet`, invoking `iteratee` for each token. `iteratee` is invoked with one argument: (token).
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