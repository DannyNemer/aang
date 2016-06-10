/**
 * Methods, which `grammar` inherits, that create `NSymbol` instances that produce term sequences.
 *
 * All possible reductions (i.e., subtrees) of term sequences yield only display text, no semantics. Hence, all subtrees each term sequence produces are semantically identical. `flattenTermSequence` flattens these symbols' parse nodes to single terminal nodes with a single display text.
 *
 * These methods create an `NSymbol` for the rule sets, as opposed to adding rules to an existing `NSymbol`, and prevent adding rules to the new `NSymbol` afterward, to prevent external changes to the rule sets.
 */

var util = require('../util/util')
var g = require('./grammar')
var NSymbol = require('./NSymbol')
var grammarUtil = require('./grammarUtil')


// Even though this resembles an enumerated type, do not map the term sequence types to numbers to allow the type names to appear when printed to the console.
exports.Type = {
	INVARIABLE: 'invariable',
	PRONOUN: 'pronoun',
	VERB: 'verb',
	VERB_PAST: 'verb-past',
	VERB_PRESENT: 'verb-present',
}

/**
 * The inflections of a verb, from which `termSequence.newVerb()` creates a verb terminal rule set.
 *
 * Each rule in this set has an object as its `text` with the properties `oneSg`, `threeSg`, `pl`, and `past`. When constructing parse trees, `pfsearch` conjugates this `text` object to the correct verb form (i.e., display text) according to grammatical properties in preceding nonterminal rules in the same tree.
 *
 * The person-number forms, `oneSg`, `threeSg`, and `pl`, are conjugated by the `personNumber` property in preceding nominative rules.
 *
 * The tense form, `past`, is conjugated by the `grammaticalForm` property in the (immediate) parent nonterminal rule. Also, if the parent rule has `acceptedTense` set to `past`, it accepts the `past` form when input, but does not conjugate to it otherwise (unlike `grammaticalForm`).
 *
 * The grammar generator and `pfsearch` use neither `presentSubjunctive`, `presentParticiple`, nor `pastParticiple` for conjugation. Rather, they serve only to enforce complete definitions of verbs for complete substitution sets, replaced when input by one of the forms in the set with conjugation support.
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
 * The present tense inflections of a verb, from which `termSequence.newVerb(options)` with `options.tense` as 'present', creates a present tense verb terminal rule set.
 *
 * Each rule in this set has an object as its `text` with the properties `oneSg`, `threeSg`, and `pl`. When constructing parse trees, `pfsearch` conjugates this `text` object to the correct verb form (i.e., display text) according to grammatical properties in preceding nonterminal rules in the same tree.
 *
 * The person-number forms, `oneSg`, `threeSg`, and `pl`, are conjugated by the `personNumber` property in preceding nominative rules.
 *
 * The grammar generator and `pfsearch` use neither `presentSubjunctive` nor `presentParticiple` for conjugation. Rather, they serve only to enforce complete definitions of verbs for complete substitution sets, replaced when input by one of the forms in the set with conjugation support.
 *
 * Inherits the present tense properties of `VerbFormsTermSet`.
 *
 * @typedef {Object} PresentVerbFormsTermSet
 * @property {string} oneSg The first-person-singular verb form, chosen by the nonterminal rule property `personNumber`. E.g., "am", "was", "like".
 * @property {string} threeSg The third-person-singular verb form, chosen by the nonterminal rule property `personNumber`. E.g., "is", "was", "likes".
 * @property {string} pl The plural verb form, chosen by the nonterminal rule property `personNumber`. E.g., "are", "were" "like".
 * @property {string} [presentSubjunctive] The present-subjunctive verb form, substituted when input with one of the first three forms. E.g., "be".
 * @property {string} [presentParticiple] The present-participle verb form, substituted when input with one of the first three forms. E.g., "being", "liking".
 */
var presentVerbFormsTermSetSchema = {
	oneSg: verbFormsTermSetSchema.oneSg,
	threeSg: verbFormsTermSetSchema.threeSg,
	pl: verbFormsTermSetSchema.pl,
	presentSubjunctive: verbFormsTermSetSchema.presentSubjunctive,
	presentParticiple: verbFormsTermSetSchema.presentParticiple,
}

/**
 * The past tense inflections of a verb, from which `termSequence.newVerb(options)` with `options.tense` as 'past', creates a past tense verb terminal rule set.
 *
 * Each rule in this set is an invariable term with a string as its `text`. `pfsearch` can not conjugate these terms during parsing.
 *
 * The grammar generator and `pfsearch` do not use `pastParticiple` for conjugation. Rather, it serves only to enforce complete definitions of verbs for complete substitution sets, replaced when input by one of the forms in the set with conjugation support.
 *
 * Inherits the past tense properties of `VerbFormsTermSet`.
 *
 * @typedef {Object} PastVerbFormsTermSet
 * @property {string} past The simple past tense verb form (or, preterite), accepted when input. E.g., "was", "liked", "did", "had".
 * @property {string} [pastParticiple] The past-participle verb form, substituted when input with `past`. E.g., "been", "done".
 */
var pastVerbFormsTermSetSchema = {
	past: verbFormsTermSetSchema.past,
	pastParticiple: verbFormsTermSetSchema.pastParticiple,
}

/**
 * Creates an `NSymbol` that produces a terminal rule set for a verb with the necessary text forms for conjugation.
 *
 * If `options.tense` is not 'present' or `undefined`, each terminal rule in the set has an object as its `text` with the properties `oneSg`, `threeSg`, `pl`, and `past` (if `options.tense` is `undefined`) for the different verb forms. When constructing parse trees, `pfsearch` conjugates the `text` object to the correct verb form (i.e., display text) according to grammatical properties in preceding nonterminal rules in the same tree.
 *
 * Otherwise, if `options.tense` is 'past', each terminal rule has the string `options.verbFormsTermSet.past` has its `text` value, and `pfsearch` does not conjugate the verb set.
 *
 * Note: `options.tense` and `options.noPastDisplayText` are mutually exclusive.
 *
 * Note: Each of the verb forms in `options.verbFormsTermSet` becomes a terminal symbol, and can not contain whitespace.
 *
 * The returned `NSymbol` has the following properties:
 * • name - `options.symbolName`.
 * • isTermSequence - `true`. Enables nesting within term sequences and flattening in `flattenTermSequence`.
 * • isTermSet - `true`. Specifies every rule is a uni-token terminal rule with the same `text` value.
 * • termSequenceType - 'verb'.
 * • verbTense - `options.tense`, if defined.
 * • defaultText - If `options.tense` is 'present' or `undefined`, the conjugative `text` object for the forms of this verb, else if `options.tense` is 'past', the invariable `text` string for `options.verbFormsTermSet.past`. This value is identical for every terminal rule this `NSymbol` produces. For use when nesting this `NSymbol` in a term sequence.
 * • insertionCost - `options.insertionCost`, if defined.
 *
 * @memberOf termSequence
 * @param {Object} options The options object.
 * @param {string} options.symbolName The name for the new `NSymbol`.
 * @param {number} [options.insertionCost] The insertion cost for the terminal rule set, assigned to the first rule in the set (i.e., `verbFormsTermSet.oneSg`). Enables the creation of insertion rules using the new `NSymbol` which produces this set (i.e., the LHS symbol).
 * @param {string} [options.tense] The grammatical tense, 'present' or 'past', for which to limit the verb terminal rule set; i.e., exclude all verb forms for the opposite tense.
 * @param {boolean} [options.noPastDisplayText] Specify excluding the past tense verb forms, `options.verbFormsTermSet.past`, from the display `text` object. Instead, substitute the `past` form when input with the verb's correct present tense form. Unlike `options.tense`, this creates terminal rules for the past tense verb forms for substitution.
 * @param {VerbFormsTermSet|PresentVerbFormsTermSet|PastVerbFormsTermSet} options.verbFormsTermSet The verb terminal rule set with each verb form inflection. `PresentVerbFormsTermSet` if `options.tense` is 'present', `PastVerbFormsTermSet` if `options.tense` is 'past', or `VerbFormsTermSet` if `options.tense` is `undefined`.
 * @returns {NSymbol} Returns the new `NSymbol` for the verb terminal rule set.
 */
