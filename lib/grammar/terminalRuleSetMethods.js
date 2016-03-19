/**
 * Methods, inherited by `grammar`, that create `NSymbols` terminal rule sets.
 *
 * These methods which create an `NSymbol` are preferable to `NSymbol` instance methods that add the same terminal rule sets to an existing `NSymbol`. By not exposing the `NSymbol` (as easily), this implementation seeks to avoid mixing these sets' rules with others on the same symbol.
 */

var util = require('../util/util')


/**
 * The inflections of a verb, from which `g.newVerb()` creates a terminal rule set where each terminal rule has as its `text` an object with the properties `oneSg`, `threeSg`, `pl`, and `past`. When constructing parse trees, `pfsearch` conjugates this `text` object to the correct verb form (i.e., display text) according to grammatical properties in preceding nonterminal rules in the same tree.
 *
 * The person-number forms, `oneSg`, `threeSg`, and `pl`, are conjugated by the `personNumber` property in preceding nominative rules.
 *
 * The tense form, `past`, is conjugated by the `grammaticalForm` property in the (immediate) parent nonterminal rule. Also, if the parent rule has `acceptedTense` set to `past`, it accepts the `past` form when input, but does not conjugate to it otherwise (unlike `grammaticalForm`).
 *
 * The grammar generator and `pfsearch` do not use `presentSubjunctive`, `presentParticiple`, and `pastParticiple` for conjugation. Rather, they serve only to enforce complete definitions of verbs for complete substitution sets, replaced when input by one of the forms in the set with conjugation support.
 *
 * Note: It is much better to have a single terminal rule set with dynamic grammatical conjugation than to define separate rule sets with different display text for each grammatical case (depending on the rule), with the same substitutions/synonyms. The overhead `Parser` endures for the larger state table (because of the additional rules) is far greater than the `pfsearch` overhead for the conjugation.
 *
 * @typedef {Object} VerbTermSetSchema
 * @property {string} oneSg The first-person-singular verb form, chosen by the nonterminal rule property `personNumber`. E.g., "am", "was", "like".
 * @property {string} threeSg The third-person-singular verb form, chosen by the nonterminal rule property `personNumber`. E.g., "is", "was", "likes".
 * @property {string} pl The plural verb form, chosen by the nonterminal rule property `personNumber`. E.g., "are", "were" "like".
 * @property {string} [past] The past-tense verb form, chosen by the parent nonterminal rule property `grammaticalForm` and accepted when input by `acceptedTense`. E.g, "was", "liked", "did".
 * @property {string} [presentSubjunctive] The present-subjunctive verb form, substituted when input by one of the first four forms. E.g., "be".
 * @property {string} [presentParticiple] The present-participle verb form, substituted when input by one of the first four forms. E.g., "being", "liking".
 * @property {string} [pastParticiple] The past-participle verb form, substituted when input by one of the first four forms. E.g., "been", "done".
 */
var verbTermSetSchema = {
	oneSg: { type: String, required: true },
	threeSg: { type: String, required: true },
	pl: { type: String, required: true },
	past: String,
	presentSubjunctive: String,
	presentParticiple: String,
	pastParticiple: String,
}

/**
 * Creates an `NSymbol` that produces terminal rule sets for a verb with the necessary text forms for conjugation.
 *
 * Each terminal rule has as its `text` an object with the properties `oneSg`, `threeSg`, `pl`, and `past`. When constructing parse trees, `pfsearch` conjugates the `text` object to the correct form (i.e., display text) according to grammatical properties in preceding nonterminal rules in the same tree.
 *
 * Parameters ask for the terminal rules grouped into sets for each verb, with each verb form defined, to enable conjugation of incorrect inflections in input to the correct inflection of the same verb.
 *
 * @memberOf grammar
 * @param {Object} options The options object.
 * @param {string} options.symbolName The name for the `NSymbol`.
 * @param {number} [options.insertionCost] The insertion cost for the terminal rule set, assigned to the first terminal rule of the first verb set in `options.acceptedVerbTermSets`. Enables the creation of insertion rules using this rule set.
 * @param {VerbTermSetSchema[]} options.acceptedVerbTermSets[] The verb terminal rule sets accepted when input.
 * @param {VerbTermSetSchema[]} [options.substitutedVerbTermSets[]] The verb terminal rule sets substituted when input by the appropriate form in the first verb set in `options.acceptedVerbTermSets`. The parametrization of each form, as opposed to an array of terminal symbols, enforces complete definition of a verb.
 * @returns {NSymbol} Returns the `NSymbol` for the terminal rule set.
 */
var verbSchema = {
	symbolName: { type: String, required: true },
	insertionCost: Number,
	acceptedVerbTermSets: { type: Array, arrayType: Object, required: true },
	substitutedVerbTermSets: { type: Array, arrayType: Object },
}

