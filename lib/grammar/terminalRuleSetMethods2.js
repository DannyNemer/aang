/**
 * Methods, which `grammar` inherits, that create `NSymbols` terminal rule sets.
 *
 * These methods which create an `NSymbol` are preferable to `NSymbol` instance methods that add the same terminal rule sets to an existing `NSymbol`. By not exposing the `NSymbol` (as easily), this abstraction seeks to prevent mixing these sets' rules with others on the same symbol.
 */

var util = require('../util/util')
var NSymbol = require('./NSymbol')
var grammarUtil = require('./grammarUtil')


/**
 * The inflections of a verb, from which `terminalRuleSetMethods.newVerb()` creates a terminal rule set where each rule in this set has as an object as its `text` with the properties `oneSg`, `threeSg`, `pl`, and `past`. When constructing parse trees, `pfsearch` conjugates this `text` object to the correct verb form (i.e., display text) according to grammatical properties in preceding nonterminal rules in the same tree.
 *
 * The person-number forms, `oneSg`, `threeSg`, and `pl`, are conjugated by the `personNumber` property in preceding nominative rules.
 *
 * The tense form, `past`, is conjugated by the `grammaticalForm` property in the (immediate) parent nonterminal rule. Also, if the parent rule has `acceptedTense` set to `past`, it accepts the `past` form when input, but does not conjugate to it otherwise (unlike `grammaticalForm`).
 *
 * The grammar generator and `pfsearch` do not use `presentSubjunctive`, `presentParticiple`, and `pastParticiple` for conjugation. Rather, they serve only to enforce complete definitions of verbs for complete substitution sets, replaced when input by one of the forms in the set with conjugation support.
 *
 * Note: It is much better to have a single terminal rule set with dynamic grammatical conjugation than to define separate rule sets with different display text for each grammatical case (depending on the rule), with the same substitutions/synonyms. The overhead `Parser` endures for the additional reductions because of the additional terminal rule matches is far greater than the `pfsearch` overhead for the conjugation.
 *
 * Note: Each of the verb forms becomes a terminal symbol, and can not contain whitespace.
 *
 * @typedef {Object} VerbFormsTermSet
 * @property {string} oneSg The first-person-singular verb form, chosen by the nonterminal rule property `personNumber`. E.g., "am", "was", "like".
 * @property {string} threeSg The third-person-singular verb form, chosen by the nonterminal rule property `personNumber`. E.g., "is", "was", "likes".
 * @property {string} pl The plural verb form, chosen by the nonterminal rule property `personNumber`. E.g., "are", "were" "like".
 * @property {string} past The simple past tense verb form (or, preterite), chosen by the parent nonterminal rule property `grammaticalForm` and accepted when input by matching `acceptedTense`. E.g, "was", "liked", "did", "had".
 * @property {string} [presentSubjunctive] The present-subjunctive verb form, substituted when input by one of the first four forms. E.g., "be".
 * @property {string} [presentParticiple] The present-participle verb form, substituted when input by one of the first four forms. E.g., "being", "liking".
 * @property {string} [pastParticiple] The past-participle verb form, substituted when input by one of the first four forms (and substituted by `past` if the parent rule has matching `acceptedTense`). E.g., "been", "done".
 */
var verbFormsTermSetSchema = {
	oneSg: { type: String, required: true },
	threeSg: { type: String, required: true },
	pl: { type: String, required: true },
	past: { type: String, required: true },
	presentSubjunctive: String,
	presentParticiple: String,
	pastParticiple: String,
}

/**
 * Creates an `NSymbol` that produces a terminal rule set for a verb with the necessary text forms for conjugation.
 *
 * Each terminal rule in the set has as an object as its `text` with the properties `oneSg`, `threeSg`, `pl`, and `past` for the various verb forms. When constructing parse trees, `pfsearch` conjugates the `text` object to the correct form (i.e., display text) according to grammatical properties in preceding nonterminal rules in the same tree.
 *
 * Note: Each of the verb forms in `options.verbFormsTermSet` becomes a terminal symbol, and can not contain whitespace.
 *
 * The returned `NSymbol` has the following properties:
 * 1. `name` - `options.symbolName`.
 * 2. `isTermSet` - `true`. Prevents adding more rules to this `NSymbol`.
 * 3. `termSetType` - 'verb'.
 * 4. `defaultText` -  The conjugative `text` object for the forms of this verb, which is for every terminal rule this `NSymbol` produces. For use when nesting this `NSymbol` in a term set sequence.
 *
 * @memberOf terminalRuleSetMethods
 * @param {Object} options The options object.
 * @param {string} options.symbolName The name for the new `NSymbol`.
 * @param {number} [options.insertionCost] The insertion cost for the terminal rule set, assigned to the first rule in the set (i.e., `oneSg`). Enables the creation of insertion rules using the symbol that produces this set.
 * @param {boolean} [options.noPastDisplayText] Specify excluding the past tense form, `options.verbFormsTermSet.past`, from the display `text` object. Instead, substitute the `past` form when input by the verb's correct present tense form.
 * @param {VerbFormsTermSet} options.verbFormsTermSet The verb terminal rule set with each verb form inflection.
 * @returns {NSymbol} Returns the new `NSymbol` for the verb terminal rule set.
 */
var verbSchema = {
	symbolName: { type: String, required: true },
	insertionCost: Number,
	noPastDisplayText: Boolean,
	verbFormsTermSet: { type: Object, required: true },
}

