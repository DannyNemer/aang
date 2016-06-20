var util = require('../util/util')


/**
 * Conjugates `text`, if necessary, for appending to a path.
 *
 * `text` can be a `string` not needing conjugation, an `Object` containing a term's inflected forms, or an `Array` of text strings and yet-to-conjugate text objects.
 *
 * If `text` is an `Array`, then it is one of the following:
 * 1. Conjugating an insertion with `insertedSymIdx` of 1, which requires completing the insertion rule's single branch, which determines the person-number required for the nominative case in the second (inserted) branch (verb precedes subject).
 * 2. The merged `text` values of adjacent terminal rule sets, created by `calcHeuristicCosts`.
 *
 * For use by `pfsearch`.
 *
 * @static
 * @param {string|Object|(string|Object)[]} text The display text invariable string, conjugative text object, or array of invariable strings and conjugative objects to conjugate.
 * @param {Object} personNumberList The reverse linked list of person-number properties for conjugating `text`.
 * @param {Object} [parentGramProps] The previous path's (i.e., the parent nonterminal rule's) grammatical properties (`form` and `acceptedTense`) for conjugating `text`. Only present when current rule is terminal.
 * @param {string} [inputTense] The term sequence's input tense, defined by a descendant verb terminal symbol's `tense` property, with which to conjugate `textObj` if matches `parentGramProps.acceptedTense`.
 * @returns {string} Returns the display text, conjugated if necessary, prepended with a space.
 */
module.exports = function conjugateText(text, personNumberList, parentGramProps, inputTense) {
	var textConstructor = text.constructor

	// No conjugation.
	if (textConstructor === String) {
		return ' ' + text
	}

	// Conjugate `text`, which contains a term's inflected forms.
	if (textConstructor === Object) {
		return ' ' + conjugateTextObject(text, personNumberList, parentGramProps, inputTense)
	}

	// Conjugate `text`, which is an array of text strings and yet-to-conjugate text objects. Exists for insertions and merged `text` values for adjacent terminal rule sets. This array will never contains nested arrays.
	var conjugatedText = ''
	for (var t = 0, textArrayLen = text.length; t < textArrayLen; ++t) {
		// `parentGramProps` and `inputTense` are only needed for merged `text` values from adjacent terminal rule sets.
		conjugatedText += conjugateText(text[t], personNumberList, parentGramProps, inputTense)
	}
	return conjugatedText
}

/**
 * Conjugates `textObj` to the term's correct inflection according to the parent rule's grammatical properties, `parentGramProps`, or the path's previous person-number property in `personNumberList`.
 *
 * Note: It was considered whether the tense of inserted verbs that are accepted as either past or present tense should agree with the tense of verbs in input. For example, if input is "repos liked by me", then a suggestion could be "repos liked by me I contributed to" (where `[contribute-to]` is in past tense). This was decided against because it can be confusing to suggest the same verb in different tenses at different times when the difference is immaterial; yet, tense is material for other verbs (e.g., "places I worked"). In addition, sometimes tense is less clear; e.g., "people who are followed by me". Hence, inserted verbs for which either tense is accepted are inserted in present tense.
 *
 * Note: It is much better to have a single terminal rule set with dynamic grammatical conjugation than to define separate rule sets for each grammatical case (depending on the rule) with the same substitutions/synonyms. The overhead `Parser` endures for the larger state table (because of the additional rules) is far greater than the `pfsearch` overhead for the conjugation.
 *
 * @private
 * @static
 * @param {Object} textObj The display text conjugative object, containing a term's different inflected forms, to conjugate.
 * @param {Object} personNumberList The reverse linked list of person-number properties for conjugating `textObj`.
 * @param {Object} [parentGramProps] The previous path's (i.e., the parent nonterminal rule's) grammatical properties (`form` and `acceptedTense`) for conjugating `textObj`. Only present when current rule is terminal.
 * @param {string} [inputTense] The term sequence's input tense, defined by a descendant verb terminal symbol's `tense` property, with which to conjugate `textObj` if matches `parentGramProps.acceptedTense`.
 * @returns {string} Returns the conjugated display text.
 */
function conjugateTextObject(textObj, personNumberList, parentGramProps, inputTense) {
	if (parentGramProps) {
		/**
		 * Conjugate verb within a term sequence if trminal symbol input tense matches optionally accepted tense.
		 * For example: "repos I like/liked".
		 *
		 * Perform `parentGramProps.acceptedTense` conjugation before `parentGramProps.form` to support subject verb rules that have both properties. For example: "people who like/liked ...".
		 */
		if (inputTense && parentGramProps.acceptedTense === inputTense && textObj[inputTense]) {
			return textObj[inputTense]
		}

		/**
		 * Conjugate verb tense (e.g., "(repos I have) liked") and grammatical case (e.g., "(repos) I (like)".
		 *
		 * Must occur before person-number check below to ensure "[have] [like]" yields "have liked" and not "have likes".
		 */
		var grammaticalForm = parentGramProps.form
		if (grammaticalForm && textObj[grammaticalForm]) {
			return textObj[grammaticalForm]
		}
	}

	// Conjugate verb according to grammatical person-number property in preceding nomniative rules.
	// For example: "(repos I) like", "(repos Danny) likes".
	if (personNumberList && textObj[personNumberList.personNumber]) {
		return textObj[personNumberList.personNumber]
	}

	util.logError('Failed to conjugate:')
	util.log('  Text object:', textObj)
	util.log('  Person-number linked-list:', personNumberList)
	util.log('  Parent rule `gramProps`:', parentGramProps)
	util.log()
	throw new Error('Failed conjugation')
}