exports.newVerb = function (options) {
	if (util.illFormedOpts(verbSchema, options)) {
		throw new Error('Ill-formed verb')
	}

	var verbSym = this.newSymbol(options.symbolName)
	// The terminal rule `text` object from the first verb set in `options.acceptedVerbTermSets`, used as the display text for all verb sets in `options.substitutedVerbTermSets`, if any.
	var defaultTextForms

	options.acceptedVerbTermSets.forEach(function (verbTermSet, i) {
		if (util.illFormedOpts(verbTermSetSchema, verbTermSet)) {
			throw new Error('Ill-formed verb set')
		}

		// The terminal rule `text` object containing the verb inflections used in conjugation for each terminal symbol in `verbTermSet`.
		var verbSetTextForms = {
			oneSg: verbTermSet.oneSg,
			threeSg: verbTermSet.threeSg,
			pl: verbTermSet.pl,
			// Optional.
			past: verbTermSet.past,
		}

		// Track terminal symbols for this set to avoid errors for duplicate terminal rules. This is necessary to enable defining the verb form for every grammatical case even when some are identical. E.g., "like" is identical for first-person-singular and plural.
		var addedInlectionTermSyms = []

		// The terminal rule for the first-person-singular form. E.g., "am", "was", "like".
		var oneSgTermRule = {
			isTerminal: true,
			rhs: verbTermSet.oneSg,
			text: verbSetTextForms,
		}

		if (i === 0) {
			// Save the text forms for the first terminal rule set, which will substitute the terminal rules in `options.substitutedVerbTermSets`, if any, when input.
			defaultTextForms = verbSetTextForms

			// Assign the insertion cost, if any, to the first terminal rule in the first set.
			if (options.insertionCost !== undefined) {
				oneSgTermRule.insertionCost = options.insertionCost
			}
		}

		verbSym.addRule(oneSgTermRule)
		addedInlectionTermSyms.push(verbTermSet.oneSg)

		// If the terminal symbol is unique, add the terminal rule for the third-person-singular form, for use in the present indicative tense. E.g, "is", "was", "likes".
		if (addedInlectionTermSyms.indexOf(verbTermSet.threeSg) === -1) {
			verbSym.addRule({
				isTerminal: true,
				rhs: verbTermSet.threeSg,
				text: verbSetTextForms,
			})
			addedInlectionTermSyms.push(verbTermSet.threeSg)
		}

		// If the terminal symbol is unique, add the terminal rule for the plural form. E.g, "are", "were", "like".
		if (addedInlectionTermSyms.indexOf(verbTermSet.pl) === -1) {
			verbSym.addRule({
				isTerminal: true,
				rhs: verbTermSet.pl,
				text: verbSetTextForms,
			})
			addedInlectionTermSyms.push(verbTermSet.pl)
		}

		if (verbTermSet.past) {
			if (addedInlectionTermSyms.indexOf(verbTermSet.past) !== -1) {
				util.logErrorAndPath('The past tense verb form is identical to a present tense form:', util.stylize(verbTermSet.past), verbTermSet)
				throw new Error('Ill-formed verb set')
			}

			verbSym.addRule({
				isTerminal: true,
				rhs: verbTermSet.past,
				// Define `tense` for the nonterminal rule property `acceptedTense`, which uses the verb form of the same tense when the rule is matched in input, but will only conjugate to this form (via any rule in the set) for the nonterminal rule property `grammaticalForm`.
				tense: 'past',
				text: verbSetTextForms,
			})
			addedInlectionTermSyms.push(verbTermSet.past)
		}

		// Add all remaining unique verb forms as terminal rules to be substituted when input by one of the preceding verb forms in the set that support conjugation
		for (var gramPropName in verbTermSet) {
			var inflection = verbTermSet[gramPropName]
			if (addedInlectionTermSyms.indexOf(inflection) === -1) {
				verbSym.addRule({
					isTerminal: true,
					isSubstitution: true,
					rhs: inflection,
					// Use the `text` object for this verb set.
					text: verbSetTextForms,
				})

				addedInlectionTermSyms.push(inflection)
			}
		}
	})

	// Add the terminal rule verb sets that are substituted when input by the appropriate verb form in first verb set in `options.acceptedVerbTermSets`.
	if (options.substitutedVerbTermSets) {
		options.substitutedVerbTermSets.forEach(function (verbTermSet) {
			if (util.illFormedOpts(verbTermSetSchema, verbTermSet)) {
				throw new Error('Ill-formed verb set')
			}

			// Add all unique verb forms as terminal rules to be substituted when input by the first verb set in `options.acceptedVerbTermSets`.
			var inflectionTermSyms = []
			for (var gramPropName in verbTermSet) {
				var inflectionTermSym = verbTermSet[gramPropName]
				if (inflectionTermSyms.indexOf(inflectionTermSym) === -1) {
					verbSym.addRule({
						isTerminal: true,
						isSubstitution: true,
						rhs: inflectionTermSym,
						// Use the `text` object from the first verb set.
						text: defaultTextForms,
					})

					inflectionTermSyms.push(inflectionTermSym)
				}
			}
		})
	}

	return verbSym
}