exports.newVerb = function (options) {
	if (util.illFormedOpts(verbSchema, options)) {
		throw new Error('Ill-formed verb')
	}

	var verbFormsTermSet = options.verbFormsTermSet
	if (util.illFormedOpts(verbFormsTermSetSchema, verbFormsTermSet)) {
		throw new Error('Ill-formed verb forms term set')
	}

	// Create the `NSymbol` that produces the verb terminal rule set.
	var verbSym = this.newSymbol(options.symbolName)

	// The terminal rule `text` object containing the verb inflections for use in conjugation for each terminal symbol in `verbFormsTermSet`.
	var verbTextForms = {
		oneSg: verbFormsTermSet.oneSg,
		threeSg: verbFormsTermSet.threeSg,
		pl: verbFormsTermSet.pl,
	}

	/**
	 * If `options.noPastDisplayText` is `true`, exclude the past tense form, `options.verbFormsTermSet.past`, from the display `text` object. Instead, substitute the `past` form when input by the verb's correct present tense form.
	 *
	 * For example, exclude "had", the past tense of the auxiliary verb "have", from display text because it yields the past perfect construction. Past perfect implies the event/action took place in the past and excludes the present. This implication may be undesirable if input when the DB behind the NLI lacks this specific information. For example, "people I had followed" means people the user previously followed and no longer follows. If the DB lacks this information and can only return people the user currently follows, then correct the display text to "have" to accurately reflect the returned data.
	 */
	if (!options.noPastDisplayText) {
		verbTextForms.past = verbFormsTermSet.past
	}

	// The terminal rule for the first-person-singular verb form, chosen by the nonterminal rule property `personNumber`. E.g., "am", "was", "like".
	var oneSgTermRule = createVerbTerminalRule(verbFormsTermSet.oneSg, verbTextForms, 'present')
	if (options.insertionCost !== undefined) {
		// Assign the insertion cost, if any, to the first terminal rule in the set.
		oneSgTermRule.insertionCost = options.insertionCost
	}
	verbSym.addRule(oneSgTermRule)

	// The terminal rule for the third-person-singular verb form, chosen by the nonterminal rule property `personNumber`. E.g., "is", "was", "likes".
	verbSym.addRule(createVerbTerminalRule(verbFormsTermSet.threeSg, verbTextForms, 'present'))

	// The terminal rule for the the plural verb form, chosen by the nonterminal rule property `personNumber`. E.g., "are", "were" "like".
	// Check if distinguishable from the first-person-singular verb form; e.g., "like". Do not check if other verb forms are identical; rather, allow `NSymbol.prototype._newTerminalRule()` to throw the error for duplicate terminal symbols.
	if (verbFormsTermSet.pl !== verbFormsTermSet.oneSg) {
		verbSym.addRule(createVerbTerminalRule(verbFormsTermSet.pl, verbTextForms, 'present'))
	}

	// The terminal rule for the simple past tense verb form (or, preterite), chosen by the parent nonterminal rule property `grammaticalForm` and accepted when input by matching `acceptedTense`. E.g, "was", "liked", "did", "had".
	verbSym.addRule(createVerbTerminalRule(verbFormsTermSet.past, verbTextForms, 'past'))

	// If provided, the terminal rule for the present-subjunctive verb form, substituted when input by `verbTextForms`. E.g., "be".
	if (verbFormsTermSet.presentSubjunctive) {
		verbSym.addRule(createVerbTerminalRule(verbFormsTermSet.presentSubjunctive, verbTextForms, 'present'))
	}

	// If provided, the terminal rule for the present-participle verb form, substituted when input by `verbTextForms`. E.g., "being", "liking".
	if (verbFormsTermSet.presentParticiple) {
		verbSym.addRule(createVerbTerminalRule(verbFormsTermSet.presentParticiple, verbTextForms, 'present'))
	}

	// If provided, the terminal rule for the past-participle verb form, substituted when input by `verbTextForms` (and substituted by `past` if the parent rule has matching `acceptedTense`). E.g., "been", "done".
	if (verbFormsTermSet.pastParticiple) {
		verbSym.addRule(createVerbTerminalRule(verbFormsTermSet.pastParticiple, verbTextForms, 'past'))
	}

	// Assign terminal rule set properties to the `NSymbol` after adding all rules in the terminal rule set, to prevent further adding rules to `verbSym`.
	verbSym.isTermSet = true
	verbSym.termSetType = 'verb'

	/**
	 * Save `verbTextForms`, which is identical for every terminal rule `verbSym` produces, as the terminal rule set's default text.
	 *
	 * For use when nesting `verbSym` in the first accepted rule of a term set sequence. If so, that new term set sequence uses `verbSym.defaultText` in its default text, which it uses as the display text for its substitution rules, if any.
	 */
	verbSym.defaultText = verbTextForms

	return verbSym
}

/**
 * Creates a terminal rule for `terminalSymbol` as part of a verb rule set to pass to `NSymbol.prototype.addRule()`.
 *
 * For use by `terminalRuleSetMethods.newVerb()`.
 *
 * @private
 * @static
 * @param {string} terminalSymbol The terminal symbol without whitespace to match in input.
 * @param {Object} verbTextForms The terminal rule `text` object with all of a verb's forms for conjugation.
 * @param {string} tense The grammatical tense of `terminalSymbol`. Either 'present' or 'past'.
 * @returns {Object} Returns the new terminal rule, for which to pass to `NSymbol.prototype.addRule()`.
 */
function createVerbTerminalRule(terminalSymbol, verbTextForms, tense) {
	if (isIllFormedTerminalSymbol(terminalSymbol)) {
		throw new Error('Ill-formed verb terminal symbol')
	}

	if (tense !== 'present' && tense !== 'past') {
		util.logError('Unrecognized verb rule tense:', util.stylize(tense))
		throw new Error('Ill-formed verb')
	}

	var newVerbRule = {
		isTerminal: true,
		rhs: terminalSymbol,
		text: verbTextForms,
	}

	if (tense === 'past') {
		/**
		 * Define `tense` for use by the parent nonterminal rule property `acceptedTense`, which uses the verb form of the same tense when a terminal rule with identical `tense` is matched in input. Does not conjugate to that tense if not input unless the parent rule property `grammaticalForm` dictates as such.
		 *
		 * If this rule is a past-participle form, is matched in input, and the parent rule's `acceptedTense` matches `tense`, `pfsearch` substitutes this symbol for the verb set's simple past form, `verbTextForms.past`.
		 *
		 * If the entire verb set is a substitution set, this property maintains input tense for rules with `acceptedTense`. For example:
		 *   "repos I work on" -> "repos I contribute to"
		 *   "repos I worked on" -> "repos I contributed to" (maintained optional input tense)
		 */
		newVerbRule.tense = tense
	}

	return newVerbRule
}

/**
 * A terminal rule substitution for use in an invariable terminal rule set (i.e., does not support conjugation).
 *
 * @type {Object} SubstitutedTerm
 * @property {string} term The terminal symbol without whitespace to substitute when seen in input.
 * @property {number} costPenalty The substitution cost penalty.
 */
var substitutedTermSchema = {
	term: { type: String, required: true },
	costPenalty: { type: Number, required: true },
}

