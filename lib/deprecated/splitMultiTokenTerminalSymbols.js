/*
I attempted to implement the following, however, after much frustrating and hitting my head against the wall, I decided to return to it later. I will continue to think about the problem in the back of my mind, and I will hopefully come closer to a solution by working on other matters; other uncertainties will be removed.

The original never has adjacent terminal rules. Instead, it concatenates terminal symbols to a multi-token terminal symbol. However, it is still able to match individual tokens in a multi-token symbol and determine the correct insertion costs. It is also able to conduct deletions within a multi-token symbol. Several terminal symbols have regexp OR operators, permitting various terms (even optional terms). The only way it can match individual tokens within these symbol, some of them optional, some being inserted with the correct insertion cost, and some with synonyms, is if these terms are broken up and parsed with a state table. That is how you match "X|Y |Z A|B|C".

In addition, and what prompted the examination that surfaced this difference, is the only way to know a token in the input is completely unrecognized and should be deleted with a cost of 10, is to have a way to look up every individual token in the grammar, and this is only possible if all terminal symbols are a single token. The parser cannot know if it can delete an individual token which might end up being part of a multi-token symbol.

We determined that we will generate the grammar, and before constructing the edit rules, will replace the multi-token terminal symbols with rules of single-token terminal symbols. We are unsure this is correct.

We suspected that we define the the correct 'text' on the same original terminal rules that might become nonterminal rules, and have no 'text' property on the new terminal symbols. This could be wrong because the original has rules like "like|enjoy" and "match|contains", and it uses whichever token is matched, implying the text value must be on the new single-token terminal rules.

We do not know how to have the 'text' property on the new terminal rules, because when a terminal symbol has a substitution of greater length, then which of the multiple terminal symbols (to be reduced to one) contains the single correct text token.

The original parses these terminal symbols, possibly in a second state table, first and then uses those query segments to parse in the grammar. But how do they do that aside from sending every possible n-gram to a parser made from this state table.

Why would they seperate the parsing? Can't they just add all the rules to the big state table?

Is it possible we can remove all the stuff with an array of nodeTabs and vertTabs by parsing the terminal symbols in one sweep, but will still have terminal symbols of length greater than two with entities and deletions.

Deletions are likely part of this seperate terminal symbol parsing. Entities are the only terminal symbols with values for their token indexes in the input query. Not needed for deletions or multi-token terminal symbols.

For determining the accepted text of insertion and substitutions when there is a regexp-like OR operator, use the first option, including if it is an empty-string.

Entities need to be tokenized as well. Entities can be matched out of order without cost. Yet, entities can also be matched as parts of individual tokens. Hence, this is where ES comes in just matches terms to an inverted document index. In fact, it even has "Entity Search", and there is a GitHUb package called "Entity Resolution" using Baysean resolution.

Tests to implement for unrecognized token deletion:
	- deletion in middle
	- multiple non-consecutive deletions in middle
	- multiple consecutive deletions
	- deletions at end
	- two deletions at end
	- deletions at start
	- two deletions at start
	- deletions at start and
	- query as just a single deletion
	- query as just multiple deletions
	- a deletable followed by unrecognized deletion
	- multi-token terminal symbols and deletions
	- X Y Z -> "Y" "Z", "X Y Z" -> Y is a match, and "XYZ" is
 */

var util = require('../util')
var g = require('./grammar')
var symbol = require('./symbol')
var stringUtil = require('./stringUtil')


module.exports = function (ruleSets) {
	// Copy an array of nonterminal symbols to avoid the new symbols that will be added while iterating.
	var nontermSymbols = Object.keys(ruleSets)
	for (var s = 0, nontermSymbolsLen = nontermSymbols.length; s < nontermSymbolsLen; ++s) {
		var rules = ruleSets[nontermSymbols[s]]

		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]

			if (rule.isTerminal) {
				var terminalSymbol = rule.RHS[0]

				if (/[ \|]/.test(terminalSymbol)) {
					tap(ruleSets, rule, terminalSymbol)
				}
			}
		}
	}
}

// we could go through, look at terminal symbols with insertion cost, and make a list
// but how did they do that when they had identical symbols with different cost - how do you choose which

// LOOK AT "like|enjoy" in our grammar

function tap(ruleSets, rule, terminalSymbol) {
	var tokens = terminalSymbol.split(' ')

	var isStopWord = rule.text === undefined

	for (var t = 0, tokensLen = tokens.length; t < tokensLen; ++t) {
		var token = tokens[t]

		var newSymbolName

		if (isStopWord) {
			// this is definitely messy
			newSymbolName = '[' + stringUtil.hyphenate(token, 'term', 'stop') + ']'
		} else if (token[0] === '|') {
			newSymbolName = '[' + stringUtil.hyphenate(token.slice(1), 'term', 'opt') + ']'
		} else {
			newSymbolName = '[' + stringUtil.hyphenate(token, 'term') + ']'
		}

		if (!ruleSets.hasOwnProperty(newSymbolName)) {
			var newSymbol = g.newSymbol(newSymbolName)

			var terms = token.split('|')
			for (var i = 0, termsLen = terms.length; i < termsLen; ++i) {
				var term = terms[i]
				if (term === '') {
					newSymbol.addRule({ terminal: true, RHS: g.emptySymbol })
				} else {
					var newRule = {
						terminal: true,
						RHS: term
					}

					if (i === 0 && rule.insertionCost !== undefined) {
						newRule.insertionCost = rule.insertionCost
					}

					// if (isStopWord) {
						newRule.text = ''
					// }

					newSymbol.addRule(newRule)
				}
			}
		}

		// Replace token with Symbol name
		tokens[t] = newSymbolName
	}

	// Reduce to a tree of binary rules.
	while (tokens.length > 2) {
		// Get last two Symbols
		var binaryRHS = tokens.splice(-2, 2)
		var binaryRHSName = '[' + stringUtil.formatName(stringUtil.hyphenate(binaryRHS[0], binaryRHS[1])) + ']'

		if (ruleSets.hasOwnProperty(binaryRHSName)) {
			tokens.push(binaryRHSName)
		} else {
			// Added support for String in RHS so can support strings here of names
			tokens.push(g.newBinaryRule({ RHS: binaryRHS }))
		}
	}

	delete rule.insertionCost
	delete rule.isTerminal
	delete rule.text

	rule.RHS = tokens
	// because it looks for it
	rule.gramProps = {}
}