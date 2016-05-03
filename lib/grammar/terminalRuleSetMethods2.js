/**
 * Methods, which `grammar` inherits, that create `NSymbols` terminal rule sets.
 *
 * These methods which create an `NSymbol` are preferable to `NSymbol` instance methods that add the same terminal rule sets to an existing `NSymbol`. By not exposing the `NSymbol` (as easily), this abstraction seeks to prevent mixing these sets' rules with others on the same symbol.
 */

var util = require('../util/util')
var g = require('./grammar')
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
 * @property {string} past The simple past tense verb form (or, preterite), chosen by the parent nonterminal rule property `grammaticalForm` and accepted when input by matching `acceptedTense`. E.g., "was", "liked", "did", "had".
 * @property {string} [presentSubjunctive] The present-subjunctive verb form, substituted when input with one of the first four forms. E.g., "be".
 * @property {string} [presentParticiple] The present-participle verb form, substituted when input with one of the first four forms. E.g., "being", "liking".
 * @property {string} [pastParticiple] The past-participle verb form, substituted when input with one of the first four forms (and substituted with `past` if the parent rule has matching `acceptedTense`). E.g., "been", "done".
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
 * The present tense inflections of a verb, from which `terminalRuleSetMethods.newVerb(options)`, with `options.noPastRules` as `true`, creates a terminal rule set for a verb.
 *
 * Inherits `verbFormsTermSetSchema` excluding the following verb forms:
 * • verbFormsTermSetSchema.past - The simple past tense verb form (or, preterite)
 * • verbFormsTermSetSchema.pastParticiple - The past-participle verb form.
 */
var presentVerbFormsTermSetSchema = Object.assign({}, verbFormsTermSetSchema)
delete presentVerbFormsTermSetSchema.past
delete presentVerbFormsTermSetSchema.pastParticiple

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
 * 4. `isPresentVerb` - `options.noPastRules`.
 * 5. `defaultText` - The conjugative `text` object for the forms of this verb, which is for every terminal rule this `NSymbol` produces. For use when nesting this `NSymbol` in a term sequence.
 *
 * @memberOf terminalRuleSetMethods
 * @param {Object} options The options object.
 * @param {string} options.symbolName The name for the new `NSymbol`.
 * @param {number} [options.insertionCost] The insertion cost for the terminal rule set, assigned to the first rule in the set (i.e., `oneSg`). Enables the creation of insertion rules using the symbol that produces this set.
 * @param {boolean} [options.noPastRules] Specify excluding the past tense verb forms (`verbFormsTermSet.past` and `verbFormsTermSet.pastParticiple`) from the terminal rule set.
 * @param {boolean} [options.noPastDisplayText] Specify excluding the past tense verb forms, `options.verbFormsTermSet.past`, from the display `text` object. Instead, substitute the `past` form when input with the verb's correct present tense form. Unlike `options.noPastRules`, this creates terminal rules for the past tense verb forms for substitution.
 * @param {VerbFormsTermSet} options.verbFormsTermSet The verb terminal rule set with each verb form inflection.
 * @returns {NSymbol} Returns the new `NSymbol` for the verb terminal rule set.
 */
var verbSchema = {
	symbolName: { type: String, required: true },
	insertionCost: Number,
	noPastRules: Boolean,
	noPastDisplayText: Boolean,
	verbFormsTermSet: { type: Object, required: true },
}