/**
 * Creates an `NSymbol` that produces a terminal rule set for uninflected (i.e., invariable) terms.
 *
 * Each terminal rule created from `options.acceptedTerms` has its term (i.e., the terminal symbol) as its `text` string, and each terminal rule created from `options.substitutedTerms`, if provided, has the first term in `options.acceptedTerms` has its `text` string. `pfsearch` does not attempt to conjugate these (invariable) terms.
 *
 * Note: Each of the strings in `options.acceptedTerms` and `options.substitutedTerms` becomes a terminal symbol, and can not contain whitespace.
 *
 * The returned `NSymbol` has the following properties:
 * 1. `name` - `options.symbolName`.
 * 2. `isTermSet` - `true`. Prevents adding more rules to this `NSymbol`.
 * 3. `termSetType` - 'invariable'.
 * 4. `defaultText` - The `text` string of the first terminal symbol in `options.acceptedTerms`. For use when nesting this `NSymbol` in a term set sequence.
 *
 * @memberOf terminalRuleSetMethods
 * @param {Object} options The options object.
 * @param {string} options.symbolName The name for the new `NSymbol`.
 * @param {number} [options.insertionCost] The insertion cost for the terminal rule set, assigned to the first term in `options.acceptedTerms`. Enables the creation of insertion rules using the symbol that produces this set.
 * @param {string[]} options.acceptedTerms[] The uninflected terms accepted when input.
 * @param {(string|SubstitutedTerm)[]} [options.substitutedTerms[]] The uninflected terms substituted when input by the first term in `options.acceptedTerms`, defined with cost penalties (`SubstitutedTerm`) or without (`string`).
 * @returns {NSymbol} Returns the new `NSymbol` for the invariable terminal rule set.
 */
var invariableTermSchema = {
	symbolName: { type: String, required: true },
	insertionCost: Number,
	acceptedTerms: { type: Array, arrayType: String, required: true },
	substitutedTerms: { type: Array, arrayType: [ String, Object ] },
}

exports.newInvariableTerm = function (options) {
	if (util.illFormedOpts(invariableTermSchema, options)) {
		throw new Error('Ill-formed term')
	}

	// Create the `NSymbol` that produces the invariable terminal rule set.
	var termSym = this.newSymbol(options.symbolName)

	// Add a terminal rule for each uninflected term accepted when input.
	options.acceptedTerms.forEach(function (term, i) {
		if (isIllFormedTerminalSymbol(term)) {
			throw new Error('Ill-formed invariable term')
		}

		var termRule = {
			isTerminal: true,
			rhs: term,
			text: term,
		}

		// Assign the insertion cost, if any, to the first terminal rule in set.
		if (i === 0 && options.insertionCost !== undefined) {
			termRule.insertionCost = options.insertionCost
		}

		termSym.addRule(termRule)
	})

	// The display text for the first terminal rule in `options.acceptedTerms`, which substitutes the terminal symbols in `options.substitutedTerms`, if any, when input.
	var defaultText = options.acceptedTerms[0]

	// Add a terminal rules for each term that is substituted when input by the first term in `options.acceptedTerms`.
	if (options.substitutedTerms) {
		options.substitutedTerms.forEach(function (term) {
			var costPenalty = 0
			if (term.constructor === Object) {
				if (util.illFormedOpts(substitutedTermSchema, term)) {
					throw new Error('Ill-formed term substitution')
				}

				// Assign substitution cost penalty, if any, to the terminal rule.
				costPenalty = term.costPenalty
				term = term.term
			}

			if (isIllFormedTerminalSymbol(term)) {
				throw new Error('Ill-formed invariable term substitution')
			}

			termSym.addRule({
				isTerminal: true,
				rhs: term,
				text: defaultText,
				costPenalty: costPenalty,
			})
		})
	}

	// Assign terminal rule set properties to the `NSymbol` after adding all rules in the terminal rule set, to prevent further adding rules to `termSym`.
	termSym.isTermSet = true
	termSym.termSetType = 'invariable'

	/**
	 * Save `defaultText`, which is the first accepted terminal symbol in this terminal rule set.
	 *
	 * For use when nesting `termSym` in the first accepted rule of a term set sequence. If so, that new term set sequence uses `termSym.defaultText` in its default text, which it uses as the display text for its substitution rules, if any.
	 */
	termSym.defaultText = defaultText

	return termSym
}

/**
 * Checks if `terminalSymbol` contains a non-alphabetic character. If so, prints an error message.
 *
 * @private
 * @static
 * @param {string} terminalSymbol The terminal symbol to check.
 * @returns {boolean} Returns `true` if `terminalSymbol` contains a non-alphabetic character, else `false`.
 */
function isIllFormedTerminalSymbol(terminalSymbol) {
	// Match any non-alphabetic character (a-z, A-Z).
	var reNonAlphabetic = /\W|\d|_/

	var invalidCharIndex = terminalSymbol.search(reNonAlphabetic)
	if (invalidCharIndex !== -1) {
		util.logErrorAndPath('Terminal symbol', util.stylize(terminalSymbol), 'contains a non-alphabetic character:', util.stylize(terminalSymbol[invalidCharIndex]))
		return true
	}

	return false
}

/**
 * Creates an `NSymbol` that produces a set of verbs and verb-phrases.
 *
 * All rules which the new `NSymbol` produces are marked `isTermSetSequence`, which instructs `calcHeuristicCosts` to do the following:
 * 1. For non-edit rules, `calcHeuristicCosts` merges the `text` values of the matched terminal rules it produces.
 * 2. For insertion rules, `calcHeuristicCosts` traverses the single child node, gets the `text` values of the matched terminal rules, and merges those `text` values with the rule's insertion `text` according to its `insertedSymIdx` property.
 * 3. For substitution rules, `calcHeuristicCosts` uses the `text` value of the rule and ignores the matched terminal rules it produces.
 *
 * For all three, `calcHeuristicCosts` creates a new, terminal `ruleProps` for the rule with the `text` value as specified, which `pfsearch` uses to generate display text. `calcHeuristicCosts` also always traverses the matched terminal rules to get the input tense of any matched verb terminal rules, which `pfsearch` uses if the parent rule has matching `acceptedTense`.
 *
 * The returned `NSymbol` has the following properties:
 * 1. `name` - `options.symbolName`.
 * 2. `isTermSetSequence` - `true`. Prevents adding more rules to this `NSymbol`.
 * 3. `hasVerb` - `true`. Specifies every term set sequence `NSymbol` produces will include a verb.
 * 4. `defaultText` - The `defaultText` value (or merger of `defaultText` values) of the first term set or term set sequence in `options.acceptedVerbs`. For use when nesting this `NSymbol` in another term set sequence.
 *
 * @memberOf terminalRuleSetMethods
 * @param {Object} options The options object.
 * @param {string} options.symbolName The name for the new `NSymbol`.
 * @param {(NSymbol|NSymbol[])[]} options.acceptedVerbs The verbs (created by `terminalRuleSetMethods.newVerb()`) and verb-phrases (arrays of a verb and an invariable term created by `terminalRuleSetMethods.newInvariableTerm()`) to accept when input.
 * @param {(NSymbol|NSymbol[])[]} [options.substitutedVerbs] The verbs (created by `terminalRuleSetMethods.newVerb()`) and verb-phrases (arrays of a verb and an invariable term created by `terminalRuleSetMethods.newInvariableTerm()`) to substitute when input with the first item in `options.acceptedVerbs`.
 * @returns {NSymbol} Returns the new `NSymbol` for the verb set.
 */
