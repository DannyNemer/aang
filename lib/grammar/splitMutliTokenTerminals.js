var util = require('../util/util')
var g = require('./grammar')


// Used to match multi-token terminal symbols.
var reMultiToken = /[ |]/

// The map of the grammar's nonterminal symbols to rules.
var _ruleSets

/**
 * Splits the grammar's multi-token terminal symbols into rules that yield only uni-token terminal symbols. This is necessary to enable partial matches and deletions within what would otherwise be multi-token terminal symbols.
 *
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 */
module.exports = function (ruleSets) {
	_ruleSets = ruleSets

	for (var symbol in ruleSets) {
		var rules = ruleSets[symbol]

		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]

			if (rule.isTerminal) {
				var terminalSymbol = rule.RHS[0]

				// Temporarily only split multi-token terminal symbols used in substitutions.
				if (rule.isSubstitution) {
					if (reMultiToken.test(terminalSymbol)) {
						// Replace the terminal symbol with nonterminal symbols that produce the individual tokens.
						rule.RHS = splitMutliTokenTerminal(terminalSymbol)

						// Temporarily add to comply with `createEditRules`, which will remove this property.
						rule.gramProps = {}

						// Define the rule as nonterminal.
						delete rule.isTerminal
					}

					// Delete temporary property.
					delete rule.isSubstitution
				}
			}
		}
	}
}

/**
 * Tokenizes `terminalSymbol` by spaces (denoting separate terms indexes) and the `|` character (denoting different acceptable terms for that single index). Creates an array of nonterminal symbol names that produce the individual tokens for use as a nonterminal rule's `RHS`.
 *
 * @private
 * @static
 * @param {string} terminalSymbol The multi-token terminal symbol to split into a tree of single-token terminal rules.
 * @returns {string[]} Returns an array of nonterminal symbol names that produce `terminalSymbol` for use as a nonterminal rule's `RHS`.
 */
function splitMutliTokenTerminal(terminalSymbol) {
	// Check `terminalSymbol` is a multi-token symbol.
	if (!reMultiToken.test(terminalSymbol)) {
		throw new Error('Terminal symbol is not a multi-token symbol:', terminalSymbol)
	}

	var prevSymbolName

	// Create rules that produce the tokens in `terminalSymbol`.
	var tokenSets = terminalSymbol.split(' ')
	for (var s = 0, tokenSetsLen = tokenSets.length; s < tokenSetsLen; ++s) {
		var tokenSet = tokenSets[s]

		// Get the name of an existing nonterminal symbol that produces `tokenSet`, if any.
		var newSymbolName = getTokenSetSymbolName(tokenSet)

		if (!newSymbolName) {
			// Create a new terminal rule set if none exists for `tokenSet`.
			newSymbol = g.newSymbol(tokenSet, 'blank')

			var tokens = tokenSet.split('|')
			for (var t = 0, tokensLen = tokens.length; t < tokensLen; ++t) {
				var token = tokens[t]

				var newRule = {
					isTerminal: true,
				}

				if (token === '') {
					newRule.RHS = g.emptySymbol
				} else {
					newRule.RHS = token
					// Temporarily only split multi-token terminal symbols used in substitutions.
					// newRule.text = token
					newRule.text = ''
				}

				newSymbol.addRule(newRule)
			}

			// Only use the `Symbol` `name` property because cannot get existing `Symbol` instances, only their names.
			newSymbolName = newSymbol.name
		}

		if (s === tokenSetsLen - 1) {
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
					// use the `name`
					prevSymbolName = g.newBinaryRule({ RHS: [ prevSymbolName, newSymbolName ] }).name
				}
			} else {
				prevSymbolName = newSymbolName
			}
		}
	}
}

/**
 * Gets the name of an existing nonterminal symbol that produces `tokenSet`, if any.
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

	// Reject rules that do not produce only terminal rules, do not produce only a single binary nonterminal rule, or produce a terminal rule with an insertion cost (this is a temporary restriction).
	for (var r = 0; r < rulesLen; ++r) {
		var rule = rules[r]
		if (!rule.isTerminal || rule.insertionCost !== undefined) return
	}

	// Return a string representation of the the terminal rule set with the different accepted symbols separated by the `|` character, sorted alphabetically to detect identical rule sets irrespective of rule definition order.
	return rules.map(function (rule) {
		return rule.RHS[0]
	}).sort().join('|')
}