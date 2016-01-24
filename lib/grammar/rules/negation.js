var util = require('../../util/util')
var g = require('../grammar')


exports.semantic = g.newSemantic({ name: 'not', cost: 0.5, minParams: 1, maxParams: 1 })

var negationTerm = g.newSymbol('negation', 'term').addWord({ accepted: [ 'not' ] })

// Stop-words removed when preceding "not".
var negationStopWords = [ 'are', 'can', 'could', 'did', 'does', 'do', 'had', 'has', 'have', 'is', 'should', 'was', 'were', 'will', 'would' ]

// Substitutions that map to "not".
// Note: Could break up this terminal rule set, which would yield one less parsing reduction while increasing the state table's size (though likely negligibly), but will change little in `pfsearch` because as a substitution the `text` is stored on the set's parent rule and the set is not traversed.
var negationContractionSubstitutions = [ 'aren\'t|can\'t|couldn\'t|didn\'t|doesn\'t|don\'t|hadn\'t|hasn\'t|haven\'t|isn\'t|shouldn\'t|wasn\'t|weren\'t|won\'t|wouldn\'t' ]

/**
 * Creates a `NSymbol` with rules for "not" while avoiding ambiguity by excluding the stop-words which `termRuleSetSymbol` also produces as terminal symbols. E.g., exclude the stop-word "have" when the new symbol is for the rule "have not" to avoid "<have> not" -> "not" -> "have not" (last step is insertion).
 *
 * The new symbol has the following rules:
 * 	S -> [not] -> "not"
 * 	S -> [stop] [not] -> "not"
 * 	S -> [not-contraction] -> "not"
 *
 * Specializing the rule sets to avoid ambiguity reduces the number of paths created in `pfsearch`, but increases the number of reductions by increasing the size of the state table. Ergo, is uncertain whether this is an improvement.
 *
 * @param {NSymbol} [termRuleSetSymbol] The `NSymbol` that produces a terminal rule set for terminal symbols for which to exclude from the stop-words that precede "not" (to avoid ambiguity). `termRuleSetSymbol.name` serves as the prefix to distinguish the name of the new symbol (and sub-symbols) in the format '[${termRuleSetSymbol.name}-negation]'.
 * @returns {NSymbol} Returns the new `NSymbol`.
 */
exports.createRuleSet = function (termRuleSetSymbol) {
	var excludedStopWords = []
	var newSymbol

	if (termRuleSetSymbol) {
		newSymbol = g.newSymbol(termRuleSetSymbol.name, 'negation')

		// The terminal symbols to exclude from the stop-words that precede "not" to avoid ambiguity.
		termRuleSetSymbol.rules.forEach(function (rule) {
			if (rule.isTerminal) {
				excludedStopWords.push(rule.rhs[0])
			}
		})
	} else {
		// The default negation rule set.
		newSymbol = g.newSymbol('negation')
	}

	// Creates a stop-word set for "<stop> not" without the symbols that `termRuleSetSymbol` produces to avoid ambiguity.
	var stopWord = g.newSymbol(newSymbol.name, 'stop', 'word')
	newSymbol.addRule({ rhs: [
		stopWord.addStopWords.apply(stopWord, util.without.apply(null, [ negationStopWords ].concat(excludedStopWords))),
		negationTerm,
	] })

	// "can't" -> "not"
	newSymbol.addSubstitutions(negationContractionSubstitutions, 'not')

	return newSymbol
}

// The default rule set for "not", with all "not" stop-words.
// (people) not (followed by me)
exports.symbol = exports.createRuleSet()