var verbSetSchema = {
	symbolName: { type: String, required: true },
	acceptedVerbs: { type: Array, arrayType: [ NSymbol, Array ], required: true },
	substitutedVerbs: { type: Array, arrayType: [ NSymbol, Array ] },
}

exports.newVerbSet2 = function (options) {
	if (util.illFormedOpts(verbSetSchema, options)) {
		throw new Error('Ill-formed verb set')
	}

	// Create the `NSymbol` that produces the verb set.
	var verbSetSym = this.newSymbol(options.symbolName)
	// The display text from the first verb/verb-phrase rule in the `options.acceptedVerbs`, which substitutes the verb/verb-phrases in `options.substitutedVerbs`, if any, when input. Can be a verb object (terminal rule set) or an array of a verb object and invariable term string.
	var defaultText

	options.acceptedVerbs.forEach(function (verb, i) {
		/**
		 * If `verb` is a verb terminal rule set created by `terminalRuleSetMethods.newVerb()`.
		 *
		 * For example:
		 *   `[create]` -> `[make]` -> "make", text: `{make-verb-forms}`
		 */
		if (verb.isTermSet && verb.termSetType === 'verb') {
			/**
			 * Even though this rule only produces a single matched terminal rule, it is still assigned `isTermSetSequence` to instruct `calcHeuristicCosts` to bring the text-verb-forms object up to this rule's node level, so that `gramProps` may conjugate it (`gramProps` only conjugates the immediate child nodes).
			 *
			 * Could assign `verb.text` to this rule, like a substitution, but the parsing result is identical. Should the system in the future need to further distinguish nonterminal substitutions, it is best not to implement as such.
			 */
			verbSetSym.addRule({
				rhs: [ verb ],
			})

			if (i === 0) {
				// Save the `text` object of the first verb in `options.acceptedVerbs` as the display text for the verbs/verb-phrases in `options.substitutedVerbs`, if any.
				// The `text` object of every terminal rule in `verb`, a verb terminal rule set, is identical.
				defaultText = verb.defaultText
			}
		}

		/**
		 * If `verb` is a verb phrase containing a verb terminal rule set created by `terminalRuleSetMethods.newVerb()` and an invariable terminal rule set created by `terminalRuleSetMethods.newInvariableTerm()`.
		 *
		 * For example:
		 *   `[contribute-to]` -> `[contribute]` -> "contribute", text: `{contribute-verb-forms}`
		 *                        `[to]`         -> "to"
		 */
		else if (verb.constructor === Array) {
			if (isIllFormedVerbBinaryTermSet(verb)) {
				throw new Error('Ill-formed verb binary term set')
			}

			// `NSymbol.prototype._newNonterminalRule()` will mark the resulting rule `isTermSetSequence`, which instructs `calcHeuristicCosts` to traverse the child nodes this rule produces, merge the `text` values of the matched terminal rules it produces, and create a new, terminal `ruleProps` for the rule's node to instruct `pfsearch` to use the merged `text` for display text and not traverse further.
			verbSetSym.addRule({
				rhs: verb,
			})

			if (i === 0) {
				// Save the `text` string(s)/object(s) of the first rule produced by each term set in `verb` as the display text for the verbs/verb-phrases in `options.substitutedVerbs`, if any.
				defaultText = verb.map(termSym => termSym.defaultText)
				if (defaultText.every(termSym => termSym.constructor === String)) {
					defaultText = defaultText.join(' ')
				}
			}
		}

		else {
			util.logError('Verb is neither a verb term set nor a binary term set:', verb)
			throw new Error('Ill-formed verb set')
		}
	})

	if (options.substitutedVerbs)	{
		options.substitutedVerbs.forEach(function (verb) {
			/**
			 * If `verb` is a verb terminal rule set created by `terminalRuleSetMethods.newVerb()`.
			 *
			 * For example:
			 *   `[like]` -> `[love]`, text: `{like-verb-forms}` -> "love"
			 */
			if (verb.isTermSet && verb.termSetType === 'verb') {
				// `pfsearch` uses this rule's `text` property instead of the `text` values of the matched terminal rules it produces.
				verbSetSym.addRule({
					rhs: [ verb ],
					text: defaultText,
				})
			}

			/**
			 * If `verb` is a verb phrase containing a verb terminal rule set created by `terminalRuleSetMethods.newVerb()` and an invariable terminal rule set created by `terminalRuleSetMethods.newInvariableTerm()`.
			 *
			 * For example:
			 *   `[contribute-to]` -> `[work]` `[on]`, text: `[ {contribute-verb-forms}, "to" ]`
			 */
			else if (verb.constructor === Array) {
				if (isIllFormedVerbBinaryTermSet(verb)) {
					throw new Error('Ill-formed substitution verb binary term set')
				}

				// `pfsearch` uses this rule's `text` property instead of the `text` values of the matched terminal rules it produces.
				verbSetSym.addRule({
					rhs: verb,
					text: defaultText,
				})
			}

			else {
				util.logError('Verb is neither a verb term set nor a binary term set:', verb)
				throw new Error('Ill-formed substitution verb set')
			}
		})
	}

	// Assign `verbSetSym.isTermSetSequence` after adding all rules in the verb set to prevent adding more rules to `verbSetSym`.
	verbSetSym.isTermSetSequence = true
	verbSetSym.hasVerb = true

	/**
	 * Save `defaultText`, which is the `defaultText` (or merger of `defaultText` values) of the term set(s) or term set sequence(s) in this sequence's first accepted rule.
	 *
	 * For use when nesting `verbSetSym` in the first accepted rule of another term set sequence. If so, that new term set sequence uses `verbSetSym.defaultText` in its default text, which it uses as the display text for its substitution rules, if any.
	 */
	verbSetSym.defaultText = defaultText

	return verbSetSym
}

