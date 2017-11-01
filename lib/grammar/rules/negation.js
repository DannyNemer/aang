var util = require('../../../util/util')
var g = require('../grammar')


exports.semantic = g.newSemantic({
	name: 'not',
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
})

exports.term = g.newTermSequence({
	symbolName: g.hyphenate('term', 'negation'),
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'not' ],
})

// Stop-words removed when preceding "not".
// Useful because if input is "have not", "are not", etc., then the entire term pair needs to be removed to be an effective deletion edit.
// FIXME: Temporarily exclude the following stop-words which are already deletables and would otherwise create ambiguity: 'are', 'did', 'does', 'do', 'is'
var negationStopWords = [ 'can', 'could', 'had', 'has', 'have', 'should', 'was', 'were', 'will', 'would' ]

// Substitutions that map to "not".
var negationContractionSubstitutions = g.newTermSequence({
	symbolName: g.hyphenate('negation', 'contractions'),
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'aren\'t', 'can\'t', 'couldn\'t', 'didn\'t', 'doesn\'t', 'don\'t', 'hadn\'t', 'hasn\'t', 'haven\'t', 'isn\'t', 'shouldn\'t', 'wasn\'t', 'weren\'t', 'won\'t', 'wouldn\'t' ],
})

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
 * @memberOf negation
 * @param {NSymbol} [termRuleSetSymbol] The `NSymbol` that produces a terminal rule set for terminal symbols for which to exclude from the stop-words that precede "not" (to avoid ambiguity). `termRuleSetSymbol.name` serves as the prefix to distinguish the name of the new symbol (and sub-symbols) in the format '[${termRuleSetSymbol.name}-negation]'.
 * @returns {NSymbol} Returns the new `NSymbol`.
 */
exports.createRuleSet = function (termRuleSetSymbol) {
	var stopWordsToExclude = []
	var newSymbolName

	if (termRuleSetSymbol) {
		newSymbolName = g.hyphenate(termRuleSetSymbol.name, 'negation')

		// The terminal symbols to exclude from the stop-words that precede "not" to avoid ambiguity.
		termRuleSetSymbol.rules.forEach(function addStopWord(rule) {
			if (rule.isTerminal) {
				stopWordsToExclude.push(rule.rhs[0])
			} else if (rule.rhs.length === 1) {
				// Traverse unary rules.
				var rhsSym = rule.rhs[0]
				g.newSymbol._ruleSets[rhsSym].forEach(addStopWord)
			}
		})
	} else {
		// The default negation rule set.
		newSymbolName = 'negation'
	}

	/**
	 * Do not assign a cost penalty to the stop-words because they must be easily deleted for corrections. For example:
	 * "repos I have not created"
	 *   Without cost penalty (bad): -> "repos I have created"
	 *   With cost penalty (good:    -> "repos I did not create"
	 */
	return g.newTermSequence({
		symbolName: newSymbolName,
		type: g.termTypes.INVARIABLE,
		acceptedTerms: [
			exports.term,
		],
		substitutedTerms: [
			/**
			 * Create a stop-word set for "<stop> not" without the symbols that `termRuleSetSymbol` produces to avoid ambiguity. For example: "could not" -> "not".
			 *
			 * FIXME: Improper implementation of a stop-word, because always uses "not" as display text irresctive of match to `[term-negation]`.
			 *
			 * FIXME: Might remove stop-words. Some, such as "have", should be manually implemented where they are forbidden. For example, a stop-word for "have" in "have not created" (which prevents present perfect negative tense).
			 */
			[
				g.newTermSequence({
					symbolName: g.hyphenate(newSymbolName, 'stop', 'word'),
					type: g.termTypes.INVARIABLE,
					acceptedTerms: util.without.apply(null, [ negationStopWords ].concat(stopWordsToExclude)),
				}),
				exports.term,
			],
			// "can't" -> "not"
			negationContractionSubstitutions,
		]
	})
}

// The default rule set for "not", with all "not" stop-words.
// (people) not (followed by me)
exports.symbol = exports.createRuleSet()