exports.newVerb = function (options) {
	if (util.illFormedOpts(verbSchema, options)) {
		throw new Error('Ill-formed verb')
	}

	var verbFormsTermSet = options.verbFormsTermSet

	if (options.noPastRules) {
		// Properties `verbSchema.noPastRules` and `verbSchema.noPastDisplayText` are mutually exclusive.
		if (options.noPastDisplayText) {
			util.logErrorAndPath('Verb defines both `noPastRules` and `noPastDisplayText` as `true`:', options)
			throw new Error('Ill-formed present verb')
		}

		if (verbFormsTermSet.past) {
			util.logErrorAndPath('Verb with `noPastRules` has forbidden `verbFormsTermSet.past`:', options)
			throw new Error('Ill-formed present verb')
		}

		if (verbFormsTermSet.pastParticiple) {
			util.logErrorAndPath('Verb with `noPastRules` has forbidden `verbFormsTermSet.pastParticiple`:', options)
			throw new Error('Ill-formed present verb')
		}

		if (util.illFormedOpts(presentVerbFormsTermSetSchema, verbFormsTermSet)) {
			throw new Error('Ill-formed present verb forms term set')
		}
	} else if (util.illFormedOpts(verbFormsTermSetSchema, verbFormsTermSet)) {
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
	 * If `options.noPastDisplayText` is `true`, exclude the past tense form, `options.verbFormsTermSet.past`, from the display `text` object. Instead, substitute the `past` form when input with the verb's correct present tense form.
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

	// The terminal rule for the simple past tense verb form (or, preterite), chosen by the parent nonterminal rule property `grammaticalForm` and accepted when input by matching `acceptedTense`. E.g., "was", "liked", "did", "had".
	if (!options.noPastRules) {
		verbSym.addRule(createVerbTerminalRule(verbFormsTermSet.past, verbTextForms, 'past'))
	}

	// If provided, the terminal rule for the present-subjunctive verb form, substituted when input with `verbTextForms`. E.g., "be".
	if (verbFormsTermSet.presentSubjunctive) {
		verbSym.addRule(createVerbTerminalRule(verbFormsTermSet.presentSubjunctive, verbTextForms, 'present'))
	}

	// If provided, the terminal rule for the present-participle verb form, substituted when input with `verbTextForms`. E.g., "being", "liking".
	if (verbFormsTermSet.presentParticiple) {
		verbSym.addRule(createVerbTerminalRule(verbFormsTermSet.presentParticiple, verbTextForms, 'present'))
	}

	// If provided, the terminal rule for the past-participle verb form, substituted when input with `verbTextForms` (and substituted with `past` if the parent rule has matching `acceptedTense`). E.g., "been", "done".
	if (verbFormsTermSet.pastParticiple) {
		verbSym.addRule(createVerbTerminalRule(verbFormsTermSet.pastParticiple, verbTextForms, 'past'))
	}

	// Assign terminal rule set properties to the `NSymbol` after adding all rules in the terminal rule set, to prevent further adding rules to `verbSym`.
	verbSym.isTermSet = true
	verbSym.termSetType = 'verb'

	// Specify `verbSym` only produces terminal rules for the present-tense verb forms.
	verbSym.isPresentVerb = !!options.noPastRules

	/**
	 * Save `verbTextForms`, which is identical for every terminal rule `verbSym` produces, as the terminal rule set's default text.
	 *
	 * For use when nesting `verbSym` in the first accepted rule of a term sequence. If so, that new term sequence uses `verbSym.defaultText` in its default text, which it uses as the display text for its substitution rules, if any.
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
 * Creates an `NSymbol` that produces a terminal rule set for invariable terms (i.e., `pfsearch` can not inflect the terms during parsing).
 *
 * Each terminal rule created from `options.acceptedTerms` has its term (i.e., the terminal symbol) as its `text` string, and each terminal rule created from `options.substitutedTerms`, if provided, has the first term in `options.acceptedTerms` has its `text` string. `pfsearch` does not attempt to conjugate these (invariable) terms.
 *
 * Note: Each of the strings in `options.acceptedTerms` and `options.substitutedTerms` becomes a terminal symbol, and can not contain whitespace.
 *
 * The returned `NSymbol` has the following properties:
 * 1. `name` - `options.symbolName`.
 * 2. `isTermSet` - `true`. Prevents adding more rules to this `NSymbol`.
 * 3. `termSetType` - 'invariable'.
 * 4. `defaultText` - The `text` string of the first terminal symbol in `options.acceptedTerms`. For use when nesting this `NSymbol` in a term sequence.
 *
 * @memberOf terminalRuleSetMethods
 * @param {Object} options The options object.
 * @param {string} options.symbolName The name for the new `NSymbol`.
 * @param {number} [options.insertionCost] The insertion cost for the terminal rule set, assigned to the first term in `options.acceptedTerms`. Enables the creation of insertion rules using the symbol that produces this set.
 * @param {string[]} options.acceptedTerms[] The invariable terms accepted when input.
 * @param {(string|SubstitutedTerm)[]} [options.substitutedTerms[]] The invariable terms substituted when input with the first term in `options.acceptedTerms`, defined with cost penalties (`SubstitutedTerm`) or without (`string`).
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

	// Add a terminal rule for each invariable term accepted when input.
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

	// Add a terminal rules for each term that is substituted when input with the first term in `options.acceptedTerms`.
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
	 * For use when nesting `termSym` in the first accepted rule of a term sequence. If so, that new term sequence uses `termSym.defaultText` in its default text, which it uses as the display text for its substitution rules, if any.
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
 * Creates an `NSymbol` that produces a terminal rule sequence forming a term or phrase, comprised of terminal rule sets (e.g., `g.newVerb()`, `g.newInvariableTerm()`) and nested term sequences.
 *
 * Each item in `options.acceptedTerms` and `options.substitutedTerms` must be one of the following:
 * 1. A terminal rule set created by `terminalRuleSetMethods.newVerb()` or `terminalRuleSetMethods.newInvariableTerm()`.
 * 2. A terminal rule sequence created by this method or `terminalRuleSetMethods.newTermSequenceBinarySymbol()`.
 * 3. An ordered pair containing any combination of #1, #2, or nested ordered pairs from which to recursively create new term sequences.
 *
 * The `defaultText` value (or merger of `defaultText` values) of the first term in `options.acceptedTerms` is used as the `text` value of the rules for the items in `options.substitutedTerms`, if any, which substitutes their `text` values when input.
 *
 * All rules which the new `NSymbol` produces are marked `isTermSequence`, which instructs `calcHeuristicCosts` to do the following:
 * 1. For non-edit rules, `calcHeuristicCosts` merges the `text` values of the matched terminal rules it produces.
 * 2. For insertion rules, `calcHeuristicCosts` traverses the single child node, gets the `text` values of the matched terminal rules, and merges those `text` values with the rule's insertion `text` according to its `insertedSymIdx` property.
 * 3. For substitution rules, `calcHeuristicCosts` uses the `text` value of the rule and ignores the matched terminal rules it produces.
 *
 * For all three, `calcHeuristicCosts` creates a new, terminal `ruleProps` for the rule with the `text` value as specified, which `pfsearch` uses to generate display text. `calcHeuristicCosts` also always traverses the matched terminal rules to get the input tense of any matched verb terminal rules, which `pfsearch` uses if the parent rule has matching `acceptedTense`.
 *
 * After flattening nested term sequence pairs in `options.acceptedTerms` and `options.substitutedTerms:
 * • If `options.isVerb` is `true`, checks every term sequence contains exactly one verb terminal rule set.
 * • If `options.isVerb` is falsey, checks every term sequence contains zero verb terminal rule sets.
 *
 * The returned `NSymbol` has the following properties:
 * 1. `name` - `options.symbolName`.
 * 2. `isTermSequence` - `true`. Prevents adding more rules to this `NSymbol`.
 * 3. `isVerb` - `options.isVerb`.
 * 4. `defaultText` - The `defaultText` value (or merger of `defaultText` values) of the first term set or term sequence in `options.acceptedTerms`. For use when nesting this `NSymbol` in another term sequence.
 *
 * @memberOf terminalRuleSetMethods
 * @param {Object} options The options object.
 * @param {string} options.symbolName The name for the new `NSymbol`.
 * @param {boolean} [options.isVerb] Specify every term sequence the new `NSymbol` produces, accepted or substituted, contains exactly one verb terminal rule set (created by `terminalRuleSetMethods.newVerb()`).
 * @param {(NSymbol|NSymbol[])[]} options.acceptedTerms The term sets and term sequences to accept when input, parameterized as described above.
 * @param {(NSymbol|NSymbol[])[]} [options.substitutedTerms] The term sets and term sequences to substitute when input with the first item in `options.acceptedTErms`, parameterized as described above.
 * @returns {NSymbol} Returns the new `NSymbol` for the terminal rule sequence.
 */
var termSequenceSchema = {
	symbolName: { type: String, required: true },
	isVerb: Boolean,
	acceptedTerms: { type: Array, arrayType: [ NSymbol, Array ], required: true },
	substitutedTerms: { type: Array, arrayType: [ NSymbol, Array ] },
}

exports.newTermSequence = function (options) {
	if (util.illFormedOpts(termSequenceSchema, options)) {
		throw new Error('Ill-formed term sequence')
	}

	// Create the `NSymbol` that produces the terminal rule sequence.
	var termSeqSym = this.newSymbol(options.symbolName)
	/**
	 * The `defaultText` value (or merger of `defaultText` values) of the first term set or term sequence in `options.acceptedTerms`.
	 *
	 * For use as the `text` value of the rules for the term sets and term sequences in `options.substitutedTerms`, if any, which substitutes their `text` values when input.
	 *
	 * Can be an invariable term string, a conjugative verb object, or an array of both.
	 */
	var defaultText

	options.acceptedTerms.forEach(function (term, i) {
		/**
		 * If `term` is a terminal rule set created by `terminalRuleSetMethods.newVerb()` or `terminalRuleSetMethods.newInvariableTerm()`, or a terminal rule sequence created by `terminalRuleSetMethods.newTermSetSet()` or `terminalRuleSetMethods.newTermSequenceBinarySymbol()`.
		 *
		 * An example where `term` is the terminal rule set `[make]`:
		 *   `[create]` -> `[make]` -> "make", text: `{make-verb-forms}`
		 *
		 * An example where `term` a terminal rule sequence `[work-on]`:
		 *   `[contribute-to]` -> `[work-on]` -> `[work]` -> "work", text: `{work-verb-forms}`
		 *                                    -> `[on]`   -> "on",   text: "on"
		 */
		if (term.isTermSet || term.isTermSequence) {
			// If `options.isVerb`, check `term` is either a verb terminal rule set or a verb term sequence, else `term` is neither a verb terminal rule nor a verb term sequence.
			if (isIllFormedTermSequenceItem(term, options.isVerb)) {
				throw new Error('Ill-formed term sequence')
			}

			/**
			 * Even though this rule is unary and does not require `text` merging, the rule is still assigned `isTermSequence` to instruct `calcHeuristicCosts` to bring the `text` up to this rule's node level, allowing `gramProps` to conjugate the `text` (`gramProps` only conjugates the immediate child nodes).
			 *
			 * Even if `term` is a verb terminal rule set, for which the `text` value of every terminal rule is identical, do not assign that `text` to this rule as if it were a substitution. Although the parsing result will be identical, it is important to distinguish between the two.
			 */
			termSeqSym.addRule({
				rhs: [ term ],
			})

			if (i === 0) {
				/**
				 * Save the `defaultText` of the first term in `options.acceptedTerms` as the display text for `options.substitutedTerms`, if any.
				 * • If `term` is an invariable term, `defaultText` is the display text of its first accepted terminal rule.
				 * • If `term` is a verb, `defaultText` is the identical `text` of all terminal rules in the set.
				 * • If `term` is a term sequence, `defaultText` is the display text of its first accepted term set or term sequence it produces.
				 */
				defaultText = term.defaultText
			}
		}

		/**
		 * If `term` is an ordered pair containing any combination of term sets, term sequences, or nested ordered pairs from which to recursively create new term sequences.
		 *
		 * An example of two term sets:
		 *   `[contribute-to]` -> `[contribute]` -> "contribute", text: `{contribute-verb-forms}`
		 *                     -> `[to]`         -> "to",         text: "to"
		 *
		 * An example of a term set and a term sequence:
		 *   `[have-in-common]` -> `[have]`                    -> "have",   text: `{have-verb-forms}`
		 *                      -> `[in-common]` -> `[in]`     -> "in",     text: "in"
		 *                                       -> `[common]` -> "common", text: "common"
		 *
		 * An example of a term set and a nested ordered pair of two term sets from which to recursively create a new term sequence:
		 *   `[have-in-common]` -> `[have]`                              -> "have", text: `{have-verb-forms}`
		 *                      -> [ `[in]` `[common] ] -> `[in-common]` -> `[in]`     -> "in",     text: "in"
		 *                                                               -> `[common]` -> "common", text: "common"
		 */
		else if (term.constructor === Array) {
			// Recursively flatten any nested ordered pairs to `NSymbol` instances that produce term sequences.
			// Check the term sequence pair agrees with `options.isVerb`.
			var termSeqPair = flattenTermSequencePair(term, options.isVerb)

			// `calcHeuristicCosts` will traverse this rule's child nodes, merge the `text` values of the matched terminal rules it produces, and create a new, terminal `ruleProps` for the rule's node to instruct `pfsearch` to use the merged `text` for display text and not traverse further.
			termSeqSym.addRule({
				rhs: termSeqPair,
			})

			if (i === 0) {
				/**
				 * Merge the `defaultText` values of the first term pair in `options.acceptedTerms` as the display text for `options.substitutedTerms`, if any.
				 * • If an item in the pair an invariable term, its `defaultText` is the display text of its first accepted terminal rule.
				 * • If an item in the pair is a verb, its `defaultText` is the identical `text` of all terminal rules in the set.
				 * • If an item in the pair is a term sequence, its `defaultText` is the display text of its first accepted term set or term sequence it produces.
				 */
				defaultText = grammarUtil.mergeTextPair(termSeqPair[0].defaultText, termSeqPair[1].defaultText)
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
			 * If `term` is a terminal rule set created by `terminalRuleSetMethods.newVerb()` or `terminalRuleSetMethods.newInvariableTerm()`, or a terminal rule sequence created by `terminalRuleSetMethods.newTermSetSet()` or `terminalRuleSetMethods.newTermSequenceBinarySymbol()`.
			 *
			 * A substitution example where `term` is the terminal rule set `[make]`:
			 *   `[like]` -> `[love]`, text: `{like-verb-forms}`
			 *
			 * A substitution example where `term` a terminal rule sequence `[work-on]`:
			 *   `[contribute-to]` -> `[help-with]`, text: `[ {contribute-verb-forms}, "to" ]`
			 */
			if (term.isTermSet || term.isTermSequence) {
				// If `options.isVerb`, check `term` is either a verb terminal rule set or a verb term sequence, else `term` is neither a verb terminal rule nor a verb term sequence.
				if (isIllFormedTermSequenceItem(term, options.isVerb)) {
					throw new Error('Ill-formed term sequence substitution')
				}

				// `pfsearch` uses this rule's `text` property instead of the `text` values of the matched terminal rules it produces.
				termSeqSym.addRule({
					rhs: [ term ],
					text: defaultText,
				})
			}

			/**
			 * If `term` is an ordered pair containing any combination of term sets, term sequences, or nested ordered pairs from which to recursively create new term sequences.
			 *
			 * A substitution example of two term sets:
			 *   `[contribute-to]` -> `[help]` `[with]` text: `[ {contribute-verb-forms}, "to" ]`
			 *
			 * A substitution example of a term set and a term sequence:
			 *   `[share]` -> `[have]` `[in-common]`, text: `{share-verb-forms}`
			 *
			 * A substitution example of a term set and a nested ordered pair of two term sets from which to recursively create a new term sequence:
			 *   `[share]` -> `[have]` [ `[in]` `[common] ] -> `[have]` `[in-common]`, text: `{share-verb-forms}`
			 */
			else if (term.constructor === Array) {
				// Recursively flatten any nested ordered pairs to `NSymbol` instances that produce term sequences.
				// Check the term sequence pair agrees with `options.isVerb`.
				var termSeqPair = flattenTermSequencePair(term, options.isVerb)

				// `pfsearch` uses this rule's `text` property instead of the `text` values of the matched terminal rules it produces.
				termSeqSym.addRule({
					rhs: termSeqPair,
					text: defaultText,
				})
			}

			else {
				util.logError('Term is neither a term set, term sequence, nor an ordered pair of the two:', term)
				throw new Error('Ill-formed term sequence substitution')
			}
		})
	}

	// Assign `termSetSeqSym.isTermSequence` after adding all rules in the term sequence to prevent adding more rules to `termSetSeqSym`.
	termSeqSym.isTermSequence = true

	// Specify every term sequence `termSetSeqSym` produces, accepted or substituted, contains one verb terminal rule set (created by `terminalRuleSetMethods.newVerb()`).
	termSeqSym.isVerb = options.isVerb

	/**
	 * Save `defaultText`, which is the merger of `defaultText` values of the term set(s) or term sequence(s) in this sequence's first accepted rule.
	 *
	 * For use when nesting `termSetSeqSym` in the first accepted rule of another term sequence. If so, that new term sequence uses `termSetSeqSym.defaultText` in its default text, which it uses as the display text for its substitution rules, if any.
	 */
	termSeqSym.defaultText = defaultText

	return termSeqSym
}

/**
 * Creates an `NSymbol` with a single binary rule with `options.termPair` as its `rhs`, which produces a terminal sequence forming a phrase comprised of terminal rule sets and nested term sequences.
 *
 * Each item in `options.termPair` must be one of the following:
 * 1. A terminal rule set created by `terminalRuleSetMethods.newVerb()` or `terminalRuleSetMethods.newInvariableTerm()`.
 * 2. A terminal rule sequence created by `terminalRuleSetMethods.newTermSequence()` or this method.
 * 3. An ordered pair containing any combination of #1, #2, or nested ordered pairs from which to recursively create new term sequences.
 *
 * The single rule the new `NSymbol` produces is marked `isTermSequence`.
 *
 * After flattening nested term sequence pairs within `options.termPair`:
 * • If `options.isVerb` is `true`, checks every term sequence `options.termPair` produces contains exactly one verb terminal rule set.
 * • If `options.isVerb` is falsey, checks every term sequence contains zero verb terminal rule sets.
 *
 * If `_isNestedTermSequence` is `true`, manually checks if `options.termPair` contains a verb to determine the `isVerb` value for the returned `NSymbol`. For use when `options.termPair` was defined as a nested term pair within another term sequence pair passed to this method or `terminalRuleSetMethods.newTermSequence()`. `options.isVerb` only specifies if the entire base sequence contains or lacks a single verb, not every bigram within the sequence; e.g., do not check if "in common" within the verb phrase "have in common" contains a verb.
 *
 * The returned `NSymbol` has the following properties:
 * 1. `name` - The concatenation of the names of the `NSymbol` instances in `options.termPair` (after flattening nested ordered pairs).
 * 2. `isTermSequence` - `true`. Prevents adding more rules to this `NSymbol`.
 * 3. `isVerb` - `options.isVerb`, or if `_isNestedTermSequence` is `true` and `options.termPair` contains a verb.
 * 4. `defaultText` - The merger of the `defaultText` values of the terms in `options.termPair`. For use when nesting this `NSymbol` in another term sequence.
 *
 * @memberOf terminalRuleSetMethods
 * @param {Object} options The options object.
 * @param {boolean} [options.isVerb] Specify every term sequence `options.termPair` produces contains exactly one verb terminal rule set (created by `terminalRuleSetMethods.newVerb()`).
 * @param {NSymbol[]} options.termPair The ordered pair of terms in this sequence.
 * @param {boolean} [_isNestedTermSequence] Specify `options.termPair` was defined as a nested term pair within another term sequence pair passed to this method or `terminalRuleSetMethods.newTermSequence()`.
 * @returns {NSymbol} Returns the new `NSymbol` for the terminal rule sequence.
 */
var binaryTermSequenceSchema = {
	isVerb: Boolean,
	termPair: { type: Array, arrayType: [ NSymbol, Array ], required: true },
}

exports.newTermSequenceBinarySymbol = function (options, _isNestedTermSequence) {
	if (util.illFormedOpts(binaryTermSequenceSchema, options)) {
		throw new Error('Ill-formed binary term sequence')
	}

	/**
	 * Recursively flatten any nested ordered pairs to `NSymbol` instances that produce the nested term sequence.
	 *
	 * Check the term sequence pair agrees with `options.isVerb`. Pass `_isNestedTermSequence` to prevent `flattenTermSequencePair()` from throwing an exception for `options.termPair` containing a verb when `options.isVerb` is falsey.
	 */
	var termSeqPair = flattenTermSequencePair(options.termPair, options.isVerb, _isNestedTermSequence)
	var termA = termSeqPair[0]
	var termB = termSeqPair[1]

	/**
	 * Create the `NSymbol` and the single terminal rule sequence.
	 *
	 * `calcHeuristicCosts` will traverse this rule's child nodes, merge the `text` values of the matched terminal rules it produces, and create a new, terminal `ruleProps` for the rule's node to instruct `pfsearch` to use the merged `text` for display text and not traverse further.
	 */
	var termSeqSym = g.newSymbol(termA.name, termB.name).addRule({
		rhs: termSeqPair,
	})

	// Assign `termSetSeqSym.isTermSequence` after adding all rules in the term sequence to prevent adding more rules to `termSetSeqSym`.
	termSeqSym.isTermSequence = true

	// Specify every term sequence `termSetSeqSym` produces, accepted or substituted, contains one verb terminal rule set (created by `terminalRuleSetMethods.newVerb()`).
	if (_isNestedTermSequence) {
		/**
		 * Manually check whether `termSeqSym` produces a verb when `options.termPair` was defined as a nested term pair within another term sequence pair passed to this method or `terminalRuleSetMethods.newTermSequence()`. This is necessary `options.isVerb` only specifies if the entire entire base sequence (after flattening) contains or lacks a single verb, not every bigram within the sequence.
		 *
		 * For example, consider the following verb term sequence passed to either of the two aforementioned methods:
		 *   `[ `[have]`, [ `[in]` `[common]` ] ]`
		 * This method creates a new `NSymbol` and binary rule for the nested array, `[ `[in]` `[common]` ]`, but can not use the truthy `isVerb` value passed with the root array because it is incorrect for this subrule within the verb phrase.
		 *
		 * Further, consider the following restructuring of the same verb sequence:
		 *   `[ [ `[have]` `[in]` ], `[common]` ]`
		 * As the previous example demonstrates, this method can not rely on `isVerb` for nested term sequences. Hence, it manually checks if such nested pairs contain a verb.
		 *
		 * Perform this check after invoking `flattenTermSequencePair()` with `termSeqPair` above to ensure the term sequence is flattened and valid (e.g., `termSeqPair` items are not both verbs).
		 */
		termSeqSym.isVerb = termSeqPair.some(exports.isVerbTerm)
	} else {
		termSeqSym.isVerb = options.isVerb
	}

	/**
	 * Save `defaultText`, which is the merger of `defaultText` values of the term set(s) or term sequence(s) in this sequence's (only) binary rule.
	 *
	 * For use when nesting `termSetSeqSym` in the first accepted rule of another term sequence. If so, that new term sequence uses `termSetSeqSym.defaultText` in its default text, which it uses as the display text for its substitution rules, if any.
	 */
	termSeqSym.defaultText = grammarUtil.mergeTextPair(termA.defaultText, termB.defaultText)

	return termSeqSym
}

/**
 * Checks `termSeqPair` is a valid term sequence pair and recursively flattens any nested ordered pairs to `NSymbol` instances that produce the nested term sequence.
 *
 * Each item in `termSeqPair` must be one of the following:
 * 1. A terminal rule set created by `terminalRuleSetMethods.newVerb()` or `terminalRuleSetMethods.newInvariableTerm()`.
 * 2. A terminal rule sequence created by `terminalRuleSetMethods.newTermSequence()` or `terminalRuleSetMethods.newTermSequenceBinarySymbol()`.
 * 3. An ordered pair containing any combination of #1, #2, or nested ordered pairs from which to recursively create new term sequences with `terminalRuleSetMethods.newTermSequenceBinarySymbol()`.
 *
 * After flattening nested term sequence pairs within `termSeqPair`:
 * • If `isVerb` is `true`, checks every term sequence `termSeqPair` produces contains exactly one verb terminal rule set.
 * • If `isVerb` is falsey and `isNestedTermSequence` is falsey, checks every term sequence contains zero verb terminal rule sets.
 *
 * Returns a flattened ordered pair of `NSymbol` instances, for use as a `rhs` in a binary rule for a term sequence.
 *
 * @private
 * @static
 * @param {(NSymbol|NSymbol[])[]} termSeqPair The term set ordered pair to validate and flatten.
 * @param {boolean} isVerb Specify every term sequence `termSeqPair` produces contains exactly one verb terminal rule set (created by `terminalRuleSetMethods.newVerb()`).
 * @param {boolean} [isNestedTermSequence] Specify `termSeqPair` was defined as a nested term pair within another term sequence pair passed to `terminalRuleSetMethods.newTermSequenceBinarySymbol()` or `terminalRuleSetMethods.newTermSequence()`.
 * @returns {NSymbol} Returns the flattened term sequence ordered pair.
 */
function flattenTermSequencePair(termSeqPair, isVerb, isNestedTermSequence) {
	var termSeqLen = termSeqPair.length
	if (termSeqLen !== 2) {
		util.logError('Term sequence is not an ordered pair:', termSeqPair)
		throw new Error('Ill-formed term sequence pair')
	}

	for (var s = 0; s < termSeqLen; ++s) {
		var termSym = termSeqPair[s]
		if (termSym.constructor === Array) {
			if (termSym.length !== 2) {
				util.logError('Nested term sequence is not an ordered pair:', termSym)
				throw new Error('Ill-formed term sequence pair')
			}

			/**
			 * Recursively create an `NSymbol` that produces a single binary rule for the term sequence of this nested ordered pair.
			 *
			 * Pass `true` for the method's second parameter, `isNestedTermSequence`, to instruct the method to manually check if the pair `termSym` contains a verb, and do not pass `isVerb`. This is necessary `isVerb` only specifies if the entire base sequence contains or lacks a single verb, not every bigram within the sequence (i.e., recursive invocations of this function). E.g., do not check if "in common" within the verb phrase "have in common" contains a verb.
			 */
			termSeqPair[s] = exports.newTermSequenceBinarySymbol({ termPair: termSym }, true)
		} else if (!termSym.isTermSet && !termSym.isTermSequence) {
			util.logError('Term is neither a term set nor a term sequence:', termSym)
			throw new Error('Ill-formed term sequence')
		}
	}

	/**
	 * After flattening nested term sequence pairs within `termSeqPair`:
	 * • If `isVerb` is `true`, check every term sequence `termSeqPair` produces contains exactly one verb terminal rule set.
	 * • If `isVerb` is falsey and `isNestedTermSequence` is falsey, check every term sequence contains zero verb terminal rule sets.
	 */
	if (isIllFormedTermSequencePair(termSeqPair, isVerb, isNestedTermSequence)) {
		throw new Error('Ill-formed term sequence pair')
	}

	// The flattened ordered pair of `NSymbol` instances for use as a `rhs` in a binary rule for a term sequence.
	return termSeqPair
}

/**
 * Checks if `term` disagrees with `isVerb` for a new term sequence. If so, prints an error message.
 *
 * If `isVerb` is `true`, `term` must be either a verb terminal rule set (`term.termSetType === 'verb'`) or a verb term sequence (`term.isVerb`), else `term` is neither a verb terminal rule set nor a verb term sequence.
 *
 * @private
 * @static
 * @param {Object} term The term set or term sequence to inspect.
 * @param {boolean} isVerb Specify `term` should be a verb terminal rule set or a verb term sequence.
 * @returns {boolean} Returns `true` if `term` disagrees with `isVerb`, else `false`.
 */
function isIllFormedTermSequenceItem(term, isVerb) {
	if (isVerb) {
		if (!exports.isVerbTerm(term)) {
			util.logError('Non-verb provided to verb term sequence:', term)
			return true
		}
	} else if (isForbiddenVerb(term)) {
		return true
	}

	return false
}

/**
 * Checks if `termSeqPair` disagrees with `isVerb` for a new term sequence pair. If so, prints an error message.
 *
 * If `isVerb` is `true`, every term sequence `termSeqPair` produces must contain exactly one verb terminal rule set. Else, throws an exception.
 * • Temporarily forbids a term sequence to produce multiple verbs to prevent multiple instances of `tense` within a single sequence. `calcHeuristicCosts` does not support mapping a terminal rule's input tense to a particular item in the merged `text` array when flattening the term sequence's subtree.
 *
 * If `isVerb` is falsey and `isNestedTermSequence` is falsey, checks every term sequence contains zero verb terminal rule sets. Else, throws an exception.
 * • `isNestedTermSequence` must be falsey because `isVerb` only specifies if the entire base sequence contains or lacks a single verb, not every bigram within the sequence. For example, the function does not check if "in common" within the verb sequence "have in common" contains verb; ergo, `isVerb` is unavailable should the nested pair be "have in", though the pair contains a verb.
 *
 * @private
 * @static
 * @param {NSymbol[]} termSeqPair The term sequence ordered pair to inspect.
 * @param {boolean} isVerb Specify every term sequence `termSeqPair` produces contains exactly one verb terminal rule set.
 * @param {falsey} [isNestedTermSequence] Specify `termSeqPair` was defined as a nested term pair within another term sequence pair passed to `terminalRuleSetMethods.newTermSequenceBinarySymbol()` or `terminalRuleSetMethods.newTermSequence()`.
 * @returns {boolean} Returns `true` if `termSeqPair` disagrees with `isVerb`, else `false`.
 */
function isIllFormedTermSequencePair(termSeqPair, isVerb, isNestedTermSequence) {
	if (termSeqPair.length !== 2) {
		util.logError('Term sequence is not an ordered pair:', termSeqPair)
		throw new Error('Ill-formed term sequence pair')
	}

	// Always check if both terms in the pair are verbs, irrespective of `isVerb` and `isNestedTermSequence`.
	if (termSeqPair.every(exports.isVerbTerm)) {
		util.logError('Two verbs provided in a single verb term sequence pair:', termSeqPair)
		return true
	}

	if (isVerb) {
		if (!termSeqPair.some(exports.isVerbTerm)) {
			util.logError('No verbs provided in a verb term sequence pair:', termSeqPair)
			return true
		}
	} else if (!isNestedTermSequence) {
		/**
		 * Only alert if there are verbs when `isVerb` is falsey if `isNestedTermSequence` is also falsey. This is necessary `isVerb` only specifies if the entire base sequence contains or lacks a single verb, not every bigram within the sequence.
		 *
		 * For example, this function does not check if "in common" within the verb sequence "have in common" contains verb; ergo, `isVerb` is unavailable should the nested pair be "have in", though the pair contains a verb.
		 */
		if (termSeqPair.some(isForbiddenVerb)) {
			return true
		}
	}

	return false
}

/**
 * Checks if `term` is either a verb terminal rule set (created by `terminalRuleSetMethods.newVerb()`) or a verb term sequence (created by terminalRuleSetMethods.newInvariableTerm()`).
 *
 * @memberOf terminalRuleSetMethods
 * @param {NSymbol} term The terminal rule set or term sequence to inspect.
 * @returns {boolean} Returns `true` if `term` is either a verb terminal rule set or verb term sequence, else `false`.
 */
exports.isVerbTerm = function (term) {
	return term.isTermSet && term.termSetType === 'verb' || term.isTermSequence && term.isVerb
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
		util.logError('Verb term set provided to non-verb term sequence (i.e., `isVerb` is falsey):', term)
		return true
	}

	if (term.isTermSequence && term.isVerb) {
		util.logError('Verb term sequence provided to non-verb term sequence (i.e., `isVerb` is falsey):', term)
		return true
	}

	return false
}