/**
 * Checks if `binaryTermSet` is an ill-formed verb set array.
 *
 * For use by `terminalRuleSetMethods.newVerbSet2()`.
 *
 * @private
 * @static
 * @param {Nsymbol[]} binaryTermSet The `NSymbol` verb set array of term sets to check.
 * @returns {boolean} Returns `true` if `binaryTermSet` is ill-formed, else `false`.
 */
function isIllFormedVerbBinaryTermSet(binaryTermSet) {
	if (binaryTermSet.length !== 2) {
		util.logError('Verb binary term set does not contain two symbols:', binaryTermSet)
		return true
	}

	for (var s = 0; s < 2; ++s) {
		var termSetSym = binaryTermSet[s]
		if (!termSetSym.isTermSet) {
			util.logError('Verb binary term set contains symbol that is not terminal rule set:', termSetSym)
			return true
		}
	}

	if (binaryTermSet.every(termSetSym => termSetSym.termSetType !== 'verb')) {
		util.logError('Verb binary term set lacks a verb (created with `g.newVerb()`):', binaryTermSet)
		return true
	}

	return false
}

/**
 * Creates an `NSymbol` that produces a terminal rule sequence forming a term or phrase, comprised of terminal rule sets and nested terminal rule set sequences.
 *
 * Each item in `options.acceptedTerms` and `options.substitutedTerms` must be one of the following:
 * 1. A terminal rule set created by `terminalRuleSetMethods.newVerb()` or `terminalRuleSetMethods.newInvariableTerm()`.
 * 2. A terminal rule set sequence created by this method or `terminalRuleSetMethods.newBinaryTermSequence()`.
 * 3. An ordered pair containing any combination of #1, #2, or nested ordered pairs from which to recursively create new term set sequences.
 *
 * The `defaultText` value (or merger of `defaultText` values) of the first term in `options.acceptedTerms` is used as the `text` value of the rules for the items in `options.substitutedTerms`, if any, which substitutes their `text` values when input.
 *
 * All rules which the new `NSymbol` produces are marked `isTermSetSequence`, which instructs `calcHeuristicCosts` to do the following:
 * 1. For non-edit rules, `calcHeuristicCosts` merges the `text` values of the matched terminal rules it produces.
 * 2. For insertion rules, `calcHeuristicCosts` traverses the single child node, gets the `text` values of the matched terminal rules, and merges those `text` values with the rule's insertion `text` according to its `insertedSymIdx` property.
 * 3. For substitution rules, `calcHeuristicCosts` uses the `text` value of the rule and ignores the matched terminal rules it produces.
 *
 * For all three, `calcHeuristicCosts` creates a new, terminal `ruleProps` for the rule with the `text` value as specified, which `pfsearch` uses to generate display text. `calcHeuristicCosts` also always traverses the matched terminal rules to get the input tense of any matched verb terminal rules, which `pfsearch` uses if the parent rule has matching `acceptedTense`.
 *
 * If `options.isVerb` is `true`, then checks every term set, term sequence, and term sequence pair in `options.acceptedTerms` and `options.substitutedTerms` produces exactly one verb (created by `g.newVerb()`). Else, checks no term can produce a verb.
 *
 * The returned `NSymbol` has the following properties:
 * 1. `name` - `options.symbolName`.
 * 2. `isTermSetSequence` - `true`. Prevents adding more rules to this `NSymbol`.
 * 3. `isVerb` - `options.isVerb`.
 * 4. `defaultText` - The `defaultText` value (or merger of `defaultText` values) of the first term set or term set sequence in `options.acceptedTerms`. For use when nesting this `NSymbol` in another term set sequence.
 *
 * @memberOf terminalRuleSetMethods
 * @param {Object} options The options object.
 * @param {string} options.symbolName The name for the new `NSymbol`.
 * @param {boolean} [options.isVerb] Specify every term sequence this `NSymbol` produces, accepted or substituted, contains one verb terminal rule set (created by `terminalRuleSetMethods.newVerb()`).
 * @param {(NSymbol|NSymbol[])[]} options.acceptedTerms The term sets and term set sequences to accept when input, parameterized as described above.
 * @param {(NSymbol|NSymbol[])[]} [options.substitutedTerms] The term sets and term set sequences to substitute when input with the first item in `options.acceptedTErms`, parameterized as described above.
 * @returns {NSymbol} Returns the new `NSymbol` for the terminal rule set sequence.
 */
var termSetSequenceSchema = {
	symbolName: { type: String, required: true },
	isVerb: Boolean,
	acceptedTerms: { type: Array, arrayType: [ NSymbol, Array ], required: true },
	substitutedTerms: { type: Array, arrayType: [ NSymbol, Array ] },
}