var verbSchema = {
	symbolName: { type: String, required: true },
	insertionCost: Number,
	tense: { values: [ 'present', 'past' ] },
	noPastDisplayText: Boolean,
	verbFormsTermSet: { type: Object, required: true },
}

exports.newVerb = function (options) {
	if (util.illFormedOpts(verbSchema, options) || isIllFormedNewVerbOptions(options)) {
		throw new Error('Ill-formed verb')
	}

	/**
	 * If `options.tense` is 'past', create a terminal rule set with `termSequence.newTermSequence()`, where each rule has the string `options.verbFormsTermSet.past` has its `text` value.
	 *
	 * Else if `options.tense` is 'present', create a terminal rule set where each rule has an object as its `text` with the properties `oneSg`, `threeSg`, and `pl` for the different present tense verb forms.
	 *
	 * Else if `options.tense` is `undefined`, create a terminal rule set where each rule has an object as its `text` with the properties `oneSg`, `threeSg`, `pl`, and `past` for the different verb forms.
	 */
	var tense = options.tense
	var verbSym = tense === 'past' ? newPastVerb(options) : baseNewVerb(options)

	/**
	 * Specify all possible `verbSym` reductions (i.e., subtrees) yield only display text, no semantics. Hence, all subtrees `verbSym` produces are semantically identical. Instructs `flattenTermSequence` to flatten instances of `verbSym` to a single terminal parse node with a single display text.
	 *
	 * Assign `isTermSequence` after adding all `verbSym` rules above because `NSymbol.prototype.addRule()` prevents invocation on `NSymbol` instances with `isTermSequence`.
	 */
	verbSym.isTermSequence = true

	// Specify every rule `verbSym` produces is a uni-token terminal rule with the same `text` (display text) value. A terminal rule set is subset of term sequences.
	verbSym.isTermSet = true

	// Specify `verbSym` is a verb. If `options.tense` is defined, `verbSym` only produces terminal rules for the given grammatical tense; i.e., lacks terminal rules for the opposite tense.
	verbSym.termSequenceType = tense === undefined ? 'verb' : (tense === 'present' ? 'verb-present' : 'verb-past')

	// Save `insertionCost` for convenience; unused internally.
	verbSym.insertionCost = options.insertionCost

	return verbSym
}

/**
 * Creates an `NSymbol` that produces a terminal rule set for a verb with the necessary text forms for conjugation.
 *
 * Each terminal rule in the set has an object as its `text` with the properties `oneSg`, `threeSg`, `pl`, and `past` (if `options.tense` is `undefined`) for the different verb forms. When constructing parse trees, `pfsearch` conjugates the `text` object to the correct form (i.e., display text) according to grammatical properties in preceding nonterminal rules in the same tree.
 *
 * Note: `options.tense` and `options.noPastDisplayText` are mutually exclusive.
 *
 * Note: Each of the verb forms in `options.verbFormsTermSet` becomes a terminal symbol, and can not contain whitespace.
 *
 * For use by `termSequence.newVerb(options)` when `options.tense` is 'present' or `undefined`.
 *
 * The returned `NSymbol` has the following properties, to be expended by `termSequence.newVerb()`:
 * 1. name - `options.symbolName`.
 * 2. defaultText - The conjugative `text` object for the forms of this verb. This value is identical for every terminal rule this `NSymbol` produces. For use when nesting this `NSymbol` in a term sequence.
 *
 * @private
 * @static
 * @param {Object} options The `termSequence.newVerb()` options object.
 * @param {string} options.symbolName The name for the new `NSymbol`.
 * @param {number} [options.insertionCost] The insertion cost for the terminal rule set, assigned to the first rule in the set (i.e., `verbFormsTermSet.oneSg`). Enables the creation of insertion rules using the new `NSymbol` which produces this set (i.e., the LHS symbol).
 * @param {string} [options.tense] The grammatical tense, 'present', for which to limit the verb terminal rule set; i.e., exclude all past tense verb forms.
 * @param {boolean} [options.noPastDisplayText] Specify excluding the past tense verb forms, `options.verbFormsTermSet.past`, from the display `text` object. Instead, substitute the `past` form when input with the verb's correct present tense form. Unlike `options.tense`, this creates terminal rules for the past tense verb forms for substitution.
 * @param {VerbFormsTermSet|PresentVerbFormsTermSet} options.verbFormsTermSet The verb terminal rule set with each verb form inflection. `PresentVerbFormsTermSet` if `options.tense` is 'present', or `VerbFormsTermSet` if `options.tense` is `undefined`.
 * @returns {NSymbol} Returns the new `NSymbol` for the verb terminal rule set.
 */
