var util = require('../../util/util')
var g = require('../grammar')


exports.semantic = g.newSemantic({ name: 'not', cost: 0.5, minParams: 1, maxParams: 1 })

// Stop-words removed when preceding "not".
var negationStopWords = [ 'are', 'can', 'could', 'did', 'does', 'do', 'had', 'has', 'have', 'is', 'should', 'was', 'were', 'will', 'would' ]

// Substitutions that map to "not".
// Note: Could break up this terminal rule set, which would yield one less parsing reduction while increasing the state table's size (though likely negligibly), but will change little in `pfsearch` because as a substitution the `text` is stored on the set's parent rule and the set is not traversed.
var negationContractionSubstitutions = [ 'aren\'t|can\'t|couldn\'t|didn\'t|doesn\'t|don\'t|hadn\'t|hasn\'t|haven\'t|isn\'t|shouldn\'t|wasn\'t|weren\'t|won\'t|wouldn\'t' ]

var negationTerm = g.newSymbol('negation', 'term').addWord({ accepted: [ 'not' ] })

/**
 * Creates a symbol with rules for "not", while avoiding ambiguity by not adding preceding stop-words for `excludedStopWords`.
 *
 * The new symbol has the following rules:
 * 	S -> [not] -> "not"
 * 	S -> [stop] [not] -> "not"
 * 	S -> [not-contraction] -> "not"
 *
 * Specializing the rule sets to avoid ambiguity reduces the number of paths created in `pfsearch`, but increases the number of reductions by increasing the size of the state table. Ergo, is uncertain whether this is an improvement.
 *
 * @static
 * @param {string} [symbolPrefix] The prefix with which to name the unique symbol (and sub-symbols) in the format '[${symbolPrefix}-negation]'.
 * @param {string[]} [excludedStopWords] The stop-words to exclude from "<stop> not" -> "not", which would otherwise create ambiguity where the new symbol is used; e.g., "<have> not" -> "not" when used in a rule for "have not".
 * @returns {Symbol} Returns the new `Symbol`.
 */
exports.createRuleSet = function (symbolPrefix, excludedStopWords) {
	var newSymbol
	if (symbolPrefix) {
		newSymbol = g.newSymbol(symbolPrefix, 'negation')
	} else {
		// The default negation rule set.
		newSymbol = g.newSymbol('negation')
	}

	// The stop-word that precedes "not" without the specified symbols to avoid ambiguity.
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