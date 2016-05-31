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
 * @param {string|Object|(string|Object)[]} text The rule's text string not needing conjugation, text object to conjugate, or array of text strings and objects to conjugate.
 * @param {Object} personNumberList The reverse linked list of person-number properties for conjugating `text`.
 * @param {Object} [gramProps] The previous path's (i.e., the parent nonterminal rule's) grammatical properties (`form` and `acceptedTense`) for conjugating `text`. Only present when current rule is terminal.
 * @param {string} [inputTense] The terminal symbol's `tense` property to check against the previous path's (i.e., the parent nonterminal rule's) `acceptedTense` property and determine if the input terminal symbol is an (optionally) acceptable form of the associated verb, `text`.
 * @returns {string} Returns the text, conjugated if necessary, prepended with a space.
 */
module.exports = function conjugateText(text, personNumberList, gramProps, inputTense) {
	var textConstructor = text.constructor

	if (textConstructor === String) {
		// No conjugation.
		return ' ' + text
	}

	if (textConstructor === Object) {
		// Conjugate `text`, which contains a term's inflected forms.
		return ' ' + conjugateTextObject(text, personNumberList, gramProps, inputTense)
	}

	// Conjugate `text`, which is an array of text strings and yet-to-conjugate text objects. Exists for insertions and merged `text` values for adjacent terminal rule sets. This array will never contains other arrays.
	var conjugatedText = ''

	for (var t = 0, textLen = text.length; t < textLen; ++t) {
		// `gramProps` and `inputTense` are only needed for merged `text` values from adjacent terminal rule sets.
		conjugatedText += conjugateText(text[t], personNumberList, gramProps, inputTense)
	}

	return conjugatedText
}

/**
 * Conjugates `textObj` to a term's correct inflection according to the parent rule's grammatical properties or the path's previous person-number property.
 *
 * Note: It was considered whether the tense of inserted verbs that are accepted as either past or present tense should agree with the tense of verbs in input. For example, if input is "repos liked by me", then a suggestion could be "repos liked by me I contributed to" (where `[contribute-to]` is in past tense). This was decided against because it can be confusing to suggest the same verb in different tenses at different times when the difference is immaterial; yet, tense is material for other verbs (e.g., "places I worked"). In addition, sometimes tense is less clear; e.g., "people who are followed by me". Hence, inserted verbs for which either tense is accepted are inserted in present tense.
 *
 * Note: It is much better to have a single terminal rule set with dynamic grammatical conjugation than to define separate rule sets for each grammatical case (depending on the rule) with the same substitutions/synonyms. The overhead `Parser` endures for the larger state table (because of the additional rules) is far greater than the `pfsearch` overhead for the conjugation.
 *
 * @private
 * @static
 * @param {Object} textObj The text object, containing a term's different inflected forms, to conjugate.
 * @param {Object} personNumberList The reverse linked list of person-number properties for conjugating `textObj`.
 * @param {Object} [gramProps] The previous path's (i.e., the parent nonterminal rule's) grammatical properties (`form` and `acceptedTense`) for conjugating `textObj`. Only present when current rule is terminal.
 * @param {string} [inputTense] The terminal symbol's `tense` property to check against the previous path's (i.e., the parent nonterminal rule's) `acceptedTense` property and determine if the input terminal symbol is an (optionally) acceptable form of the associated verb, `textObj`.
 * @returns {string} Returns the conjugated text.
 */
function conjugateTextObject(textObj, personNumberList, gramProps, inputTense) {
	if (gramProps) {
		// Conjugate for required verb tense (e.g., "(repos I have) liked") and grammatical case (e.g., "(repos) I (like)".
		// Must occur before person-number check, otherwise "[have] [like]" yields "have like" instead of "have liked".
		var grammaticalForm = gramProps.form
		if (grammaticalForm && textObj[grammaticalForm]) {
			return textObj[grammaticalForm]
		}

		// If the input terminal symbol is of a tense which the parent rule optionally accepts, then accept it. E.g., "(repos I) like/liked".
		if (inputTense && gramProps.acceptedTense === inputTense && textObj[inputTense]) {
			return textObj[inputTense]
		}
	}

	// Conjugate for required person-number. E.g., "(repos I) like", "(repos Danny) likes".
	if (personNumberList && textObj[personNumberList.personNumber]) {
		return textObj[personNumberList.personNumber]
	}

	// Conjugation failed.
	util.logError('Failed to conjugate:')
	util.log('  Text object:', textObj)
	util.log('  Person-number linked-list:', personNumberList)
	util.log('  Parent rule `gramProps`:', gramProps)
	util.log()
	throw new Error('Failed conjugation')
}