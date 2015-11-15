/**
 * Generates a terminal grammar from the terminal symbols in the nonterminal grammar:
 * - Multi-token terminal symbols are split into uni-token terminal symbols.
 * - Insertion costs are distributed across identical tokens to generate insertion rules, which enables partial matches for multi-token terminal symbols.
 */

var util = require('../util/util')
var g = require('../grammar/grammar')
var genSymbolName = require('../grammar/symbol').genName


// Modify stack trace format (when printing) to color function names and not surround file paths with parentheses.
util.prettifyStackTrace()

// The map of symbol names to `Symbol` instances created for the terminal grammar.
var symbolMap = {}

// The nonterminal grammar's rules.
var nonterminalRuleSets = require('../grammar.json').ruleSets

// Calculate the insertion cost, if any, of each lexical token in the nonterminal grammar.
var insertionCosts = calculateInsertionCosts(nonterminalRuleSets)

// Create rules that produce each terminal symbol in the nonterminal grammar.
forEachTerminalRule(nonterminalRuleSets, function (rule) {
	addSymbol(rule.RHS[0], createTerminalRules.bind(null, insertionCosts))
})

// Create and add insertion rules to the grammar.
g.createEditRules(false, true)

// Remove `[blank-inserted]` added by `createEditRules`.
g.checkForUnusedComponents(true)

// Sort and output grammar to file.
g.sortGrammar()
var outputPath = './terminalGrammar.json'
g.printRuleCount(outputPath)
g.writeGrammarToFile(outputPath)


/**
 * Creates rules that produce the tokens in `terminalSymbol`, and adds them to the terminal grammar, invoking `createTerminalRuleSet` for each token set. `createTerminalRuleSet` is invoked with one argument, `tokenSet`, and returns a `Symbol` which produces the rules in `tokenSet`.
 *
 * @param {string} terminalSymbol The terminal symbol of token sets from which to produce rules.
 * @param {Function} createTerminalRuleSet The function invoked per token set.
 */
function addSymbol(terminalSymbol, createTerminalRuleSet) {
	// Exit if `terminalSymbol` is unique.
	if (startRuleExists(terminalSymbol)) return

	var prevSymbol

	// Create rules that produce the tokens in `terminalSymbol`.
	forEachTokenSet(terminalSymbol, function (tokenSet) {
		// Creates rules that produces the tokens in `tokenSet`.
		var newSymbol = createTerminalRuleSet(tokenSet)

		// Create a binary rule using the symbol which produces the previous token sets and the new symbol for this token set.
		if (prevSymbol) {
			var parentSymbol = symbolMap[genSymbolName(prevSymbol.name, newSymbol.name)]

			if (parentSymbol) {
				prevSymbol = parentSymbol
			} else {
				prevSymbol = g.newBinaryRule({ RHS: [ prevSymbol, newSymbol ] })
				symbolMap[prevSymbol.name] = prevSymbol
			}
		} else {
			prevSymbol = newSymbol
		}
	})

	// Add the symbol that produces `terminalSymbol`, which is already known to be unique, to the start symbol.
	g.startSymbol.addRule({ RHS: [ prevSymbol ], symbol: terminalSymbol })
}

/**
 * Creates terminal rules that produce the tokens in `tokenSet`, with the insertion costs, if any, for each token.
 *
 * @param {Object} insertionCosts The map of lexical tokens to their insertion costs.
 * @param {string} tokenSet The token set for which to produce rules.
 * @returns {Symbol} Returns the `Symbol` which produces the terminal rules for `tokenSet`.
 */
function createTerminalRules(insertionCosts, tokenSet) {
	var newSymbolName = genSymbolName(tokenSet)
	var newSymbol = symbolMap[newSymbolName]

	if (!newSymbol) {
		// Create a new terminal rule set if none exists for `tokenSet`.
		newSymbol = g.newSymbol(newSymbolName)
		symbolMap[newSymbol.name] = newSymbol

		forEachToken(tokenSet, function (token) {
			var newRule = {
				isTerminal: true,
			}

			if (token === '') {
				newRule.RHS = g.emptySymbol
			} else {
				newRule.RHS = token
				newRule.text = token

				if (insertionCosts.hasOwnProperty(token)) {
					newRule.insertionCost = insertionCosts[token]
				}
			}

			newSymbol.addRule(newRule)
		})
	}

	return newSymbol
}

/**
 * Calculates the insertion cost, if any, of each lexical token in the nonterminal grammar.
 *
 * @param {Object} nonterminalRuleSets The map of the grammar's nonterminal symbols to rules.
 * @returns {Object} Returns a map of lexical tokens to their insertion costs.
 */