function baseNewVerb(options) {
	if (options.tense === 'past') {
		util.logError('`baseNewVerb()` invoked with past tense verb options object:', options)
		throw new Error('Ill-formed verb')
	}

	// Create the `NSymbol` that produces the verb terminal rule set.
	var verbSym = g.newSymbol(options.symbolName)
	var verbFormsTermSet = options.verbFormsTermSet

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
	// Check if distinguishable from the first-person-singular verb form; e.g., "was". Do not check if other verb forms are unique; rather, allow `NSymbol.prototype._newTerminalRule()` to throw the exception for duplicate terminal symbols.
	if (verbFormsTermSet.threeSg !== verbFormsTermSet.oneSg) {
		verbSym.addRule(createVerbTerminalRule(verbFormsTermSet.threeSg, verbTextForms, 'present'))
	}

	// The terminal rule for the the plural verb form, chosen by the nonterminal rule property `personNumber`. E.g., "are", "were" "like".
	// Check if distinguishable from the first-person-singular verb form; e.g., "like". Do not check if other verb forms are unique; rather, allow `NSymbol.prototype._newTerminalRule()` to throw the exception for duplicate terminal symbols.
	if (verbFormsTermSet.pl !== verbFormsTermSet.oneSg) {
		verbSym.addRule(createVerbTerminalRule(verbFormsTermSet.pl, verbTextForms, 'present'))
	}

	// The terminal rule for the simple past tense verb form (or, preterite), chosen by the parent nonterminal rule property `grammaticalForm` and accepted when input by matching `acceptedTense`. E.g., "was", "liked", "did", "had".
	if (options.tense !== 'present') {
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
 * For use by `termSequence.newVerb()`.
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

	if (verbSchema.tense.values.indexOf(tense) === -1) {
		util.logError('Unrecognized verb rule grammatical tense:', util.stylize(tense))
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
 * Creates an `NSymbol` that produces a terminal rule set for the past tense forms of a verb; i.e., excludes all present tense verb forms.
 *
 * Uses `termSequence.newTermSequence()` to create the invariable terminal rule set, where each rule has the string `options.verbFormsTermSet.past` as its `text` value. `pfsearch` can not conjugate the verb set.
 *
 * For use by `termSequence.newVerb(options)` when `options.tense` is 'past'.
 *
 * The returned `NSymbol` has the following properties, to be expended by `termSequence.newVerb()`:
 * 1. name - `options.symbolName`.
 * 2. isTermSequence - `true`. Enables nesting within term sequences and flattening in `flattenTermSequence`.
 * 2. defaultText - The invariable `text` string for `options.verbFormsTermSet.past`. This value is identical for every terminal rule this `NSymbol` produces. For use when nesting this `NSymbol` in a term sequence.
 *
 * @private
 * @static
 * @param {Object} options The `termSequence.newVerb()` options object.
 * @param {string} options.symbolName The name for the new `NSymbol`.
 * @param {number} [options.insertionCost] The insertion cost for the terminal rule set, assigned to the first rule in the set (i.e., `verbFormsTermSet.past`). Enables the creation of insertion rules using the new `NSymbol` which produces this set (i.e., the LHS symbol).
 * @param {string} options.tense The grammatical tense, 'past', for which to limit the verb terminal rule set; i.e., exclude all present tense verb forms.
 * @param {PastVerbFormsTermSet} options.verbFormsTermSet The verb terminal rule set with each past tense verb form inflection.
 * @returns {NSymbol} Returns the new `NSymbol` for the past tense verb terminal rule set.
 */
function newPastVerb(options) {
	if (options.tense !== 'past') {
		util.logError('`newPastVerb()` invoked with non-past tense verb options object:', options)
		throw new Error('Ill-formed past verb')
	}

	var verbFormsTermSet = options.verbFormsTermSet

	var pastVerbTermSet = {
		symbolName: options.symbolName,
		type: 'invariable',
		acceptedTerms: [ verbFormsTermSet.past ],
	}

	if (options.insertionCost !== undefined) {
		pastVerbTermSet.insertionCost = options.insertionCost
	}

	if (verbFormsTermSet.pastParticiple) {
		pastVerbTermSet.substitutedTerms = [ verbFormsTermSet.pastParticiple ]
	}

	// `termSequence.newVerb(options)` will extend `newVerb` with the property `isTermSet` and will redefine `termSequenceType` as 'verb'.
	var newVerb = g.newTermSequence(pastVerbTermSet)

	return newVerb
}

/**
 * Checks if `options`, which was passed to `termSequence.newVerb()`, is ill-formed. If so, prints an error.
 *
 * @private
 * @static
 * @param {Object} options The `termSequence.newVerb()` options object to inspect.
 * @returns {boolean} Returns `true` if `options` is ill-formed, else `false`.
 */
function isIllFormedNewVerbOptions(options) {
	var verbFormsTermSet = options.verbFormsTermSet

	if (options.tense) {
		// Properties `verbSchema.tense` and `verbSchema.noPastDisplayText` are mutually exclusive.
		if (options.noPastDisplayText) {
			util.logErrorAndPath('Verb with `tense` defines `noPastDisplayText` as `true`:', options)
			return true
		}

		// Print specific errors for verb of a tense containing the forms of the other tense.
		if (options.tense === 'present') {
			for (var verbForm in pastVerbFormsTermSetSchema) {
				if (verbFormsTermSet.hasOwnProperty(verbForm)) {
					util.logErrorAndPath(`Present tense verb has forbidden \`${verbForm}\` verb form:`, options)
					return true
				}
			}

			if (util.illFormedOpts(presentVerbFormsTermSetSchema, verbFormsTermSet)) {
				return true
			}
		} else if (options.tense === 'past') {
			for (var verbForm in presentVerbFormsTermSetSchema) {
				if (verbFormsTermSet.hasOwnProperty(verbForm)) {
					util.logErrorAndPath(`Past tense verb has forbidden \`${verbForm}\` verb form:`, options)
					return true
				}
			}

			if (util.illFormedOpts(pastVerbFormsTermSetSchema, verbFormsTermSet)) {
				return true
			}
		}
	} else if (util.illFormedOpts(verbFormsTermSetSchema, verbFormsTermSet)) {
		return true
	}

	return false
}

/**
 * The inflections of a pronoun, from which `termSequence.newPronoun()` creates a pronoun terminal rule set.
 *
 * Each terminal rule in the set has an object as its `text` with the properties `nom` and `obj` for the different personal pronoun case forms. When constructing parse trees, `pfsearch` conjugates the `text` object to the grammatical case (i.e., display text) according to the `grammaticalForm` property on the (immediate) parent rule.
 *
 * Note: Each of the pronoun forms becomes a terminal symbol, and can not contain whitespace.
 *
 * @typedef {Object} PronounFormsTermSetSchema
 * @property {string} nom The nominative case form, used as the subject of a verb, chosen by the parent nonterminal rule property `grammaticalForm`. E.g., "I", "we".
 * @property {string} obj The objective case form, used as the object of a verb, chosen by the parent nonterminal rule property `grammaticalForm`. E.g., "me", "us",
 */
var pronounFormsTermSetSchema = {
	nom: { type: String, required: true },
	obj: { type: String, required: true },
}

/**
 * Creates an `NSymbol` that produces a terminal rule set for a pronoun with the necessary text forms for conjugation.
 *
 * Each terminal rule in the set has an object as its `text` with the properties `nom` and `obj` for the different personal pronoun case forms. When constructing parse trees, `pfsearch` conjugates the `text` object to the grammatical case (i.e., display text) according to the `grammaticalForm` property on the (immediate) parent rule.
 *
 * Note: Each of the pronoun forms in `options.pronounFormsTermSet` becomes a terminal symbol, and can not contain whitespace.
 *
 * The returned `NSymbol` has the following properties:
 * • name - `options.symbolName`.
 * • isTermSequence - `true`. Enables nesting within term sequences and flattening in `flattenTermSequence`.
 * • isTermSet - `true`. Specifies every rule is a uni-token terminal rule with the same `text` value.
 * • termSequenceType - 'pronoun'.
 * • defaultText - The conjugative `text` object for the forms of this pronoun. This value is identical for every terminal rule this `NSymbol` produces. For use when nesting this `NSymbol` in a term sequence.
 * • insertionCost - `options.insertionCost`, if defined.
 *
 * @memberOf termSequence
 * @param {Object} options The options object.
 * @param {string} options.symbolName The name for the new `NSymbol`.
 * @param {number} [options.insertionCost] The insertion cost for the terminal rule set, assigned to the first rule in the set (i.e., `pronounFormsTermSet.nom`). Enables the creation of insertion rules using the new `NSymbol` which produces this set (i.e., the LHS symbol).
 * @param {PronounFormsTermSetSchema} options.pronounFormsTermSet The pronoun terminal rule set with each pronoun form inflection.
 * @returns {Nymbol} Returns the new `NSymbol` for the pronoun terminal rule set.
 */
var pronounSchema = {
	symbolName: { type: String, required: true },
	insertionCost: Number,
	pronounFormsTermSet: { type: Object, required: true },
}

exports.newPronoun = function (options) {
	if (util.illFormedOpts(pronounSchema, options) || isIllFormedNewPronounOptions(options)) {
		throw new Error('Ill-formed pronoun')
	}

	// Create the `NSymbol` that produces the pronoun terminal rule set.
	var pronounSym = g.newSymbol(options.symbolName)
	var pronounFormsTermSet = options.pronounFormsTermSet

	// The terminal rule `text` object containing the pronoun inflections for use in conjugation for each terminal symbol in `pronounFormsTermSet`.
	var pronounTextForms = {
		// The nominative case form, used as the subject of a verb, chosen by the parent nonterminal rule property `grammaticalForm`. E.g., "I", "we".
		nom: pronounFormsTermSet.nom,
		// The objective case form, used as the object of a verb, chosen by the parent nonterminal rule property `grammaticalForm`. E.g., "me", "us",
		obj: pronounFormsTermSet.obj,
	}

	// The terminal rule for the nominative case form.
	var nominativeRule = {
		isTerminal: true,
		rhs: pronounFormsTermSet.nom,
		text: pronounTextForms,
	}
	if (options.insertionCost !== undefined) {
		// Assign the insertion cost, if any, to the first terminal rule in the set.
		nominativeRule.insertionCost = options.insertionCost
	}
	pronounSym.addRule(nominativeRule)


	// The terminal rule for the objective case form.
	pronounSym.addRule({
		isTerminal: true,
		rhs: pronounFormsTermSet.obj,
		text: pronounTextForms,
	})

	/**
	 * Specify all possible `pronounSym` reductions (i.e., subtrees) yield only display text, no semantics. Hence, all subtrees `pronounSym` produces are semantically identical. Instructs `flattenTermSequence` to flatten instances of `pronounSym` to a single terminal parse node with a single display text.
	 *
	 * Assign `isTermSequence` after adding all `pronounSym` rules above because `NSymbol.prototype.addRule()` prevents invocation on `NSymbol` instances with `isTermSequence`.
	 */
	pronounSym.isTermSequence = true

	// Specify every rule `pronounSym` produces is a uni-token terminal rule with the same `text` (display text) value. A terminal rule set is subset of term sequences.
	pronounSym.isTermSet = true

	// Specify `pronounSym` is a pronoun.
	pronounSym.termSequenceType = 'pronoun'

	/**
	 * Save `pronounTextForms`, which is identical for every terminal rule `pronounSym` produces, as the terminal rule set's default text.
	 *
	 * For use when nesting `pronounSym` in the first accepted rule of a term sequence. If so, that new term sequence uses `pronounSym.defaultText` in its default text, which it uses as the display text for its substitution rules, if any.
	 */
	pronounSym.defaultText = pronounTextForms

	// Save `insertionCost` for convenience; unused internally.
	pronounSym.insertionCost = options.insertionCost

	return pronounSym
}

/**
 * Checks if `options`, which was passed to `termSequence.newPronoun()`, is ill-formed. If so, prints an error.
 *
 * @private
 * @static
 * @param {Object} options The `termSequence.newPronoun()` options object to inspect.
 * @returns {boolean} Returns `true` if `options` is ill-formed, else `false`.
 */
function isIllFormedNewPronounOptions(options) {
	var pronounFormsTermSet = options.pronounFormsTermSet
	if (util.illFormedOpts(pronounFormsTermSetSchema, pronounFormsTermSet)) {
		return true
	}

	for (var pronounForm in pronounFormsTermSet) {
		if (isIllFormedTerminalSymbol(pronounFormsTermSet[pronounForm])) {
			return true
		}
	}

	return false
}

/**
 * A term and cost pairing, from which `termSequence.newTermSequence()` creates a term sequence substitution with a cost penalty.
 *
 * @type {Object} SubstitutedTerm
 * @property {string|NSymbol|NSymbol[]} term The terminal symbol, term set, or term sequence to substitute when matched.
 * @property {number} costPenalty The substitution cost penalty added to the rule's cost.
 */
var substitutedTermSchema = {
	term: { type: [ String, Object, NSymbol, Array ], required: true },
	costPenalty: { type: Number, required: true },
}

/**
 * Creates an `NSymbol` that produces a terminal rule sequence forming a term or phrase, comprised of terminal rules, terminal rule sets (e.g., `g.newVerb()`), and nested term sequences.
 *
 * Each item in `options.acceptedTerms` and `options.substitutedTerms` must be one of the following:
 * 1. A terminal symbol.
 *   • I.e., an invariable term which `pfsearch` can not inflect when parsing.
 *   • Can not contain whitespace.
 * 2. A terminal rule set created by `termSequence.newVerb()`.
 * 3. A terminal rule sequence created by this method or `termSequence.newTermSequenceBinarySymbol()`.
 * 4. An ordered pair containing any combination of #2, #3, or nested ordered pairs from which to recursively create new term sequences.
 *
 * In addition, items in `options.substitutedTerms` may also be the following:
 * 5. `SubstitutedTerm` - A term and cost pairing with the following properties:
 *   • {string|NSymbol|NSymbol[]} SubstitutedTerm.term - Any of #1-4 above.
 *   • {number} SubstitutedTerm.costPenalty - The substitution cost penalty added to the rule's cost.
 *
 * The `defaultText` value (or merger of `defaultText` values) of the first term in `options.acceptedTerms` is used as the `text` value of the rules for the items in `options.substitutedTerms`, if any, which substitutes their `text` values when input.
 *
 * All rules which the new `NSymbol` produces are marked `isTermSequence`, which instructs `flattenTermSequence` to do the following:
 * 1. For non-edit rules, `flattenTermSequence` merges the `text` values of the matched terminal rules it produces.
 * 2. For insertion rules, `flattenTermSequence` traverses the single child node, gets the `text` values of the matched terminal rules, and merges those `text` values with the rule's insertion `text` according to its `insertedSymIdx` property.
 * 3. For substitution rules, `flattenTermSequence` uses the `text` value of the rule and ignores the matched terminal rules it produces.
 *
 * For all three, `flattenTermSequence` creates a new, terminal `ruleProps` for the rule with the `text` value as specified, which `pfsearch` uses to generate display text. `flattenTermSequence` also always traverses the matched terminal rules to get the input tense of any matched verb terminal rules, which `pfsearch` uses if the parent rule has matching `acceptedTense`.
 *
 * After flattening nested term sequence pairs in `options.acceptedTerms` and `options.substitutedTerms:
 * • If `options.isVerb` is `true`, checks every term sequence contains exactly one verb terminal rule set.
 * • If `options.isVerb` is falsey, checks every term sequence contains zero verb terminal rule sets.
 * • If `options.verbTense` is defined, checks every verb has matching grammatical tense.
 *
 * The returned `NSymbol` has the following properties:
 * • name - `options.symbolName`.
 * • isTermSequence - `true`. Enables nesting within term sequences and flattening in `flattenTermSequence`.
 * • termSequenceType - `options.type`, if defined.
 * • verbTense - `options.tense`, if defined.
 * • defaultText - The `defaultText` value (or merger of `defaultText` values) of the first term set or term sequence in `options.acceptedTerms`. For use when nesting this `NSymbol` in another term sequence.
 * • insertionCost - `options.insertionCost`, if defined.
 *
 * @memberOf termSequence
 * @param {Object} options The options object.
 * @param {string} options.symbolName The name for the new `NSymbol`.
 * @param {number} [options.insertionCost] The insertion cost for the term sequence, assigned to the first terminal symbol in `options.acceptedTerms`, if any. Enables the creation of insertion rules using the new `NSymbol` which produces this set (i.e., the LHS symbol).
 * @param {boolean} [options.isVerb] Specify every term sequence the new `NSymbol` produces, accepted or substituted, contains exactly one verb terminal rule set (created by `termSequence.newVerb()`).
 * @param {boolean} [options.verbTense] If `options.isVerb` is `true`, the grammatical tense, 'past' or 'present', of every verb the new `NSymbol` produces (each created by `termSequence.newVerb(verbOptions)` with matching `verbOptions.tense`).
 * @param {(string|NSymbol|NSymbol[])[]} options.acceptedTerms The terminal symbols, term sets, and term sequences to accept when input, parameterized as described above.
 * @param {(string|NSymbol|NSymbol[]|SubstitutedTerm)[]} [options.substitutedTerms] The terminal symbols, term sets, and term sequences to substitute when matched (with a cost penalty if `SubstitutedTerm`) with the first item in `options.acceptedTerms`, parameterized as described above.
 * @returns {NSymbol} Returns the new `NSymbol` for the terminal rule sequence.
 */
var termSequenceSchema = {
	symbolName: { type: String, required: true },
	insertionCost: Number,
	type: { values: Object.keys(exports.Type).map(typeName => exports.Type[typeName]), required: true },
	acceptedTerms: { type: Array, arrayType: [ String, NSymbol, Array ], required: true },
	substitutedTerms: { type: Array, arrayType: [ String, Object, NSymbol, Array ] },
}

exports.newTermSequence = function (options) {
	if (util.illFormedOpts(termSequenceSchema, options) || isIllFormedNewTermSequenceOptions(options)) {
		throw new Error('Ill-formed term sequence')
	}

	// Create the `NSymbol` that produces the terminal rule sequence.
	var termSeqSym = this.newSymbol(options.symbolName)
	// The insertion cost to assign to the first terminal symbol in `options.acceptedTerms`, if any.
	var insertionCost = options.insertionCost
	/**
	 * The `defaultText` value (or merger of `defaultText` values) of the first term set or term sequence in `options.acceptedTerms`.
	 *
	 * For use as the `text` value of the rules for the term sets and term sequences in `options.substitutedTerms`, if any, which substitutes their `text` values when input.
	 *
	 * Can be an invariable term string, a conjugative text object, or an array of both.
	 */
	var defaultText

	options.acceptedTerms.forEach(function (term, i) {
		/**
		 * If `term` is a terminal symbol.
		 *
		 * For example:
		 *   `[term-funding]` -> "funding", text: "funding"
		 */
		if (term.constructor === String) {
			// Check if `term` contains any non-alphabetic characters.
			if (isIllFormedTerminalSymbol(term)) {
				throw new Error('Ill-formed terminal symbol')
			}

			var newTerminalRule = {
				isTerminal: true,
				rhs: term,
				text: term,
			}

			// Assign the insertion cost, if any, to the first accepted terminal symbol.
			if (insertionCost !== undefined) {
				newTerminalRule.insertionCost = insertionCost
				// Track when `options.insertionCost` has been assigned to the first terminal symbol in `options.acceptedTerms`, which may not be the first element in the array.
				insertionCost = undefined
			}

			termSeqSym.addRule(newTerminalRule)

			if (i === 0) {
				// Save the display text of the first term in `options.acceptedTerms` as the display text for `options.substitutedTerms`, if any.
				defaultText = term
			}
		}

		/**
		 * If `term` is a terminal rule set created by `termSequence.newVerb()`, or a terminal rule sequence created by `termSequence.newTermSetSet()` or `termSequence.newTermSequenceBinarySymbol()`.
		 *
		 * An example where `term` is the terminal rule set `[make]`:
		 *   `[create]` -> `[make]` -> "make", text: `{make-verb-forms}`
		 *
		 * An example where `term` a terminal rule sequence `[work-on]`:
		 *   `[contribute-to]` -> `[work-on]` -> `[work]` -> "work", text: `{work-verb-forms}`
		 *                                    -> `[on]`   -> "on",   text: "on"
		 */
		else if (term.isTermSequence) {
			// If `options.isVerb` is `true`, check `term` is either a verb terminal rule set or a verb term sequence, else `term` is neither a verb terminal rule nor a verb term sequence.
			// If `options.verbTense` is defined and `term` is a verb or verb sequence, check `term` has matching grammatical tense.
			if (isIllFormedTermSequenceItem(term, options.type)) {
				throw new Error('Ill-formed term sequence')
			}

			/**
			 * Even though this rule is unary and does not require `text` merging, the rule is still assigned `isTermSequence` to instruct `flattenTermSequence` to bring the `text` up to this rule's node level, allowing `gramProps` to conjugate the `text` (`gramProps` only conjugates the immediate child nodes).
			 *
			 * Even if `term` is a verb terminal rule set, for which the `text` value of every terminal rule is identical, do not assign that `text` to this rule as if it were a substitution. Although the parsing result will be identical, it is important to distinguish between the two.
			 */
			termSeqSym.addRule({
				rhs: [ term ],
			})

			if (i === 0) {
				/**
				 * Save the `defaultText` of the first term in `options.acceptedTerms` as the display text for `options.substitutedTerms`, if any.
				 * • If `term` is a verb, `defaultText` is the identical `text` of all terminal rules in the set.
				 * • If `term` is a term sequence, `defaultText` is the display text of its first accepted terminal symbol, term set, or term sequence it produces.
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
			// Check the term sequence pair agrees with `options.isVerb` and `options.verbTense`.
			var termSeqPair = termSequencePairToSymbol({
				type: options.type,
				verbTense: options.verbTense,
				termSeqPair: term,
			})

			// `flattenTermSequence` will traverse this rule's child nodes, merge the `text` values of the matched terminal rules it produces, and create a new, terminal `ruleProps` for the rule's node to instruct `pfsearch` to use the merged `text` for display text and not traverse further.
			termSeqSym.addRule({
				rhs: termSeqPair,
			})

			if (i === 0) {
				/**
				 * Merge the `defaultText` values of the first term pair in `options.acceptedTerms` as the display text for `options.substitutedTerms`, if any.
				 * • If an item in the pair is a verb, its `defaultText` is the identical `text` of all terminal rules in the set.
				 * • If an item in the pair is a term sequence, its `defaultText` is the display text of its first accepted terminal symbol, term set, or term sequence it produces.
				 */
				defaultText = grammarUtil.mergeTextPair(termSeqPair[0].defaultText, termSeqPair[1].defaultText)
			}
		}

		else {
			util.logError('Term is neither a terminal symbol, terminal rule set, term sequence, nor an ordered pair of term sequences:', term)
			throw new Error('Ill-formed term sequence')
		}
	})

	if (options.substitutedTerms) {
		// Create nonterminal substitution rules with `defaultText` as the `text` value for each rule. This instructs `pfsearch` to generate display text from these rules and discard the `text` values of the matched terminal rules which these rules produce.
		options.substitutedTerms.forEach(function (term) {
			// The substitution cost penalty incurred when `term` is matched (and substituted).
			var costPenalty = 0
			if (term.constructor === Object) {
				if (util.illFormedOpts(substitutedTermSchema, term)) {
					throw new Error('Ill-formed term substitution')
				}

				costPenalty = term.costPenalty
				term = term.term
			}

			/**
			 * If `term` is a terminal symbol.
			 *
			 * A substitution example:
			 *   `[prep-day]` -> "in", text: "on"
			 */
			if (term.constructor === String) {
				// Check if `term` contains any non-alphabetic characters.
				if (isIllFormedTerminalSymbol(term)) {
					throw new Error('Ill-formed terminal symbol')
				}

				// `pfsearch` uses this rule's `text` property instead of the matched terminal symbol it produces (i.e., `term`).
				termSeqSym.addRule({
					isTerminal: true,
					rhs: term,
					text: defaultText,
					costPenalty: costPenalty,
				})
			}

			/**
			 * If `term` is a terminal rule set created by `termSequence.newVerb()`, or a terminal rule sequence created by `termSequence.newTermSetSet()` or `termSequence.newTermSequenceBinarySymbol()`.
			 *
			 * A substitution example where `term` is the terminal rule set `[make]`:
			 *   `[like]` -> `[love]`, text: `{like-verb-forms}`
			 *
			 * A substitution example where `term` a terminal rule sequence `[work-on]`:
			 *   `[contribute-to]` -> `[help-with]`, text: `[ {contribute-verb-forms}, "to" ]`
			 */
			else if (term.isTermSequence) {
				// If `options.isVerb` is `true`, check `term` is either a verb terminal rule set or a verb term sequence, else `term` is neither a verb terminal rule nor a verb term sequence.
				// If `options.verbTense` is defined and `term` is a verb or verb sequence, check `term` has matching grammatical tense.
				if (isIllFormedTermSequenceItem(term, options.type)) {
					throw new Error('Ill-formed term sequence substitution')
				}

				// `pfsearch` uses this rule's `text` property instead of the `text` values of the matched terminal rules it produces.
				termSeqSym.addRule({
					rhs: [ term ],
					text: defaultText,
					costPenalty: costPenalty,
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
				// Check the term sequence pair agrees with `options.isVerb` and `options.verbTense`.
				var termSeqPair = termSequencePairToSymbol({
					type: options.type,
					verbTense: options.verbTense,
					termSeqPair: term,
				})

				// `pfsearch` uses this rule's `text` property instead of the `text` values of the matched terminal rules it produces.
				termSeqSym.addRule({
					rhs: termSeqPair,
					text: defaultText,
					costPenalty: costPenalty,
				})
			}

			else {
				util.logError('Term is neither a terminal symbol, terminal rule set, term sequence, nor an ordered pair of term sequences:', term)
				throw new Error('Ill-formed term sequence substitution')
			}
		})
	}

	/**
	 * Specify all possible `termSeqSym` reductions (i.e., subtrees) yield only display text, no semantics. Hence, all subtrees `termSeqSym` produces are semantically identical. Instructs `flattenTermSequence` to flatten instances of `termSeqSym` to a single terminal parse node with a single display text.
	 *
	 * Assign `isTermSequence` after adding all `termSeqSym` rules above because `NSymbol.prototype.addRule()` prevents invocation on `NSymbol` instances with `isTermSequence`.
	 */
	termSeqSym.isTermSequence = true

	// If `options.type` is defined, specify every term sequence `termSeqSym` produces, accepted or substituted, contains one terminal rule set of this type (e.g., 'verb').
	termSeqSym.termSequenceType = options.type

	/**
	 * Save `defaultText`, which is the merger of `defaultText` values of the term set(s) or term sequence(s) in this sequence's first accepted rule.
	 *
	 * For use when nesting `termSeqSym` in the first accepted rule of another term sequence. If so, that new term sequence uses `termSeqSym.defaultText` in its default text, which it uses as the display text for its substitution rules, if any.
	 */
	termSeqSym.defaultText = defaultText

	// Save `insertionCost` for convenience; unused internally.
	termSeqSym.insertionCost = options.insertionCost

	return termSeqSym
}

/**
 * Checks if `options`, which was passed to `termSequence.newTermSequence()` or `termSequence.newTermSequenceBinarySymbol()`, is ill-formed. If so, prints an error.
 *
 * @private
 * @static
 * @param {Object} options The term sequence options object to inspect.
 * @returns {boolean} Returns `true` if `options` is ill-formed, else `false`.
 */
function isIllFormedNewTermSequenceOptions(options) {
	if (options.verbTense && options.type !== 'verb') {
		util.logErrorAndPath('`verbTense` specified for term sequence without `tense` defined as \'verb\'`:', options)
		return true
	}

	if (options.insertionCost !== undefined && !options.acceptedTerms.some(term => term.constructor === String)) {
		util.logErrorAndPath('Term sequence', util.stylize(options.symbolName), 'has `insertionCost` but no terminal symbol (i.e., string) in `options.acceptedTerms` to which to assign it:', options)
		return true
	}

	return false
}

/**
 * Creates an `NSymbol` with a single binary rule with `options.termPair` as its `rhs`, which produces a terminal sequence forming a phrase comprised of terminal rule sets and nested term sequences.
 *
 * Each item in `options.termPair` must be one of the following:
 * 1. A terminal rule set created by `termSequence.newVerb()`.
 * 2. A terminal rule sequence created by `termSequence.newTermSequence()` or this method.
 * 3. An ordered pair containing any combination of #1, #2, or nested ordered pairs from which to recursively create new term sequences.
 *
 * The single rule the new `NSymbol` produces is marked `isTermSequence`.
 *
 * After flattening nested term sequence pairs within `options.termPair`:
 * • If `options.isVerb` is `true`, checks every term sequence `options.termPair` produces contains exactly one verb terminal rule set.
 * • If `options.isVerb` is falsey, checks every term sequence contains zero verb terminal rule sets.
 * • If `options.verbTense` is defined, checks every verb `options.termPair` produces has matching grammatical tense.
 *
 * If `_isNestedTermSequence` is `true`, manually checks if `options.termPair` produces a verb, and the `verbTense` of that verb, to determine the `isVerb` and `verbTense` values for the returned `NSymbol`. For use when `options.termPair` was defined as a nested term pair within another term sequence pair passed to this method or `termSequence.newTermSequence()`. `options.isVerb` only specifies if the entire base sequence contains or lacks a single verb, not every bigram within the sequence; e.g., do not check if "in common" within the verb phrase "have in common" contains a verb. Likewise, `options.verbTense` only specifies the grammatical tense of the entire base sequence.
 *
 * The returned `NSymbol` has the following properties:
 * • name - `options.symbolName` if defined, else the concatenation of the names of the `NSymbol` instances in `options.termPair` (after flattening nested ordered pairs).
 * • isTermSequence - `true`. Enables nesting within term sequences and flattening in `flattenTermSequence`.
 * • termSequenceType - `options.termSequenceType`, or if `_isNestedTermSequence` is `true` and `options.termPair` contains a verb.
 * • verbTense - `options.tense`, or if `_isNestedTermSequence` is `true` and `options.termPair` contains a verb with `verbTense`.
 * • defaultText - The merger of the `defaultText` values of the terms in `options.termPair`. For use when nesting this `NSymbol` in another term sequence.
 *
 * @memberOf termSequence
 * @param {Object} options The options object.
 * @param {string} [options.symbolName] The name for the new `NSymbol`. If omitted, concatenates the names of the `NSymbol` instances in `options.termPair` (after flattening nested ordered pairs).
 * @param {boolean} [options.isVerb] Specify every term sequence `options.termPair` produces contains exactly one verb terminal rule set (created by `termSequence.newVerb()`).
 * @param {boolean} [options.verbTense] If `options.isVerb` is `true`, the grammatical tense, 'past' or 'present', of every verb the new `NSymbol` produces (each created by `termSequence.newVerb(verbOptions)` with matching `verbOptions.tense`).
 * @param {NSymbol[]} options.termPair The ordered pair of terms in this sequence.
 * @param {boolean} [_isNestedTermSequence] Specify `options.termPair` was defined as a nested term pair within another term sequence pair passed to this method or `termSequence.newTermSequence()`.
 * @returns {NSymbol} Returns the new `NSymbol` for the terminal rule sequence.
 */
var binaryTermSequenceSchema = {
	symbolName: String,
	type: termSequenceSchema.type,
	verbTense: verbSchema.tense,
	termPair: { type: Array, arrayType: [ NSymbol, Array ], required: true },
}

exports.newTermSequenceBinarySymbol = function (options, _isNestedTermSequence) {
	if (util.illFormedOpts(binaryTermSequenceSchema, options) || isIllFormedNewTermSequenceOptions(options)) {
		throw new Error('Ill-formed binary term sequence')
	}

	/**
	 * Recursively flatten any nested ordered pairs to `NSymbol` instances that produce the nested term sequence.
	 *
	 * Check the term sequence pair agrees with `options.isVerb` and `options.verbTense`. Pass `_isNestedTermSequence` to prevent `flattenTermSequencePair()` from throwing an exception for `options.termPair` containing a verb when `options.isVerb` is falsey.
	 */
	var termSeqPair = termSequencePairToSymbol({
		type: options.type,
		verbTense: options.verbTense,
		termSeqPair: options.termPair,
		isNestedTermSequence: _isNestedTermSequence,
	})
	var termA = termSeqPair[0]
	var termB = termSeqPair[1]

	/**
	 * Create the `NSymbol` and the single terminal rule sequence.
	 *
	 * `flattenTermSequence` will traverse this rule's child nodes, merge the `text` values of the matched terminal rules it produces, and create a new, terminal `ruleProps` for the rule's node to instruct `pfsearch` to use the merged `text` for display text and not traverse further.
	 */
	var termSeqSym = g.newSymbol(options.symbolName || g.hyphenate(termA.name, termB.name)).addRule({
		rhs: termSeqPair,
	})

	/**
	 * Specify all possible `termSeqSym` reductions (i.e., subtrees) yield only display text, no semantics. Hence, all subtrees `termSeqSym` produces are semantically identical. Instructs `flattenTermSequence` to flatten instances of `termSeqSym` to a single terminal parse node with a single display text.
	 *
	 * Assign `isTermSequence` after adding all `termSeqSym` rules above because `NSymbol.prototype.addRule()` prevents invocation on `NSymbol` instances with `isTermSequence`.
	 */
	termSeqSym.isTermSequence = true

	if (_isNestedTermSequence) {
		/**
		 * Manually check whether `termSeqSym` produces a verb, and the `verbTense` of that verb, when `options.termPair` was defined as a nested term pair within another term sequence pair passed to this method or `termSequence.newTermSequence()`. This is necessary because `options.isVerb` only specifies if the entire base sequence (after flattening) contains or lacks a single verb, not every bigram within the sequence. Likewise, `options.verbTense` only specifies the grammatical tense of the entire base sequence.
		 *
		 * For example, consider the following verb term sequence passed to either of the two aforementioned methods:
		 *   `[ `[have]`, [ `[in]` `[common]` ] ]`
		 * This method creates a new `NSymbol` and binary rule for the nested array, `[ `[in]` `[common]` ]`, but can not use the truthy `isVerb` value passed with the root array because it is incorrect for this subrule within the verb phrase.
		 *
		 * Further, consider the following restructuring of the same verb sequence:
		 *   `[ [ `[have]` `[in]` ], `[common]` ]`
		 * As the previous example demonstrates, this method can not rely on `isVerb` for nested term sequences. Hence, it manually checks if such nested pairs contain a verb.
		 *
		 * Perform this check after invoking `flattenTermSequencePair()` with `termSeqPair` above to ensure the term sequence is flattened and valid; e.g., `termSeqPair` items are not both verbs, `termSeqPair` has matching `verbTense`.
		 */

		/**
		 * FIXME: Consolidate comment blocks.
		 *
		 * If `termA` is invariable, then `termB` is either invariable and the whole sequence is invariable, or `termB` is the conjugative sequence and defines this sequence's type. Else, `termB` is the conjugative sequence and defines this sequence's type.
		 *
		 * The `termSequencePairToSymbol()` invocation above ensures either both terms are invariable, or one is invariable and the other is a conjugative sequence (e.g., verb, pronoun).
		 */
		termSeqSym.type = termA.type === 'invariable' ? termB.type : termA.type
	} else {
		// Specify every term sequence `termSetSeqSym` produces, accepted or substituted, contains one verb terminal rule set (created by `termSequence.newVerb()`).
		// If `options.verbTense` is defined, every verb `termSeqSym` produces only contains verb forms for the given grammatical tense; i.e., lacks terminal rules for the opposite tense.
		termSeqSym.type = options.type
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
 * 1. A terminal rule set created by `termSequence.newVerb()`.
 * 2. A terminal rule sequence created by `termSequence.newTermSequence()` or `termSequence.newTermSequenceBinarySymbol()`.
 * 3. An ordered pair containing any combination of #1, #2, or nested ordered pairs from which to recursively create new term sequences with `termSequence.newTermSequenceBinarySymbol()`.
 *
 * After flattening nested term sequence pairs within `termSeqPair`:
 * • If `isVerb` is `true`, checks every term sequence `termSeqPair` produces contains exactly one verb terminal rule set.
 * • If `isVerb` is falsey and `isNestedTermSequence` is falsey, checks every term sequence contains zero verb terminal rule sets.
 * • If `verbTense` is defined, checks every verb `termSeqPair` produces has matching grammatical tense.
 *
 * Returns a flattened ordered pair of `NSymbol` instances, for use as a `rhs` in a binary rule for a term sequence.
 *
 * @private
 * @static
 * @param {(NSymbol|NSymbol[])[]} termSeqPair The term set ordered pair to validate and flatten.
 * @param {boolean} isVerb Specify every term sequence `termSeqPair` produces contains exactly one verb terminal rule set (created by `termSequence.newVerb()`).
 * @param {boolean} verbTense If `isVerb` is `true`, specify every verb `termSeqPair` produces is of the grammatical tense 'past' or 'present' (each created by `termSequence.newVerb(verbOptions)` with matching `verbOptions.tense`).
 * @param {boolean} [isNestedTermSequence] Specify `termSeqPair` was defined as a nested term pair within another term sequence pair passed to `termSequence.newTermSequenceBinarySymbol()` or `termSequence.newTermSequence()`.
 * @returns {NSymbol} Returns the flattened term sequence ordered pair.
 */
var termSequencePairSchema = {
	type: termSequenceSchema.type,
	termSeqPair: binaryTermSequenceSchema.termPair,
	isNestedTermSequence: Boolean,
}

function termSequencePairToSymbol(options) {
	var termSeqPair = options.termSeqPair
	var termSeqLen = termSeqPair.length
	if (termSeqPair.length !== 2) {
		util.logErrorAndPath('Term sequence is not an ordered pair:', termSeqPair)
		throw new Error('Ill-formed term sequence pair')
	}

	for (var s = 0; s < termSeqLen; ++s) {
		var termSym = termSeqPair[s]
		if (termSym.constructor === Array) {
			if (termSym.length !== 2) {
				util.logErrorAndPath('Nested term sequence is not an ordered pair:', termSym)
				throw new Error('Ill-formed term sequence pair')
			}

			/**
			 * Recursively create an `NSymbol` that produces a single binary rule for the term sequence of this nested ordered pair.
			 *
			 * Pass `true` for the method's second parameter, `isNestedTermSequence`, to instruct the method to manually check if the pair `termSym` contains a verb, and ignore the parameters `type` and `verbTense` (even if defined).
			 * • This is necessary because `isVerb` only specifies if the entire base sequence contains or lacks a single verb, not every bigram within the sequence (i.e., recursive invocations of this function). E.g., do not check if "in common" within the verb phrase "have in common" contains a verb. Likewise, `verbTense` only specifies the grammatical tense of the entire base sequence.
			 */
			termSeqPair[s] = exports.newTermSequenceBinarySymbol({ termPair: termSym, type: 'invariable' }, true)
		} else if (!termSym.isTermSequence) {
			util.logErrorAndPath('Term is neither a term set nor a term sequence:', util.stylize(termSym))
			throw new Error('Ill-formed term sequence')
		}
	}

	/**
	 * After flattening nested term sequence pairs within `termSeqPair`:
	 * • If `isVerb` is `true`, check every term sequence `termSeqPair` produces contains exactly one verb terminal rule set.
	 * • If `isVerb` is falsey and `isNestedTermSequence` is falsey, check every term sequence contains zero verb terminal rule sets.
	 * • If `verbTense` is defined, checks every verb `termSeqPair` produces has matching grammatical tense.
	 */
	if (isIllFormedTermSequencePair(termSeqPair, options.type, options.isNestedTermSequence)) {
		throw new Error('Ill-formed term sequence pair')
	}

	// The flattened ordered pair of `NSymbol` instances for use as a `rhs` in a binary rule for a term sequence.
	return termSeqPair
}

/**
 * Checks if `term` disagrees with `isVerb` and `verbTense` for a new term sequence. If so, prints an error message.
 *
 * If `isVerb` is `true`, `term` must be either a verb terminal rule set (`term.termSetType === 'verb'`) or a verb term sequence (`term.isVerb`), else `term` is neither a verb terminal rule set nor a verb term sequence.
 *
 * If `verbTense` is defined, `term` must be either a verb terminal rule set with matching `verbTense` or a verb term sequence with matching `verbTense`.
 *
 * @private
 * @static
 * @param {NSymbol} term The term set or term sequence to inspect.
 * @param {boolean} [isVerb] Specify `term` should be a verb terminal rule set or a verb term sequence.
 * @param {string} [verbTense] If `isVerb` is `true`, specify `term` should be of the grammatical tense 'past' or 'present'.
 * @returns {boolean} Returns `true` if `term` disagrees with `isVerb`, else `false`.
 */
function isIllFormedTermSequenceItem(term, type) {
	if (!term.isTermSequence) {
		util.logErrorAndPath('Nested nonterminal symbol', util.stylize(term.name), 'is not a term sequence:', term)
		return true
	}

	// Check if the term sequence item, for use in a unary production on a new term sequence, is of matching type. If `term` is a verb with grammatical tense (i.e., only produces verb forms for the specified tense), its compatibility is checked like all other term sequence types because `verb-present` and `verb-past` are distinct types.
	if (term.termSequenceType !== type) {
		util.logErrorAndPath('Nested term sequence', util.stylize(term.name), 'is not of type', util.stylize(type) + ':', term)
		return true
	}

	return false
}

/**
 * Checks if `termSeqPair` disagrees with `isVerb` and `verbTense` for a new term sequence pair (after flattening). If so, prints an error message.
 *
 * If `isVerb` is `true`, every term sequence `termSeqPair` produces must contain exactly one verb terminal rule set. Else, throws an exception.
 * • Temporarily forbids a term sequence to produce multiple verbs to prevent multiple instances of `tense` within a single sequence. `flattenTermSequence` does not support mapping a terminal rule's input tense to a particular item in the merged `text` array when flattening the term sequence's subtree.
 *
 * If `isVerb` is falsey and `isNestedTermSequence` is falsey, checks every term sequence contains zero verb terminal rule sets. Else, throws an exception.
 * • `isNestedTermSequence` must be falsey because `isVerb` only specifies if the entire base sequence contains or lacks a single verb, not every bigram within the sequence. For example, the function does not check if "in common" within the verb sequence "have in common" contains verb; ergo, `isVerb` is unavailable should the nested pair be "have in", though the pair contains a verb.
 *
 * If `verbTense` is defined, every verb `termSeqPair` produces must be of matching grammatical grammatical tense. Else, throws an exception.
 *
 * @private
 * @static
 * @param {NSymbol[]} termSeqPair The (flattened) term sequence ordered pair to inspect.
 * @param {boolean} isVerb Specify every term sequence `termSeqPair` produces contains exactly one verb terminal rule set.
 * @param {boolean} verbTense If `isVerb` is `true`, specify every verb `termSeqPair` produces is of the grammatical tense 'past' or 'present' (each created by `termSequence.newVerb(verbOptions)` with matching `verbOptions.tense`).
 * @param {falsey} [isNestedTermSequence] Specify `termSeqPair` was defined as a nested term pair within another term sequence pair passed to `termSequence.newTermSequenceBinarySymbol()` or `termSequence.newTermSequence()`.
 * @returns {boolean} Returns `true` if `termSeqPair` disagrees with `isVerb`, else `false`.
 */
function isIllFormedTermSequencePair(termSeqPair, termSequenceType, isNestedTermSequence) {
	if (termSeqPair.length !== 2) {
		util.logErrorAndPath('Term sequence is not an ordered pair:', termSeqPair)
		return true
	}

	for (var t = 0; t < 2; ++t) {
		var term = termSeqPair[t]
		if (!term.isTermSequence) {
			util.logErrorAndPath('Non-term sequence provided in term sequence pair:', term, termSeqPair)
			return true
		}

		if (term.termSequenceType !== exports.Type.INVARIABLE) {
			if (termSequenceType === exports.Type.INVARIABLE) {
				util.logErrorAndPath('Term in provided term sequence pair not of specified type', util.stylize(termSequenceType) + ':', term, termSeqPair)
				return true
			} else if (term.termSequenceType !== termSequenceType) {
				util.logErrorAndPath('Term in provided term sequence pair neither of (neutral) type', util.stylize(exports.Type.INVARIABLE), ' nor the specified type', util.stylize(termSequenceType) + ':', term, termSeqPair)
				return true
			}
		}

		/**
		 * Only alert if there are verbs when `isVerb` is falsey if `isNestedTermSequence` is also falsey. This is necessary because `isVerb` only specifies if the entire base sequence contains or lacks a single verb, not every bigram within the sequence.
		 *
		 * For example, this function does not check if "in common" within the verb sequence "have in common" contains verb; ergo, `isVerb` is unavailable should the nested pair be "have in", though the pair contains a verb.
		 */

		// Unsure if `isNestedTermSequence` is needed if we just specify `exports.Type.INVARIABLE`.
		if (!isNestedTermSequence && term.termSequenceType !== exports.Type.INVARIABLE) {
			util.logErrorAndPath('Term sequence of type', util.stylize(term.termSequenceType), 'provided to invariable sequence:', term, termSeqPair)
			return true
		}
	}

	// Check if `termSeqPair` contains a term of the specified term sequence type. If `term` is a verb with grammatical tense (i.e., only produces verb forms for the specified tense), its compatibility is checked like all other term sequence types because `verb-present` and `verb-past` are distinct types.
	if (termSeqPair.every(term => term.termSequenceType !== termSequenceType)) {
		util.logErrorAndPath('Term sequence pair lacks term of specified type', util.stylize(termSequenceType) + ':', termSeqPair)
		return true
	}

	if (termSequenceType !== exports.Type.INVARIABLE) {
		// Always check if both terms in the pair are verbs, irrespective of `isVerb` and `isNestedTermSequence`.
		if (termSeqPair.every(term => term.termSequenceType === termSequenceType)) {
			util.logErrorAndPath('Two', util.stylize(termSequenceType), 'terms in a single term sequence pair:', termSeqPair)
			return true
		}
	}

	if (termSeqPair.every(exports.isVerbTerm)) {
		util.logErrorAndPath('Two verbs provided in a single term sequence pair:', termSeqPair)
		return true
	}

	return false
}

/**
 * Checks if `term` is either a verb terminal rule set (created by `termSequence.newVerb()`) or a verb term sequence, which the calling function forbids. If so, prints an error message.
 *
 * If `term` is neither a verb nor a verb sequence, checks if has `verbTense` property. If so, prints an error message.
 *
 * @private
 * @static
 * @param {Object} term The terminal rule set or term sequence to inspect.
 * @returns {boolean} Returns `true` if `term` is either a verb terminal rule set or verb term sequence, else `false`.
 */
function isForbiddenVerb(term) {
	if (exports.isVerbTerm(term)) {
		util.logErrorAndPath('Verb term', term.isTermSet ? 'set' : 'sequence', 'provided to non-verb term sequence (i.e., `type` is not \'verb\'):', term)
		return true
	}

	return false
}

/**
 * Checks if `term` is a verb terminal rule set (created by `termSequence.newVerb()`) or a verb term sequence (created by `termSequence.newTermSequence()`).
 *
 * If `tense` is provided, checks if `term.verbTense` is of matching grammatical tense.
 * • Created by `termSequence.newVerb(verbOptions)` with matching `verbOptions.tense`, or `termSequence.newTermSequence(termSeqOptions)` with matching `termSeqOptions.verbTense`.
 *
 * @memberOf termSequence
 * @param {NSymbol} term The terminal rule set or term sequence to inspect.
 * @param {string} [tense] The grammatical tense for which `term` must match.
 * @returns {boolean} Returns `true` if `term` is a verb terminal rule set or verb term sequence (of matching `tense` if provided), else `false`.
 */
exports.isVerbTerm = function (term, tense) {
	// Check if `term` is a term sequence (or terminal rule set) of type 'verb'.
	if (!(term.isTermSequence && term.termSequenceType === 'verb')) {
		return false
	}

	// If `tense` is provided, check `term` is of matching grammatical tense.
	if (tense) {
		if (verbSchema.tense.values.indexOf(tense) === -1) {
			util.logError('Unrecognized verb grammatical tense:', util.stylize(tense))
			throw new Error('Unrecognized verb grammatical tense')
		}

		return term.verbTense === tense
	}

	return true
}

/**
 * Checks if `terminalSymbol` is ill-formed. If so, prints an error message.
 *
 * Only the following terminal symbols are permitted:
 * • Contains only alphabetic and/or specified punctuation characters: a-z, A-Z, '
 * • Integers greater than or equal to 0
 * • Exactly: <, >
 *
 * @private
 * @static
 * @param {string} terminalSymbol The terminal symbol to check.
 * @returns {boolean} Returns `true` if `terminalSymbol` contains any forbidden characters, else `false`.
 */
function isIllFormedTerminalSymbol(terminalSymbol) {
	/**
	 * Check if `terminalSymbol` is a permitted non-alphabetic symbol: <, >. `terminalSymbol` must match these symbols exactly; can not contain them as substring.
	 * • <, > - for use by prepositions: ">" -> "greater than".
	 */
	var reSpecialSymbol = /^[<>]$/
	if (reSpecialSymbol.test(terminalSymbol)) {
		return false
	}

	/**
	 * Check if `terminalSymbol` is an integer greater than or equal to 0.
	 * • Only digit characters (0-9), no decimal points, and no leading zeros. Alphanumeric symbols that contains digits are rejected.
	 * • For use by months: "1" -> "January".
	 */
	var reInteger = /^(0|[1-9][\d]*)$/
	if (reInteger.test(terminalSymbol)) {
		return false
	}

	/**
	 * Check if `terminalSymbol` contains any non-alphabetic or unspecified punctuation character: a-z, A-Z, '
	 * • apostrophe - for use in "followers'", "i'd" -> "I".
	 */
	var permittedPuncMarks = '\''
	var reForbiddenChar = RegExp('[^a-zA-Z' + permittedPuncMarks + ']')
	var forbiddenCharMatch = reForbiddenChar.exec(terminalSymbol)
	if (forbiddenCharMatch !== null) {
		util.logErrorAndPath('Terminal symbol', util.stylize(terminalSymbol), 'contains forbidden character:', util.stylize(forbiddenCharMatch[0]))
		return true
	}

	// Check if `terminalSymbol` is just a single permitted punctuation mark (defined above).
	var reSinglePuncMark = RegExp('^[' + permittedPuncMarks + ']$')
	var singlePuncMarkMatch = reSinglePuncMark.exec(terminalSymbol)
	if (singlePuncMarkMatch !== null) {
		util.logErrorAndPath('Terminal symbol is a single punctuation mark:', util.stylize(singlePuncMarkMatch[0]))
		return true
	}

	// Check if `terminalSymbol` contains multiple permitted punctuation marks (defined above).
	var reMultiplePuncMarks = RegExp('[' + permittedPuncMarks + ']', 'g')
	var puncMarkMatches = terminalSymbol.match(reMultiplePuncMarks)
	if (puncMarkMatches !== null && puncMarkMatches.length > 1) {
		util.logErrorAndPath('Terminal symbol', util.stylize(terminalSymbol), 'contains multiple punctuation marks:', puncMarkMatches.map(util.unary(util.stylize)).join(', '))
		return true
	}

	return false
}