exports.newTermSequence = function (options) {
	if (util.illFormedOpts(termSetSequenceSchema, options)) {
		throw new Error('Ill-formed term sequence')
	}

	// Create the `NSymbol` that produces the terminal rule set sequence.
	var termSetSeqSym = this.newSymbol(options.symbolName)
	/**
	 * The `defaultText` value (or merger of `defaultText` values) of the first term set or term set sequence in `options.acceptedTerms`.
	 *
	 * For use as the `text` value of the rules for the term sets and term set sequences in `options.substitutedTerms`, if any, which substitutes their `text` values when input.
	 *
	 * Can be an invariable term string, a conjugative verb object, or an array of both.
	 */
	var defaultText

	options.acceptedTerms.forEach(function (term, i) {
		/**
		 * If `term` is a terminal rule set created by `terminalRuleSetMethods.newVerb()` or `terminalRuleSetMethods.newInvariableTerm()`, or a terminal rule set sequence created by `terminalRuleSetMethods.newTermSetSet()` or `terminalRuleSetMethods.newBinaryTermSequence()`.
		 *
		 * An example where `term` is the terminal rule set `[make]`:
		 *   `[create]` -> `[make]` -> "make", text: `{make-verb-forms}`
		 *
		 * An example where `term` a terminal rule set sequence `[work-on]`:
		 *   `[contribute-to]` -> `[work-on]` -> `[work]` -> "work", text: `{work-verb-forms}`
		 *                                    -> `[on]`   -> "on",   text: "on"
		 */
		if (term.isTermSet || term.isTermSetSequence) {
			// If `options.isVerb`, check `term` is either a verb terminal rule set or a verb term sequence, else `term` is neither a verb terminal rule nor a verb term sequence.
			if (isIllFormedVerbTermSequence(term, options.isVerb)) {
				throw new Error('Ill-formed term sequence')
			}

			/**
			 * Even though this rule is unary and does not require `text` merging, the rule is still assigned `isTermSetSequence` to instruct `calcHeuristicCosts` to bring the `text` up to this rule's node level, allowing `gramProps` may conjugate the `text` (`gramProps` only conjugates the immediate child nodes).
			 *
			 * Even if `term` is a verb terminal rule set sequence, for which the `text` value of every terminal rule is identical, does not assign that `text` to this rule as if it were a substitution. Although the parsing result will be identical, it is important to distinguish between the two.
			 */
			termSetSeqSym.addRule({
				rhs: [ term ],
			})

			if (i === 0) {
				/**
				 * Save the `defaultText` of the first term in `options.acceptedTerms` as the display text for `options.substitutedTerms`, if any.
				 * • If `term` is an invariable term, `defaultText` is the display text of its first accepted terminal rule.
				 * • If `term` is a verb, `defaultText` is the identical `text` of all terminal rules in the set.
				 * • If `term` is a term set sequence, `defaultText` is the display text of its first accepted term set or term set sequence it produces.
				 */
				defaultText = term.defaultText
			}
		}

		/**
		 * If `term` is an ordered pair containing any combination of term sets, term set sequences, or nested ordered pairs from which to recursively create new term set sequences.
		 *
		 * An example of two term sets:
		 *   `[contribute-to]` -> `[contribute]` -> "contribute", text: `{contribute-verb-forms}`
		 *                     -> `[to]`         -> "to",         text: "to"
		 *
		 * An example of a term set and a term set sequence:
		 *   `[have-in-common]` -> `[have]`                    -> "have",   text: `{have-verb-forms}`
		 *                      -> `[in-common]` -> `[in]`     -> "in",     text: "in"
		 *                                       -> `[common]` -> "common", text: "common"
		 *
		 * An example of a term set and a nested ordered pair of two term sets from which to recursively create a new term set sequence:
		 *   `[have-in-common]` -> `[have]`                              -> "have", text: `{have-verb-forms}`
		 *                      -> [ `[in]` `[common] ] -> `[in-common]` -> `[in]`     -> "in",     text: "in"
		 *                                                               -> `[common]` -> "common", text: "common"
		 */
		else if (term.constructor === Array) {
			// Recursively flatten any nested ordered pairs to `NSymbol` instances that produce term set sequences.
			var termSetSeqPair = flattenTermSequencePair(term)

			// If `options.isVerb`, check exclusively `termSetSeqPair[0]` or `termSetSeqPair[1]` is either a verb terminal rule set or a verb term sequence, else both `termSetSeqPair[0]` and `termSetSeqPair[1]` are neither a verb terminal rule set nor a verb term sequence.
			if (isIllFormedVerbTermSequencePair(termSetSeqPair[0], termSetSeqPair[1], options.isVerb)) {
				throw new Error('Ill-formed term sequence pair')
			}

			// `calcHeuristicCosts` will traverse this rule's child nodes, merge the `text` values of the matched terminal rules it produces, and create a new, terminal `ruleProps` for the rule's node to instruct `pfsearch` to use the merged `text` for display text and not traverse further.
			termSetSeqSym.addRule({
				rhs: termSetSeqPair,
			})

			if (i === 0) {
				/**
				 * Merge the `defaultText` values of the first term pair in `options.acceptedTerms` as the display text for `options.substitutedTerms`, if any.
				 * • If an item in the pair an invariable term, its `defaultText` is the display text of its first accepted terminal rule.
				 * • If an item in the pair is a verb, its `defaultText` is the identical `text` of all terminal rules in the set.
				 * • If an item in the pair is a term set sequence, its `defaultText` is the display text of its first accepted term set or term set sequence it produces.
				 */
				defaultText = grammarUtil.mergeTextPair(termSetSeqPair[0].defaultText, termSetSeqPair[1].defaultText)
			}
		}

		else {
			util.logError('Term is neither a term set, term sequence, nor an ordered pair of the two:', term)
			throw new Error('Ill-formed term sequence')
		}
	})

	if (options.substitutedTerms) {
		// Create nonterminal substitution rules with `defaultText` as the `text` value for each rule. This instructs `pfsearch` to generate display text from these rules and discard the `text` values of the matched terminal rules which these rules produce.
		options.substitutedTerms.forEach(function (term) {
			/**
			 * If `term` is a terminal rule set created by `terminalRuleSetMethods.newVerb()` or `terminalRuleSetMethods.newInvariableTerm()`, or a terminal rule set sequence created by `terminalRuleSetMethods.newTermSetSet()` or `terminalRuleSetMethods.newBinaryTermSequence()`.
			 *
			 * A substitution example where `term` is the terminal rule set `[make]`:
			 *   `[like]` -> `[love]`, text: `{like-verb-forms}`
			 *
			 * A substitution example where `term` a terminal rule set sequence `[work-on]`:
			 *   `[contribute-to]` -> `[help-with]`, text: `[ {contribute-verb-forms}, "to" ]`
			 */
			if (term.isTermSet || term.isTermSetSequence) {
				// If `options.isVerb`, check `term` is either a verb terminal rule set or a verb term sequence, else `term` is neither a verb terminal rule nor a verb term sequence.
				if (isIllFormedVerbTermSequence(term, options.isVerb)) {
					throw new Error('Ill-formed term sequence substitution')
				}

				// `pfsearch` uses this rule's `text` property instead of the `text` values of the matched terminal rules it produces.
				termSetSeqSym.addRule({
					rhs: [ term ],
					text: defaultText,
				})
			}

			/**
			 * If `term` is an ordered pair containing any combination of term sets, term set sequences, or nested ordered pairs from which to recursively create new term set sequences.
			 *
			 * A substitution example of two term sets:
			 *   `[contribute-to]` -> `[help]` `[with]` text: `[ {contribute-verb-forms}, "to" ]`
			 *
			 * A substitution example of a term set and a term set sequence:
			 *   `[share]` -> `[have]` `[in-common]`, text: `{share-verb-forms}`
			 *
			 * A substitution example of a term set and a nested ordered pair of two term sets from which to recursively create a new term set sequence:
			 *   `[share]` -> `[have]` [ `[in]` `[common] ] -> `[have]` `[in-common]`, text: `{share-verb-forms}`
			 */
			else if (term.constructor === Array) {
				// Recursively flatten any nested ordered pairs to `NSymbol` instances that produce term set sequences.
				var termSetSeqPair = flattenTermSequencePair(term)

				// If `options.isVerb`, check exclusively `termSetSeqPair[0]` or `termSetSeqPair[1]` is either a verb terminal rule set or a verb term sequence, else both `termSetSeqPair[0]` and `termSetSeqPair[1]` are neither a verb terminal rule set nor a verb term sequence.
				if (isIllFormedVerbTermSequencePair(termSetSeqPair[0], termSetSeqPair[1], options.isVerb)) {
					throw new Error('Ill-formed term sequence pair substitution')
				}

				// `pfsearch` uses this rule's `text` property instead of the `text` values of the matched terminal rules it produces.
				termSetSeqSym.addRule({
					rhs: termSetSeqPair,
					text: defaultText,
				})
			}

			else {
				util.logError('Term is neither a term set, term sequence, nor an ordered pair of the two:', term)
				throw new Error('Ill-formed term sequence substitution')
			}
		})
	}

	// Assign `termSetSeqSym.isTermSetSequence` after adding all rules in the term set sequence to prevent adding more rules to `termSetSeqSym`.
	termSetSeqSym.isTermSetSequence = true

	// Specify every term sequence `termSetSeqSym` produces, accepted or substituted, contains one verb terminal rule set (created by `terminalRuleSetMethods.newVerb()`).
	termSetSeqSym.isVerb = options.isVerb

	/**
	 * Save `defaultText`, which is the merger of `defaultText` values of the term set(s) or term set sequence(s) in this sequence's first accepted rule.
	 *
	 * For use when nesting `termSetSeqSym` in the first accepted rule of another term set sequence. If so, that new term set sequence uses `termSetSeqSym.defaultText` in its default text, which it uses as the display text for its substitution rules, if any.
	 */
	termSetSeqSym.defaultText = defaultText

	return termSetSeqSym
}