function calculateInsertionCosts(nonterminalRuleSets) {
	// The map of lexical tokens to their insertion costs.
	var insertionCosts = {}

	// Get the insertion cost, if any, of each uni-token terminal symbol.
	forEachTerminalRule(nonterminalRuleSets, function (rule) {
		var terminalSymbol = rule.RHS[0]
		if (rule.insertionCost !== undefined && terminalSymbol.indexOf(' ') === -1) {
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
	forEachTerminalRule(nonterminalRuleSets, function (rule) {
		var terminalSymbol = rule.RHS[0]
		if (rule.insertionCost !== undefined && terminalSymbol.indexOf(' ') !== -1) {
			// The number of tokens in `terminalSymbol` that do not yet have an insertion cost.
			var newTokensCount = terminalSymbol.split(' ').length
			var insertionCost = rule.insertionCost

			// Subtract the existing insertion costs, if any, of token sets in `terminalSymbol` from the symbol's total insertion cost.
			forEachTokenInSymbol(terminalSymbol, function (token) {
				if (insertionCosts.hasOwnProperty(token)) {
					--newTokensCount
					insertionCost -= insertionCosts[token]

					// Get only the first insertion cost for each token set.
					return true
				}
			})

			if (insertionCost >= 0) {
				// Evenly distribute the insertion cost for each token in `terminalSymbol` without an existing insertion cost.
				insertionCost /= newTokensCount

				forEachTokenInSymbol(terminalSymbol, function (token) {
					if (!insertionCosts.hasOwnProperty(token)) {
						insertionCosts[token] = insertionCost
					}
				})
			} else {
				// If the sum of existing insertion costs, if any, of token sets in `terminalSymbol` is greater than `rule.insertionCost`, then create new rules for the token sets with `rule.insertionCost` evenly distributed.
				insertionCost = rule.insertionCost / terminalSymbol.split(' ').length

				addSymbol(terminalSymbol, createRulesWithUniqueInsertionCost.bind(null, insertionCost))
			}
		}
	})

	return insertionCosts
}

/**
 * Creates terminal rules that produce the tokens in `tokenSet`, with `insertionCost` applied to the first terminal rule.
 *
 * @param {number} insertionCost The insertion cost to apply to `tokenSet`.
 * @param {string} tokenSet The token set for which to produce rules.
 * @returns {Symbol} Returns the `Symbol` which produces the terminal rules for `tokenSet`.
 */
function createRulesWithUniqueInsertionCost(insertionCost, tokenSet) {
	var newSymbolName = genSymbolName(tokenSet, insertionCost)
	var newSymbol = symbolMap[newSymbolName]

	if (!newSymbol) {
		// Create a new terminal rule set if none exists for `tokenSet`.
		newSymbol = g.newSymbol(newSymbolName)
		symbolMap[newSymbol.name] = newSymbol

		var assignedInsertionCost = false
		forEachToken(tokenSet, function (token) {
			var newRule = {
				isTerminal: true,
			}

			if (token === '') {
				newRule.RHS = g.emptySymbol
			} else {
				newRule.RHS = token
				newRule.text = token

				// Add the insertion cost to the first non-empty token.
				if (!assignedInsertionCost) {
					newRule.insertionCost = insertionCost
					assignedInsertionCost = true
				}
			}

			newSymbol.addRule(newRule)
		})
	}

	return newSymbol
}

function startRuleExists(terminalSymbol) {
	var rules = g.startSymbol.rules
	var rulesLen = rules.length

	for (var r = 0; r < rulesLen; ++r) {
		if (rules[r].symbol === terminalSymbol) {
			return true
		}
	}

	return false
}

/**
 * Iterates over rules in the nonterminal grammar invoking `iteratee` for each terminal rule.
 *
 * @param {Object} nonterminalRuleSets The map of the grammar's nonterminal symbols to rules to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 */
function forEachTerminalRule(nonterminalRuleSets, iteratee) {
	for (var nonterminalSymbol in nonterminalRuleSets) {
		var rules = nonterminalRuleSets[nonterminalSymbol]

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
 * Iterates over token sets in `terminalSymbol`, invoking `iteratee` for each token set. `iteratee` is invoked with one argument: (tokenSet).
 *
 * @param {string} terminalSymbol The terminal symbol to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 */
function forEachTokenSet(terminalSymbol, iteratee) {
	var tokenSets = terminalSymbol.split(' ')
	var tokenSetsLen = tokenSets.length

	for (var t = 0; t < tokenSetsLen; ++t) {
		iteratee(tokenSets[t])
	}
}

/**
 * Iterates over tokens in `tokenSet`, invoking `predicate` for each token. Iteration is stopped once `predicate` returns truthy. `predicate` is invoked with one argument: (token).
 *
 * @param {string} tokenSet The string of tokens, separated by `|`, to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 */
function forEachToken(tokenSet, predicate) {
	var tokens = tokenSet.split('|')
	var tokensLen = tokens.length

	for (var t = 0; t < tokensLen; ++t) {
		if (predicate(tokens[t])) {
			break
		}
	}
}

/**
 * Iterates over token in `terminalSymbol`, invoking `predicate` for each token. Iteration of each token set is stopped (and resumes with the next set) once `predicate` returns truthy, `predicate` is invoked with one argument: (token).
 *
 * @param {string} terminalSymbol The terminal symbol to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 */
function forEachTokenInSymbol(terminalSymbol, predicate) {
	forEachTokenSet(terminalSymbol, function (tokenSet) {
		forEachToken(tokenSet, predicate)
	})
}