/**
 * The forms of a noun, from which `g.newNoun()` creates a terminal rule set where each rule of this set has the plural noun form as its `text` string. When constructing parse trees, `pfsearch` uses this `text` value as the display text for both rules in this set.
 *
 * The grammar generator and `pfsearch` do not use `sg` as display text. Rather, it serves only to enforce complete definition of nouns for complete substitution sets, replaced when input by the plural form.
 *
 * @typedef {Object} NounTermSetSchema
 * @property {string} sg The singular noun form, substituted when input by `pl`.
 * @property {string} pl The plural noun form.
 */
var nounTermSetSchema = {
	sg: { type: String, required: true },
	pl: { type: String, required: true },
}

/**
 * Creates an `NSymbol` that produces terminal rule sets for a noun with display text for the correct inflections.
 *
 * Each terminal rule in each set has the plural noun form of the same set as its `text` string. When constructing parse trees, `pfsearch` uses this `text` value as the display text for both rules in this set.
 *
 * The method's parameter definition groups the terminal rules into sets for each noun, with each noun form defined for each set, to enable substitution of incorrect forms in input with the correct form of the same noun.
 *
 * @memberOf grammar
 * @param {Object} options The options object.
 * @param {string} options.symbolName The name for the `NSymbol`.
 * @param {number} [options.insertionCost] The insertion cost for the terminal rule set(s), assigned to the first rule of the first noun set in `options.acceptedNounTermSets`. Enables the creation of insertion rules using the `NSymbol` that produces these sets.
 * @param {NounTermSetSchema[]} options.acceptedNounTermSets[] The noun terminal rule sets accepted when input.
 * @param {NounTermSetSchema[]} [options.substitutedNounTermSets[]] The noun terminal rule sets substituted when input by the appropriate form in the first noun set in `options.acceptedNounTermSets`. The parametrization of each form, as opposed to an array of terminal symbols, enforces complete definition of a noun set.
 * @returns {NSymbol} Returns the `NSymbol` for the terminal rule set(s).
 */
var nounSchema = {
	symbolName: { type: String, required: true },
	insertionCost: Number,
	acceptedNounTermSets: { type: Array, arrayType: Object, required: true },
	substitutedNounTermSets: { type: Array, arrayType: Object },
}

exports.newNoun = function (options) {
	if (util.illFormedOpts(nounSchema, options)) {
		throw new Error('Ill-formed noun')
	}

	var nounSym = this.newSymbol(options.symbolName)
	// The terminal rule `text` string from the first noun set in `options.acceptedNounTermSets`, used as the display text for all noun sets in `options.substitutedNounTermSets`, if any.
	var defaultText

	options.acceptedNounTermSets.forEach(function (nounTermSet, i) {
		if (util.illFormedOpts(nounTermSetSchema, nounTermSet)) {
			throw new Error('Ill-formed noun set')
		}

		// Use `pl` form as the terminal rule `text` string for both terminal rules in `nounTermSet`.
		var termSetText = nounTermSet.pl

		// The terminal rule for the plural form. Add `pl` form before `sg` because only `pl` is used as display text; i.e., lower cost because more common.
		var newRule = {
			isTerminal: true,
			rhs: nounTermSet.pl,
			text: termSetText,
		}

		if (i === 0) {
			// Save the display text for the first terminal rule set, which will substitute the terminal rules in `options.substitutedNounTermSets`, if any, when input.
			defaultText = termSetText

			// Assign the insertion cost, if any, to the first terminal rule in the first set.
			if (options.insertionCost !== undefined) {
				newRule.insertionCost = options.insertionCost
			}
		}

		nounSym.addRule(newRule)

		// The terminal rule for the singular form. Add `sg` form as a terminal symbol with `pl` as the display text.
		nounSym.addRule({
			isTerminal: true,
			isSubstitution: true,
			rhs: nounTermSet.sg,
			text: termSetText,
		})
	})

	// Add the terminal rule noun sets that are substituted when input by the first noun set in `options.acceptedNounTermSets`.
	if (options.substitutedNounTermSets) {
		options.substitutedNounTermSets.forEach(function (nounTermSet) {
			if (util.illFormedOpts(nounTermSetSchema, nounTermSet)) {
				throw new Error('Ill-formed noun set')
			}

			// Add `pl` before `sg`, even though both are substituted, to match pattern of accepted noun sets.
			nounSym.addRule({
				isTerminal: true,
				isSubstitution: true,
				rhs: nounTermSet.pl,
				text: defaultText,
			})

			nounSym.addRule({
				isTerminal: true,
				isSubstitution: true,
				rhs: nounTermSet.sg,
				text: defaultText,
			})
		})
	}

	return nounSym
}