/**
 * Checks if `term` disagrees with `isVerb` for a new term sequence. If so, prints an error message.
 *
 * If `isVerb` is `true`, then `term` must be either a verb terminal rule set (`term.termSetType === 'verb'`) or a verb term sequence (`term.isVerb`), else `term` is neither a verb terminal rule set nor a verb term sequence.
 *
 * @private
 * @static
 * @param {Object} term The term set or term sequence to inspect.
 * @param {boolean} isVerb Specify `term` should be a verb terminal rule set or a verb term sequence.
 * @returns {boolean} Returns `true` if `term` disagrees with `isVerb`, else `false`.
 */
function isIllFormedVerbTermSequence(term, isVerb) {
	if (isVerb) {
		if (term.isTermSet && term.termSetType !== 'verb') {
			util.logError('Non-verb term set provided to verb term sequence:', term)
			return true
		}

		if (term.isTermSetSequence && !term.isVerb) {
			util.logError('Non-verb term sequence provided to verb term sequence:', term)
			return true
		}
	} else if (isForbiddenVerb(term) {
		return true
	}

	return false
}

/**
 * Checks if `termA` and `termB` disagree with `isVerb` for a new term sequence pair. If so, prints an error message.
 *
 * If `isVerb` is `true`, then exclusively `termA` or `termB` must be either a verb terminal rule set or a verb term sequence, else both `termA` and `termB` are neither a verb terminal rule set nor a verb term sequence.
 *
 * @private
 * @static
 * @param {Object} termA The first term set or term sequence to inspect in the term sequence pair.
 * @param {Object} termB The second term set or term sequence to inspect in the term sequence pair.
 * @param {boolean} isVerb Specify exclusively `termA` or `termB` should be a verb terminal rule set or a verb term sequence.
 * @returns {boolean} Returns `true` if `termA` and `termB` disagree with `isVerb`, else `false`.
 */
function isIllFormedVerbTermSequencePair(termA, termB, isVerb) {
	if (isVerb) {
		if (isVerbTerm(termA) && isVerbTerm(termB)) {
			util.logError('Two verbs provided in a single verb term sequence pair:', termA, termB)
			return true
		}

		if (!isVerbTerm(termA) && !isVerbTerm(termB)) {
			util.logError('No verbs provided in a verb term sequence pair:', termA, termB)
			return true
		}
	} else if (isForbiddenVerb(termA) || isForbiddenVerb(termB)) {
		return true
	}

	return false
}

/**
 * Checks if `term` is either a verb terminal rule set (created by `terminalRuleSetMethods.newVerb()`) or a verb term sequence. If so, prints an error message.
 *
 * @private
 * @static
 * @param {Object} term The terminal rule set or term sequence to inspect.
 * @returns {boolean} Returns `true` if `term` is either a verb terminal rule set or verb term sequence, else `false`.
 */
function isForbiddenVerb(term) {
	if (term.isTermSet && term.termSetType === 'verb') {
		util.logError('Verb term set provided to non-verb term sequence (i.e., `option.isVerb` is falsey):', term)
		return true
	}

	if (term.isTermSetSequence && term.isVerb) {
		util.logError('Verb term sequence provided to non-verb term sequence (i.e., `option.isVerb` is falsey):', term)
		return true
	}

	return false
}

/**
 * Checks if `term` is either a verb terminal rule set (created by `terminalRuleSetMethods.newVerb()`) or a verb term sequence.
 *
 * @private
 * @static
 * @param {Object} term The terminal rule set or term sequence to inspect.
 * @returns {boolean} Returns `true` if `term` is either a verb terminal rule set or verb term sequence, else `false`.
 */
function isVerbTerm(term) {
	return term.isTermSet && term.termSetType === 'verb' || term.isTermSetSequence && term.isVerb
}

/**
 * Creates an `NSymbol` with a single binary rule with `options.termPair` as its `rhs`, which produces a terminal sequence forming a phrase comprised of terminal rule sets and nested terminal rule set sequences.
 *
 * Each item in `options.termPair` must be one of the following:
 * 1. A terminal rule set created by `terminalRuleSetMethods.newVerb()` or `terminalRuleSetMethods.newInvariableTerm()`.
 * 2. A terminal rule set sequence created by `terminalRuleSetMethods.newTermSequence()` or this method.
 * 3. An ordered pair containing any combination of #1, #2, or nested ordered pairs from which to recursively create new term set sequences.
 *
 * The single rule the new `NSymbol` produces is marked `isTermSetSequence`.
 *
 * The returned `NSymbol` has the following properties:
 * 1. `name` - The concatenation of the names of the `NSymbol` instances in `options.termPair` (after flattening nested ordered pairs).
 * 2. `isTermSetSequence` - `true`. Prevents adding more rules to this `NSymbol`.
 * 3. `isVerb` - `options.isVerb`.
 * 4. `defaultText` - The merger of the `defaultText` values of the terms in `options.termPair`. For use when nesting this `NSymbol` in another term set sequence.
 *
 * @memberOf terminalRuleSetMethods
 * @param {Object} options The options object.
 * @param {boolean} [options.isVerb] Specify every term sequence `options.termPair` produces contains one verb terminal rule set (created by `terminalRuleSetMethods.newVerb()`).
 * @param {NSymbol[]} options.termPair The ordered pair of terms in this sequence.
 * @returns {NSymbol} Returns the new `NSymbol` for the terminal rule set sequence.
 */
var binaryTermSetSequenceSchema = {
	isVerb: Boolean,
	termPair: { type: Array, arrayType: [ NSymbol, Array ], required: true },
}

exports.newBinaryTermSequence = function (options) {
	if (util.illFormedOpts(binaryTermSetSequenceSchema, options)) {
		throw new Error('Ill-formed binary term set sequence')
	}

	// Recursively flattens any nested ordered pairs to `NSymbol` instances that produce term set sequences.
	var termSetSeqPair = flattenTermSequencePair(options.termPair)
	var termA = termSetSeqPair[0]
	var termB = termSetSeqPair[1]

	// If `options.isVerb`, check exclusively `termA` or `termB` is either a verb terminal rule set or a verb term sequence, else both `termA` and `termB` are neither a verb terminal rule set nor a verb term sequence.
	if (isIllFormedVerbTermSequencePair(termA, termB, options.isVerb)) {
		throw new Error('Ill-formed term sequence pair')
	}

	/**
	 * Create the `NSymbol` and the single terminal rule set sequence.
	 *
	 * `calcHeuristicCosts` will traverse this rule's child nodes, merge the `text` values of the matched terminal rules it produces, and create a new, terminal `ruleProps` for the rule's node to instruct `pfsearch` to use the merged `text` for display text and not traverse further.
	 */
	var termSetSeqSym = g.newSymbol(termA.name, termB.name).addRule({
		rhs: termSetSeqPair,
	})

	// Assign `termSetSeqSym.isTermSetSequence` after adding all rules in the term set sequence to prevent adding more rules to `termSetSeqSym`.
	termSetSeqSym.isTermSetSequence = true

	// Specify every term sequence `termSetSeqSym` produces, accepted or substituted, contains one verb terminal rule set (created by `terminalRuleSetMethods.newVerb()`).
	termSetSeqSym.isVerb = options.isVerb

	/**
	 * Save `defaultText`, which is the merger of `defaultText` values of the term set(s) or term set sequence(s) in this sequence's (only) binary rule.
	 *
	 * For use when nesting `termSetSeqSym` in the first accepted rule of another term set sequence. If so, that new term set sequence uses `termSetSeqSym.defaultText` in its default text, which it uses as the display text for its substitution rules, if any.
	 */
	termSetSeqSym.defaultText = grammarUtil.mergeTextPair(termA.defaultText, termB.defaultText)

	return termSetSeqSym
}

/**
 * Checks `termSetSeqPair` is a valid term set sequence pair and recursively flattens any nested ordered pairs to `NSymbol` instances that produce term set sequences.
 *
 * Each item in `termSetSeqPair` must be one of the following:
 * 1. A terminal rule set created by `terminalRuleSetMethods.newVerb()` or `terminalRuleSetMethods.newInvariableTerm()`.
 * 2. A terminal rule set sequence created by `terminalRuleSetMethods.newTermSequence()` or `terminalRuleSetMethods.newBinaryTermSequence()`.
 * 3. An ordered pair containing any combination of #1, #2, or nested ordered pairs from which to recursively create new term set sequences with `terminalRuleSetMethods.newBinaryTermSequence()`.
 *
 * Returns a flattened ordered pair of `NSymbol` instances, for use as a `rhs` in a binary rule for a term set sequence.
 *
 * **Note:** This function mutates `termSetSeqPair`.
 *
 * @private
 * @static
 * @param {(NSymbol|NSymbol[])[]} termSetSeqPair The term set ordered pair to validate and flatten.
 * @returns {NSymbol} Returns the flattened term set sequence ordered pair.
 */
function flattenTermSequencePair(termSetSeqPair) {
	var termSetSeqLen = termSetSeqPair.length
	if (termSetSeqLen !== 2) {
		util.logError('Term sequence is not an ordered pair:', termSetSeqPair)
		throw new Error('Ill-formed term sequence pair')
	}

	for (var s = 0; s < termSetSeqLen; ++s) {
		var termSym = termSetSeqPair[s]
		if (termSym.constructor === Array) {
			if (termSym.length !== 2) {
				util.logError('Term sequence is not an ordered pair:', termSym)
				throw new Error('Ill-formed term sequence pair')
			}

			// Recursively create an `NSymbol` that produces a single binary rule for the term set sequence of this nested ordered pair.
			termSetSeqPair[s] = exports.newBinaryTermSequence({ termPair: termSym })
		} else if (!termSym.isTermSet || !termSym.isTermSetSequence) {
			util.logError('Term is neither a term set nor a term sequence:', termSym)
			throw new Error('Ill-formed term sequence')
		}
	}

	// The flattened ordered pair of `NSymbol` instances for use as a `rhs` in a binary rule for a term set sequence.
	return termSetSeqPair
}