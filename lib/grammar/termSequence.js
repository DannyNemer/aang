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


/**
 * The enumerated type of term sequence types. For use when assigning the `type` parameter with `g.newTermSequence()`.
 *
 * Designed as an enumerated type, though maps properties to strings instead of numbers to include the type names when printed to console.
 *
 * @type {Object.<string, string>}
 */
exports.termTypes = {
	INVARIABLE: 'invariable',
	PRONOUN: 'pronoun',
	VERB: 'verb',
	VERB_PRESENT: 'verb-present',
	VERB_PAST: 'verb-past',
}

/**
 * The inflections of a verb, from which `termSequence.newVerb()` creates a verb terminal rule set.
 *
 * Each rule in this set has an object as its `text` with the properties `oneSg`, `threeSg`, `pl`, and `past`. When constructing parse trees, `pfsearch` conjugates this `text` object to the correct verb form (i.e., display text) according to grammatical properties in the same tree:
 * • The person-number forms, `oneSg`, `threeSg`, and `pl`, are conjugated by the grammatical `personNumber` property in preceding nominative rules.
 * • The tense form, `past`, is conjugated by the `grammaticalForm` property in the (immediate) parent nonterminal rule. Also, if the parent rule has `acceptedTense` defined as 'past', it accepts the `past` form when input, but does not conjugate to it otherwise (unlike `grammaticalForm`).
 *
 * The grammar generator and `pfsearch` use neither `presentSubjunctive`, `presentParticiple`, nor `pastParticiple` for conjugation. Rather, their parameterization serves only to enforce complete definitions of verbs for complete substitution sets. They are replaced when input by one of the first four forms in the set.
 *
 * Note: It is much better to have a single terminal rule set with dynamic grammatical conjugation than to define separate rule sets with identical terminal symbols but different display text for the different non-nominative grammatical forms. The non-nominative forms (e.g., 'past', 'nom', 'obj') conjugate via the parent rule and therefore can determine inflection at compile time, unlike nominative conjugation which depends on the parse tree. The overhead `Parser` endures for the additional reductions for the additional terminal rule matches is far greater than the `pfsearch` overhead for the conjugation.
 *
 * Note: Each verb form becomes a terminal symbol and can not contain whitespace.
 *
 * @typedef {Object} VerbFormsTermSet
 * @property {string} oneSg The first-person-singular verb form, chosen by the nonterminal rule property `personNumber`. E.g., "am", "was", "like".
 * @property {string} threeSg The third-person-singular verb form, chosen by the nonterminal rule property `personNumber`. E.g., "is", "was", "likes".
 * @property {string} pl The plural verb form, chosen by the nonterminal rule property `personNumber`. E.g., "are", "were" "like".
 * @property {string} past The simple past tense verb form (or, preterite), chosen by the parent rule property `grammaticalForm` and accepted when input by matching the parent rule property `acceptedTense`. E.g., "was", "liked", "did", "had".
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
 * Each rule in this set has an object as its `text` with the properties `oneSg`, `threeSg`, and `pl`. When constructing parse trees, `pfsearch` conjugates this `text` object to the correct verb form (i.e., display text) according to the grammatical `personNumber` property in preceding nominative rules in the same tree.
 *
 * The grammar generator and `pfsearch` use neither `presentSubjunctive` nor `presentParticiple` for conjugation. Rather, their parameterization serves only to enforce complete definitions of verbs for complete substitution sets. They are replaced when input by one of first three forms in the set.
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
 * Each rule in this set is an invariable term with the `past` string as its `text`. `pfsearch` can not conjugate these rules.
 *
 * The grammar generator and `pfsearch` do not use `pastParticiple` for conjugation. Rather, its parameterization serves only to enforce complete definitions of verbs for complete substitution sets. It is replaced when input by `past`.
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
 * If `options.tense` is `undefined`, each rule in the set has an object as its `text` with the properties `oneSg`, `threeSg`, `pl`, and `past` for the different verb forms. When constructing parse trees, `pfsearch` conjugates this `text` object to the correct verb form (i.e., display text) according to grammatical properties in the same tree:
 * • The person-number forms, `oneSg`, `threeSg`, and `pl`, are conjugated by the grammatical `personNumber` property in preceding nominative rules.
 * • The tense form, `past`, is conjugated by the `grammaticalForm` property in the (immediate) parent nonterminal rule. Also, if the parent rule has `acceptedTense` defined as 'past', it accepts the `past` form when input, but does not conjugate to it otherwise (unlike `grammaticalForm`).
 *
 * If `options.tense` is 'present', each rule in the set has an object as its `text` just as when `options.tense` is `undefined`, but there is not `past` value on the `text` objects and there is no `grammaticalForm` conjugation.
 *
 * If `options.tense` is 'past' is 'past', each rule in this set is an invariable term with the  `options.verbFormsTermSet.past` string as its `text`. `pfsearch` can not conjugate these rules.
 *
 * Note: `options.tense` and `options.noPastDisplayText` are mutually exclusive.
 *
 * Note: Each verb form in `options.verbFormsTermSet` becomes a terminal symbol and can not contain whitespace.
 *
 * The returned `NSymbol` has the following properties:
 * • name - `options.symbolName`.
 * • isTermSequence - `true`. Enables nesting within term sequences and flattening in `flattenTermSequence`.
 * • isTermSet - `true`. Specifies every rule is a uni-token terminal rule with the same `text` value.
 * • termSequenceType - 'verb', 'verb-present', or 'verb-past', according to `options.tense`.
 * • defaultText - If `options.tense` is 'present' or `undefined`, the conjugative `text` object for the verb forms, else if `options.tense` is 'past', the invariable `text` string for the past tense verb form. Identical for every (terminal) rule this `NSymbol` produces. For use when nesting this `NSymbol` in a term sequence.
 * • insertionCost - `options.insertionCost`, if defined.
 *
 * @memberOf termSequence
 * @param {Object} options The options object.
 * @param {string} options.symbolName The name for the new `NSymbol`.
 * @param {number} [options.insertionCost] The insertion cost for the terminal rule set, assigned to the first rule in the set (i.e., `verbFormsTermSet.oneSg`). Enables the creation of insertion rules using the new `NSymbol` which produces this set (i.e., the LHS symbol).
 * @param {string} [options.tense] The grammatical tense, 'present' or 'past', for which to limit the verb terminal rule set; i.e., exclude all verb forms for the opposite tense.
 * @param {boolean} [options.noPastDisplayText] Specify excluding the past tense verb forms, `options.verbFormsTermSet.past`, from the display `text` object. Instead, substitute the `past` form when input with the verb's correct present tense form. Unlike `options.tense`, this creates terminal rules for the past tense verb forms as substitutions.
 * @param {VerbFormsTermSet|PresentVerbFormsTermSet|PastVerbFormsTermSet} options.verbFormsTermSet The verb terminal rule set with each verb form inflection. `VerbFormsTermSet` if `options.tense` is `undefined`, `PresentVerbFormsTermSet` if `options.tense` is 'present', or `PastVerbFormsTermSet` if `options.tense` is 'past'.
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
	 * If `options.tense` is `undefined`, create a terminal rule set where each rule has an object as its `text` with the properties `oneSg`, `threeSg`, `pl`, and `past` for the different verb forms.
	 *
	 * Else if `options.tense` is 'present', create a terminal rule set where each rule has an object as its `text` with the properties `oneSg`, `threeSg`, and `pl` for the different present tense verb forms.
	 *
	 * Else if `options.tense` is 'past', create a terminal rule set with `termSequence.newTermSequence()`, where each rule has the string `options.verbFormsTermSet.past` has its `text`.
	 */
	var tense = options.tense
	var verbSym = tense === 'past' ? baseNewPastVerb(options) : baseNewVerb(options)

	/**
	 * Specify all possible `verbSym` reductions (i.e., subtrees) yield only display text, no semantics. Hence, all subtrees `verbSym` produces are semantically identical. Enables nesting within term sequences and instructs `flattenTermSequence` to flatten instances of `verbSym` to a single terminal parse node with a single display text.
	 *
	 * Assign `isTermSequence` after adding all `verbSym` rules above because `NSymbol.prototype.addRule()` prevents invocation on `NSymbol` instances with `isTermSequence`.
	 */
	verbSym.isTermSequence = true

	// Specify every rule `verbSym` produces is a uni-token terminal rule with the same `text` (display text) value. A terminal rule set is subset of term sequences.
	verbSym.isTermSet = true

	// Specify the `verbSym` term sequence type, according to `options.tense`. For inclusion within a term sequence of matching type.
	if (tense === undefined) {
		verbSym.termSequenceType = exports.termTypes.VERB
	}	else if (tense === 'present') {
		verbSym.termSequenceType = exports.termTypes.VERB_PRESENT
	}	else if (tense === 'past') {
		verbSym.termSequenceType = exports.termTypes.VERB_PAST
	}

	// Save `insertionCost` for convenience; unused internally.
	verbSym.insertionCost = options.insertionCost

	return verbSym
}

/**
 * Creates an `NSymbol` that produces a terminal rule set for a verb with the necessary text forms for conjugation.
 *
 * If `options.tense` is `undefined`, each rule in the set has an object as its `text` with the properties `oneSg`, `threeSg`, `pl`, and `past` for the different verb forms. When constructing parse trees, `pfsearch` conjugates this `text` object to the correct verb form (i.e., display text) according to grammatical properties in the same tree:
 * • The person-number forms, `oneSg`, `threeSg`, and `pl`, are conjugated by the grammatical `personNumber` property in preceding nominative rules.
 * • The tense form, `past`, is conjugated by the `grammaticalForm` property in the (immediate) parent nonterminal rule. Also, if the parent rule has `acceptedTense` defined as 'past', it accepts the `past` form when input, but does not conjugate to it otherwise (unlike `grammaticalForm`).
 *
 * If `options.tense` is 'present', each rule in the set has an object as its `text` just as when `options.tense` is `undefined`, but there is not `past` value on the `text` objects and there is no `grammaticalForm` conjugation.
 *
 * Note: `options.tense` and `options.noPastDisplayText` are mutually exclusive.
 *
 * Note: Each verb form in `options.verbFormsTermSet` becomes a terminal symbol and can not contain whitespace.
 *
 * For use by `termSequence.newVerb(options)` when `options.tense` is `undefined` or 'present'.
 *
 * The returned `NSymbol` has the following properties, which `termSequence.newVerb()` extends:
 * 1. name - `options.symbolName`.
 * 2. defaultText - The conjugative `text` object for the verb forms. Identical for every (terminal) rule this `NSymbol` produces. For use when nesting this `NSymbol` in a term sequence.
 *
 * @private
 * @static
 * @param {Object} options The `termSequence.newVerb()` options object.
 * @param {string} options.symbolName The name for the new `NSymbol`.
 * @param {number} [options.insertionCost] The insertion cost for the terminal rule set, assigned to the first rule in the set (i.e., `verbFormsTermSet.oneSg`). Enables the creation of insertion rules using the new `NSymbol` which produces this set (i.e., the LHS symbol).
 * @param {string} [options.tense] The grammatical tense, 'present', for which to limit the verb terminal rule set; i.e., exclude all past tense verb forms.
 * @param {boolean} [options.noPastDisplayText] Specify excluding the past tense verb forms, `options.verbFormsTermSet.past`, from the display `text` object. Instead, substitute the `past` form when input with the verb's correct present tense form. Unlike `options.tense`, this creates terminal rules for the past tense verb forms as substitutions.
 * @param {VerbFormsTermSet|PresentVerbFormsTermSet} options.verbFormsTermSet The verb terminal rule set with each verb form inflection. `VerbFormsTermSet` if `options.tense` is `undefined`, or `PresentVerbFormsTermSet` if `options.tense` is 'present'.
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
	 * For example, exclude "had", the past tense of the auxiliary verb "have", from display text because it yields the past perfect construction. Past perfect implies the event/action took place in the past and excludes the present. This implication may be undesirable if input when the DB behind the NLI lacks this specific information.
	 * • For example, "people I had followed" means people the user previously followed and no longer follows. If the DB lacks this information and can only return people the user currently follows, then correct the display text to "have" to accurately reflect the returned data.
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

	/**
	 * The terminal rule for the third-person-singular verb form, chosen by the nonterminal rule property `personNumber`. E.g., "is", "was", "likes".
	 *
	 * Check if distinguishable from the first-person-singular verb form; e.g., "was". Do not check if other verb forms are unique; rather, allow `NSymbol.prototype._newTerminalRule()` to throw the exception for duplicate terminal symbols.
	 */
	if (verbFormsTermSet.threeSg !== verbFormsTermSet.oneSg) {
		verbSym.addRule(createVerbTerminalRule(verbFormsTermSet.threeSg, verbTextForms, 'present'))
	}

	/**
	 * The terminal rule for the the plural verb form, chosen by the nonterminal rule property `personNumber`. E.g., "are", "were" "like".
	 *
	 * Check if distinguishable from the first-person-singular verb form; e.g., "like". Do not check if other verb forms are unique; rather, allow `NSymbol.prototype._newTerminalRule()` to throw the exception for duplicate terminal symbols.
	 */
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
	 * For use when nesting `verbSym` in the first accepted rule of a term sequence created with `termSequence.newTermSequence()`. If so, that new term sequence uses `verbSym.defaultText` in its default text, which it uses as the display text for its substitution rules, if any.
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
	// Check every terminal symbol lacks whitespace and forbidden characters.
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
 * Uses `termSequence.newTermSequence()` to create the invariable terminal rule set, where each rule has the string `options.verbFormsTermSet.past` as its `text`. `pfsearch` can not conjugate these rules.
 *
 * Note: Each verb form in `options.verbFormsTermSet` becomes a terminal symbol and can not contain whitespace.
 *
 * For use by `termSequence.newVerb(options)` when `options.tense` is 'past'.
 *
 * The returned `NSymbol` has the following properties, which `termSequence.newVerb()` extends:
 * 1. name - `options.symbolName`.
 * 2. isTermSequence - `true`. Enables nesting within term sequences and flattening in `flattenTermSequence`.
 * 3. defaultText - The invariable `text` string for the invariable `text` string for the past tense verb form. Identical for every (terminal) rule this `NSymbol` produces. For use when nesting this `NSymbol` in a term sequence.
 * 4. insertionCost - `options.insertionCost`, if defined.
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
function baseNewPastVerb(options) {
	if (options.tense !== 'past') {
		util.logError('`newPastVerb()` invoked with non-past tense verb options object:', options)
		throw new Error('Ill-formed past verb')
	}

	var verbFormsTermSet = options.verbFormsTermSet

	// Creates an invariable, non-conjugative term sequence for the past tense verb forms.
	var pastVerbTermSet = {
		symbolName: options.symbolName,
		type: exports.termTypes.INVARIABLE,
		acceptedTerms: [ verbFormsTermSet.past ],
	}

	if (options.insertionCost !== undefined) {
		pastVerbTermSet.insertionCost = options.insertionCost
	}

	if (verbFormsTermSet.pastParticiple) {
		pastVerbTermSet.substitutedTerms = [ verbFormsTermSet.pastParticiple ]
	}

	// The calling `termSequence.newVerb(options)` will extend `newVerb` with the property `isTermSet` and will redefine `termSequenceType` as 'verb-past'.
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
 * Each rule in the set has an object as its `text` with the properties `nom` and `obj` for the different personal pronoun case forms. When constructing parse trees, `pfsearch` conjugates this `text` object to the correct grammatical case (i.e., display text) according to the `grammaticalForm` property on the (immediate) parent rule.
 *
 * Note: Each pronoun form in `options.pronounFormsTermSet` becomes a terminal symbol and can not contain whitespace.
 *
 * The returned `NSymbol` has the following properties:
 * • name - `options.symbolName`.
 * • isTermSequence - `true`. Enables nesting within term sequences and flattening in `flattenTermSequence`.
 * • isTermSet - `true`. Specifies every rule is a uni-token terminal rule with the same `text` value.
 * • termSequenceType - 'pronoun'.
 * • defaultText - The conjugative `text` object for the pronoun forms. Identical for every (terminal) rule this `NSymbol` produces. For use when nesting this `NSymbol` in a term sequence.
 * • insertionCost - `options.insertionCost`, if defined.
 *
 * @memberOf termSequence
 * @param {Object} options The options object.
 * @param {string} options.symbolName The name for the new `NSymbol`.
 * @param {number} [options.insertionCost] The insertion cost for the terminal rule set, assigned to the first rule in the set (i.e., `pronounFormsTermSet.nom`). Enables the creation of insertion rules using the new `NSymbol` which produces this set (i.e., the LHS symbol).
 * @param {PronounFormsTermSetSchema} options.pronounFormsTermSet The pronoun terminal rule set with each pronoun form inflection.
 * @returns {NSymbol} Returns the new `NSymbol` for the pronoun terminal rule set.
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
		nom: pronounFormsTermSet.nom,
		obj: pronounFormsTermSet.obj,
	}

	// The terminal rule for the nominative case form, used as the subject of a verb, chosen by the parent nonterminal rule property `grammaticalForm`. E.g., "I", "we".
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

	// The terminal rule for the objective case form, used as the object of a verb, chosen by the parent nonterminal rule property `grammaticalForm`. E.g., "me", "us",
	pronounSym.addRule({
		isTerminal: true,
		rhs: pronounFormsTermSet.obj,
		text: pronounTextForms,
	})

	/**
	 * Specify all possible `pronounSym` reductions (i.e., subtrees) yield only display text, no semantics. Hence, all subtrees `pronounSym` produces are semantically identical. Enables nesting within term sequences and instructs `flattenTermSequence` to flatten instances of `pronounSym` to a single terminal parse node with a single display text.
	 *
	 * Assign `isTermSequence` after adding all `pronounSym` rules above because `NSymbol.prototype.addRule()` prevents invocation on `NSymbol` instances with `isTermSequence`.
	 */
	pronounSym.isTermSequence = true

	// Specify every rule `pronounSym` produces is a uni-token terminal rule with the same `text` (display text) value. A terminal rule set is subset of term sequences.
	pronounSym.isTermSet = true

	// Define the `verbSym` term sequence type.
	pronounSym.termSequenceType = exports.termTypes.PRONOUN

	/**
	 * Save `pronounTextForms`, which is identical for every terminal rule `pronounSym` produces, as the terminal rule set's default text.
	 *
	 * For use when nesting `pronounSym` in the first accepted rule of a term sequence created with `termSequence.newTermSequence()`. If so, that new term sequence uses `pronounSym.defaultText` in its default text, which it uses as the display text for its substitution rules, if any.
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
	// Check pronoun forms term set.
	var pronounFormsTermSet = options.pronounFormsTermSet
	if (util.illFormedOpts(pronounFormsTermSetSchema, pronounFormsTermSet)) {
		return true
	}

	// Check every terminal symbol lacks whitespace and forbidden characters.
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
 * @property {string|NSymbol|NSymbol[]} term The terminal symbol, terminal rule set, term sequence, or term sequence pair to substitute when matched.
 * @property {number} costPenalty The substitution cost penalty added to the rule's cost.
 */
var substitutedTermSchema = {
	term: { type: [ String, Object, NSymbol, Array ], required: true },
	costPenalty: { type: Number, required: true },
}

/**
 * Creates an `NSymbol` that produces a terminal rule sequence forming a term or phrase, comprised of terminal rules, terminal rule sets and nested term sequences.
 *
 * Each item in `options.acceptedTerms` and `options.substitutedTerms` must be one of the following:
 * 1. A terminal symbol.
 *   • I.e., an invariable term which `pfsearch` can not inflect when parsing.
 *   • Can not contain whitespace.
 * 2. A terminal rule set created by `termSequence.newVerb()` or `termSequence.newPronoun()`.
 * 3. A terminal rule sequence created by this method or `termSequence.newTermSequenceBinarySymbol()`.
 * 4. An ordered pair containing any combination of #2, #3, or nested ordered pairs from which to recursively create new term sequences.
 *
 * In addition, items in `options.substitutedTerms` may also be the following:
 * 5. `SubstitutedTerm` - A term and cost pairing with the following properties:
 *   • {string|NSymbol|NSymbol[]} SubstitutedTerm.term - Any of #1-4 above.
 *   • {number} SubstitutedTerm.costPenalty - The substitution cost penalty added to the rule's cost.
 *
 * The `defaultText` value (or merger of `defaultText` values) of the first term in `options.acceptedTerms` is used as the `text` value of the rules for the items in `options.substitutedTerms`, if any, which substitutes the text those rules would otherwise produce.
 *
 * All nonterminal rules the new `NSymbol` produces are marked `isTermSequence`, which instructs `flattenTermSequence` to do the following:
 * 1. For non-edit rules, `flattenTermSequence` merges the `text` values of the matched terminal rules each produces.
 * 2. For insertion rules, `flattenTermSequence` traverses the single child node, gets the `text` values of the matched terminal rules, and merges those `text` values with the rule's insertion `text` according to its `insertedSymIdx` property.
 * 3. For substitution rules, `flattenTermSequence` uses the `text` value of the rule and ignores the matched terminal rules each produces.
 *
 * For all three, `flattenTermSequence` creates a new, terminal `ruleProps` for the rule with the `text` value defined as specified, which `pfsearch` uses to generate display text. `flattenTermSequence` also always traverses the matched terminal rules to get the input tense of any matched verb terminal rules, which `pfsearch` uses if the parent rule has matching `acceptedTense`.
 *
 * `options.type` must be one of the following:
 * 1. 'invariable'
 *   • Every term sequence in `options.acceptedTerms` and `options.substitutedTerms` has `termSequenceType` of
 *     'invariable'.
 *   • `options.acceptedTerms`and `options.substitutedTerms` can contain terminal symbols (which are
 *     invariable).
 *   • Enables use of `options.insertionCost`, assigned to the first terminal symbol in
 *     `options.acceptedTerms`.
 *   • `options.substitutedTerms` can contain term sequences with `termSequenceType` of 'pronoun', though is
 *     rare.
 *   • These restrictions ensure every accepted and substituted term sequence is invariable and contains no
 *     conjugative terminal rules sets.
 * 2. 'pronoun'
 *   • Every term sequence (or terminal rule set) in `options.acceptedTerms` has `termSequenceType` of
 *     'pronoun' and every term sequence in `options.substitutedTerms` has `termSequenceType` of 'pronoun' or
 *     'invariable'.
 *   • Term sequence pairs in `options.acceptedTerms` must contain one 'pronoun' and one 'invariable' term
 *     sequence, and every pair in `options.substitutedTerms` must contain either one 'pronoun' and one
 *     'invariable' term sequence or two 'invariable' term sequences.
 *   • These restrictions ensure every accepted term sequence produces exactly one pronoun terminal rule set,
 *     created by `g.newPronoun()`, and every substituted sequence produces exactly one pronoun terminal rule
 *     set or is invariable.
 * 3-5. 'verb', 'verb-present', 'verb-past'
 *   • Every term sequence (or terminal rule set) in `options.acceptedTerms` and `options.substitutedTerms`
 *     has `termSequenceType` of 'verb', 'verb-present', or 'verb-past' (as `options.type` defines).
 *   • Hence, every term sequences includes verb forms of either all grammatical tenses ('verb'), present
 *     tense and excludes past tense forms ('verb-present'), or past tense and excludes present tense forms
 *     ('verb-past').
 *   • Term sequence pairs in `options.acceptedTerms` and `options.substitutedTerms` must contain one 'verb'
 *     and one 'invariable' term sequence.
 *   • Term sequence pairs in `options.acceptedTerms` in and `options.substitutedTerms` must contain one
 *     'verb'/'verb-present'/'verb-past' term sequence (as `options.type` defines) and one 'invariable' term
 *     sequence.
 *   • These restrictions ensure every term sequence produces exactly one verb terminal rule set, created by
 *     `g.newVerb()` of matching tense.
 *
 * The returned `NSymbol` has the following properties:
 * • name - `options.symbolName`.
 * • isTermSequence - `true`. Enables nesting within term sequences and flattening in `flattenTermSequence`.
 * • termSequenceType - `options.type`.
 * • defaultText - The `defaultText` value (or merger of `defaultText` values) of the first term sequence (or terminal rule set) in `options.acceptedTerms`. For use when nesting this `NSymbol` in another term sequence.
 * • insertionCost - `options.insertionCost`, if defined.
 *
 * @memberOf termSequence
 * @param {Object} options The options object.
 * @param {string} options.symbolName The name for the new `NSymbol`.
 * @param {number} [options.insertionCost] The insertion cost for the term sequence, assigned to the first terminal symbol in `options.acceptedTerms`, if any. Enables the creation of insertion rules using the new `NSymbol` which produces this set (i.e., the LHS symbol). Only permitted if `options.type` is 'invariable'.
 * @param {string} options.type The term sequence type, as explained above.
 * @param {(string|NSymbol|NSymbol[])[]} options.acceptedTerms The terminal symbols, terminal rule sets, term sequences, and term sequence pairs to accept when input, as explained above.
 * @param {(string|NSymbol|NSymbol[]|SubstitutedTerm)[]} [options.substitutedTerms] The terminal symbols, terminal rule sets, term sequences, and term sequence pairs to substitute when matched (with a cost penalty if `SubstitutedTerm`) with the first item in `options.acceptedTerms`, as explained above.
 * @returns {NSymbol} Returns the new `NSymbol` for the terminal rule sequence.
 */
var termSequenceSchema = {
	symbolName: { type: String, required: true },
	insertionCost: Number,
	type: { values: Object.keys(exports.termTypes).map(type => exports.termTypes[type]), required: true },
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
	 * The `defaultText` value (or merger of `defaultText` values) of the first term sequence (or terminal rule set) in `options.acceptedTerms`.
	 *
	 * For use as the `text` value of the rules for the term sequences in `options.substitutedTerms`, if any, which substitutes the `text` they produce.
	 *
	 * Can be an invariable term string, a conjugative text object, or an array of both.
	 */
	var defaultText

	options.acceptedTerms.forEach(function (term, i) {
		/**
		 * If `term` is a terminal symbol.
		 *
		 * An example:
		 *   `[term-funding]` -> "funding", text: "funding"
		 */
		if (term.constructor === String) {
			// Check `term` lacks whitespace and forbidden characters.
			if (isIllFormedTerminalSymbol(term)) {
				throw new Error('Ill-formed terminal symbol')
			}

			// Only permit terminal symbols as accepted term sequences for invariable sequences.
			if (options.type !== exports.termTypes.INVARIABLE) {
				util.logErrorAndPath('Terminal symbol provided as accepted term for term sequence not of', util.stylize(exports.termTypes.INVARIABLE), 'type:', term, options)
				throw new Error('Ill-formed term sequence')
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
				// If `term` is the first item in `options.acceptedTerms`, save it as display text for `options.substitutedTerms`, if any.
				defaultText = term
			}
		}

		/**
		 * If `term` is a term sequence created by `termSequence.newTermSequence()` or `termSequence.newTermSequenceBinarySymbol()` (or a terminal rule set created by `termSequence.newVerb()` or `termSequence.newPronoun()`).
		 *
		 * An example where `term` is the terminal rule set `[make]`:
		 *   `[create]` -> `[make]` -> "make", text: `{make-verb-forms}`
		 *
		 * An example where `term` it the term sequence `[work-on]`:
		 *   `[contribute-to]` -> `[work-on]` -> `[work]` -> "work", text: `{work-verb-forms}`
		 *                                    -> `[on]`   -> "on",   text: "on"
		 */
		else if (term.isTermSequence) {
			if (term.termSequenceType !== options.type) {
				util.logErrorAndPath('Accepted term sequence', util.stylize(term.name), 'is not of type', util.stylize(type) + ':', term, options)
				throw new Error('Ill-formed term sequence')
			}

			/**
			 * Even though this rule is unary and does not require `text` merging, `NSymbol` still assign the rule property `isTermSequence` to instruct `flattenTermSequence` to bring the `text` up to this rule's node level, allowing `gramProps` to conjugate the `text` (`gramProps` only conjugates the immediate child nodes).
			 *
			 * Even if `term` is a terminal rule set, for which the `text` value of every terminal rule is identical, do not assign that `text` to this rule as if it were a substitution. Although the parsing result will be identical, leave them distinguishable for now.
			 */
			termSeqSym.addRule({
				rhs: [ term ],
			})

			if (i === 0) {
				/**
				 * If `term` is the first item in `options.acceptedTerms`, save its `defaultText` value as display text for `options.substitutedTerms`, if any.
				 * • If `term` is a terminal rule set, `defaultText` is the identical `text` of all terminal rules in the set.
				 * • If `term` is a term sequence, `defaultText` is the display text of the first accepted term sequence it produces.
				 */
				defaultText = term.defaultText
			}
		}

		/**
		 * If `term` is an ordered pair containing any combination of term sequences, terminal rule sets, or nested ordered pairs from which to recursively create new term sequences, for which one item has term sequence type `options.type` and the other has type 'invariable'.
		 *
		 * An example of two terminal rule sets:
		 *   `[contribute-to]` -> `[contribute]` -> "contribute", text: `{contribute-verb-forms}`
		 *                     -> `[to]`         -> "to",         text: "to"
		 *
		 * An example of a terminal rule set (`[have]`) and a term sequence (`[in-common]`):
		 *   `[have-in-common]` -> `[have]`                    -> "have",   text: `{have-verb-forms}`
		 *                      -> `[in-common]` -> `[in]`     -> "in",     text: "in"
		 *                                       -> `[common]` -> "common", text: "common"
		 *
		 * An example of a terminal rule set (`[have]`) and a nested ordered pair of two terminal rule sets (`[in]` and `[common]`) from which to recursively create a new term sequence (`[in-common]`):
		 *   `[have-in-common]` -> `[have]`                              -> "have", text: `{have-verb-forms}`
		 *                      -> [ `[in]` `[common] ] -> `[in-common]` -> `[in]`     -> "in",     text: "in"
		 *                                                               -> `[common]` -> "common", text: "common"
		 */
		else if (term.constructor === Array) {
			/**
			 * Recursively flatten any nested ordered pairs to `NSymbol` instances that produce the term sequence.
			 *
			 * Ensure the resulting pair produces only one terminal rule set of type `options.type`, and all other term sequences are 'invariable'.
			 */
			var termSeqPair = flattenNestedTermSequencePairs(term, options.type)

			// `flattenTermSequence` will traverse this rule's child nodes, merge the `text` values of the matched terminal rules it produces, and create a new, terminal `ruleProps` for the rule's node to instruct `pfsearch` to use as display text and not traverse further.
			termSeqSym.addRule({
				rhs: termSeqPair,
			})

			if (i === 0) {
				/**
				 * If `term` is the first item in `options.acceptedTerms`, merge the `defaultText` values of the pair's term sequences as display text for for `options.substitutedTerms`, if any.
				 * • If an item in the pair is a verb, its `defaultText` is the identical `text` of all terminal rules in the set.
				 * • If an item in the pair is a term sequence, its `defaultText` is the display text of the first accepted term sequence it produces.
				 */
				defaultText = grammarUtil.mergeTextPair(termSeqPair[0].defaultText, termSeqPair[1].defaultText)
			}
		}

		else {
			util.logErrorAndPath('Accepted term is neither a terminal symbol, terminal rule set, term sequence, nor a term sequence pair:', term, options)
			throw new Error('Ill-formed term sequence')
		}
	})

	if (options.substitutedTerms) {
		// Create nonterminal substitution rules with `defaultText` as the `text` value for each rule. This instructs `pfsearch` to use display text from these rules and discard the `text` values these rules produce.
		options.substitutedTerms.forEach(function (term) {
			// The substitution cost penalty incurred when `term` is matched (and substituted).
			var costPenalty = 0
			if (term.constructor === Object) {
				if (util.illFormedOpts(substitutedTermSchema, term)) {
					throw new Error('Ill-formed substituted term sequence')
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
				// Check `term` lacks whitespace and forbidden characters.
				if (isIllFormedTerminalSymbol(term)) {
					throw new Error('Ill-formed terminal symbol')
				}

				// Only permit terminal symbols as substituted term sequences for 'invariable' or 'pronoun' sequences.
				if (options.type !== exports.termTypes.INVARIABLE && options.type !== exports.termTypes.PRONOUN) {
					util.logErrorAndPath('Terminal symbol provided as substituted term for term sequence not of', util.stylize(exports.termTypes.INVARIABLE), 'or', util.stylize(exports.termTypes.PRONOUN), 'type:', term, options)
					throw new Error('Ill-formed substituted term sequence')
				}

				// `pfsearch` uses this rule's `text` as display text instead of the matched terminal symbol it produces (i.e., `term`).
				termSeqSym.addRule({
					isTerminal: true,
					rhs: term,
					text: defaultText,
					costPenalty: costPenalty,
				})
			}

			/**
			 * If `term` is a term sequence created by `termSequence.newTermSequence()` or `termSequence.newTermSequenceBinarySymbol()` (or a terminal rule set created by `termSequence.newVerb()` or `termSequence.newPronoun()`).
			 *
			 * A substitution example where `term` is the terminal rule set `[love]`:
			 *   `[like]` -> `[love]`, text: `{like-verb-forms}`
			 *
			 * A substitution example where `term` the term sequence `[work-on]`:
			 *   `[contribute-to]` -> `[help-with]`, text: `[ {contribute-verb-forms}, "to" ]`
			 */
			else if (term.isTermSequence) {
				/**
				 * Check substituted term sequence, `term`, is of matching term sequence type, `options.type`.
				 *
				 * Verb sequences that only produce the verb forms of a specific grammatical tense are distinguished like all other term sequence types; e.g., 'verb-past'.
				 */
				if (!exports.isTermSequenceType(term, options.type)) {
					/**
					 * 'pronoun' - Substituted term sequences must be of type 'pronoun' or 'invariable'. For example:
					 *   `[1-sg]` -> "myself", text: {1-sg-pronoun-forms}
					 */
					if (options.type === exports.termTypes.PRONOUN) {
						if (!exports.isTermSequenceType(term, exports.termTypes.INVARIABLE)) {
							util.logErrorAndPath('Substituted term sequence', util.stylize(term.name), 'for', util.stylize(options.type), 'sequence is neither of', util.stylize(options.type), 'nor', util.stylize(exports.termTypes.INVARIABLE), 'type:', options)
							throw new Error('Ill-formed substituted term sequence')
						}
					}

					/**
					 * 'invariable' - Substituted term sequences must be of type 'invariable' or 'pronoun', though the latter is rare and therefore not noted in the error message. For example:
					 *   `[1-sg-poss-det]` -> `[1-sg]`, text: "my"
					 *
					 * 'verb', 'verb-present', 'verb-past': Substituted term sequences must be of matching type.
					 */
					else if (options.type !== exports.termTypes.INVARIABLE || !exports.isTermSequenceType(term, exports.termTypes.PRONOUN)) {
						util.logErrorAndPath('Substituted term sequence', util.stylize(term.name), 'for', util.stylize(options.type), 'sequence is not of', util.stylize(options.type), 'type:', options)
						throw new Error('Ill-formed substituted term sequence')
					}
				}

				// `pfsearch` uses this rule's `text` as display text instead of the `text` values its RHS produces.
				termSeqSym.addRule({
					rhs: [ term ],
					text: defaultText,
					costPenalty: costPenalty,
				})
			}

			/**
			 * If `term` is an ordered pair containing any combination of term sequences, terminal rule sets, or nested ordered pairs from which to recursively create new term sequences, for which one item has term sequence type `options.type` and the other has type 'invariable'.
			 *
			 * A substitution example of two terminal rule sets:
			 *   `[contribute-to]` -> `[help]` `[with]`, text: `[ {contribute-verb-forms}, "to" ]`
			 *
			 * A substitution example of a terminal rule set (`[have]`) and a term sequence (`[in-common]`):
			 *   `[share]` -> `[have]` `[in-common]`, text: `{share-verb-forms}`
			 *
			 * A substitution example of a terminal rule set (`[have]`) and a nested ordered pair of terminal rule sets (`[in]` and `[common]`) from which to recursively create a new term sequence (`[in-common]`):
			 *   `[share]` -> `[have]` [ `[in]` `[common] ] -> `[have]` `[in-common]`, text: `{share-verb-forms}`
			 */
			else if (term.constructor === Array) {
				/**
				 * Recursively flatten any nested ordered pairs to `NSymbol` instances that produce term sequences.
				 *
				 * Ensure the resulting pair produces only one terminal rule set of type `options.type`, and all other term sequences are 'invariable'.
				 */
				var termSeqPair = flattenNestedTermSequencePairs(term, options.type)

				// `pfsearch` uses this rule's `text` as display text instead of the `text` values its RHS produces.
				termSeqSym.addRule({
					rhs: termSeqPair,
					text: defaultText,
					costPenalty: costPenalty,
				})
			}

			else {
				util.logError('Substituted term is neither a terminal symbol, terminal rule set, term sequence, nor a term sequence pair:', term, options)
				throw new Error('Ill-formed substituted term sequence')
			}
		})
	}

	/**
	 * Specify all possible `termSeqSym` reductions (i.e., subtrees) yield only display text, no semantics. Hence, all subtrees `termSeqSym` produces are semantically identical. Enables nesting within term sequences and instructs `flattenTermSequence` to flatten instances of `termSeqSym` to a single terminal parse node with a single display text.
	 *
	 * Assign `isTermSequence` after adding all `termSeqSym` rules above because `NSymbol.prototype.addRule()` prevents invocation on `NSymbol` instances with `isTermSequence`.
	 */
	termSeqSym.isTermSequence = true

	// Define the `termSeqSym` term sequence type, which specifies every term sequence `termSequenceType` produces is of the specified type, as described in the method description.
	termSeqSym.termSequenceType = options.type

	/**
	 * Save `defaultText`, which the `defaultText` value (or merger of `defaultText` values) of the first term sequence (or terminal rule set) in `options.acceptedTerms`.
	 *
	 * For use when nesting `termSeqSym` in the first accepted rule of a term sequence created with `termSequence.newTermSequence()`. If so, that new term sequence uses `termSeqSym.defaultText` in its default text, which it uses as the display text for its substitution rules, if any.
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
	if (options.insertionCost !== undefined) {
		// Check `options.insertionCost` only exists for invariable term sequences (the only type permitted to have accepted terminal rules).
		if (options.type !== exports.termTypes.INVARIABLE) {
			util.logErrorAndPath('Term sequence', util.stylize(options.symbolName), 'has `insertionCost` but is not of', util.stylize(exports.termTypes.INVARIABLE), 'type:', options)
			return true
		}

		// Check `options.acceptedTerms` contains a terminal symbol for which to assign `options.insertionCost`.
		if (!options.acceptedTerms.some(term => term.constructor === String)) {
			util.logErrorAndPath('Term sequence', util.stylize(options.symbolName), 'has `insertionCost` but no terminal symbol (i.e., string) in `options.acceptedTerms` to which to assign it:', options)
			return true
		}

	}

	return false
}

/**
 * Creates an `NSymbol` with a single binary rule with `options.termPair` as its `rhs`, which produces a terminal sequence forming a phrase comprised of terminal rule sets and nested term sequences.
 *
 * Each item in `options.termPair` must be one of the following:
 * 1. A terminal rule set created by `termSequence.newVerb()` or `termSequence.newPronoun()`.
 * 2. A terminal rule sequence created by `termSequence.newTermSequence()` or this method.
 * 3. An ordered pair containing any combination of #1, #2, or nested ordered pairs from which to recursively create new term sequences.
 *
 * The single rule the new `NSymbol` produces is marked `isTermSequence`, which instructs `flattenTermSequence` to merge the `text` values of the matched terminal rules this rule produces.
 * • `flattenTermSequence` creates a new, terminal `ruleProps` for the rule with the `text` value, which `pfsearch` uses as display text. `flattenTermSequence` also always traverses the matched terminal rules to get the input tense of any matched verb terminal rules, which `pfsearch` uses if the parent rule has matching `acceptedTense`.
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
 * • termSequenceType - `options.type`.
 * • defaultText - The merger of the `defaultText` values of the terms in `options.termPair`. For use when nesting this `NSymbol` in another term sequence.
 *
 * @memberOf termSequence
 * @param {Object} options The options object.
 * @param {string} [options.symbolName] The name for the new `NSymbol`. If omitted, concatenates the names of the `NSymbol` instances in `options.termPair` (after flattening nested ordered pairs).
 * @param {string} options.type The term sequence type, as explained above.
 * @param {(NSymbol|NSymbol[])[]} options.termPair The ordered pair of term sequences and/or nested term sequence pairs.
 * @param {boolean} [_isNestedTermSequence] Specify `options.termPair` was defined as a nested term pair within another term sequence pair passed to this method or `termSequence.newTermSequence()`.
 * @returns {NSymbol} Returns the new `NSymbol` for the terminal rule sequence.
 */
var binaryTermSequenceSchema = {
	symbolName: String,
	type: termSequenceSchema.type,
	termPair: { type: Array, arrayType: [ NSymbol, Array ], required: true },
}

exports.newTermSequenceBinarySymbol = function (options, _isNestedTermSequence) {
	if (util.illFormedOpts(binaryTermSequenceSchema, options) || isIllFormedNewTermSequenceOptions(options)) {
		throw new Error('Ill-formed binary term sequence')
	}

	/**
	 * Recursively flatten any nested ordered pairs to `NSymbol` instances that produce the term sequence.
	 *
	 * Check the term sequence pair agrees with `options.isVerb` and `options.verbTense`. Pass `_isNestedTermSequence` to prevent `flattenTermSequencePair()` from throwing an exception for `options.termPair` containing a verb when `options.isVerb` is falsey.
	 *
	 * Pass `options.type` to ensure any further nested term sequence pairs are either of `options.type` or `invariable`
	 */
	var termSeqPair = flattenNestedTermSequencePairs(options.termPair, options.type, _isNestedTermSequence)
	var termA = termSeqPair[0]
	var termB = termSeqPair[1]

	/**
	 * Create the `NSymbol` and the single term sequence.
	 *
	 * `flattenTermSequence` will traverse this rule's child nodes, merge the `text` values of the matched terminal rules it produces, and create a new, terminal `ruleProps` for the rule's node to instruct `pfsearch` to use as display text and not traverse further.
	 */
	var termSeqSym = g.newSymbol(options.symbolName || g.hyphenate(termA.name, termB.name)).addRule({
		rhs: termSeqPair,
	})

	/**
	 * Specify all possible `termSeqSym` reductions (i.e., subtrees) yield only display text, no semantics. Hence, all subtrees `termSeqSym` produces are semantically identical. Enables nesting within term sequences and instructs `flattenTermSequence` to flatten instances of `termSeqSym` to a single terminal parse node with a single display text.
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
		 * The `flattenNestedTermSequencePairs()` invocation above ensures either both terms are invariable, or one is invariable and the other is a conjugative sequence (e.g., verb, pronoun).
		 */
		termSeqSym.termSequenceType = termA.termSequenceType === exports.termTypes.INVARIABLE ? termB.termSequenceType : termA.termSequenceType
	} else {
		// Specify every term sequence `termSetSeqSym` produces, accepted or substituted, contains one verb terminal rule set (created by `termSequence.newVerb()`).
		// If `options.verbTense` is defined, every verb `termSeqSym` produces only contains verb forms for the given grammatical tense; i.e., lacks terminal rules for the opposite tense.
		termSeqSym.termSequenceType = options.termSequenceType
	}

	/**
	 * Save `defaultText`, which is the merger of `defaultText` values of the term sequences in `options.termPair`.
	 *
	 * For use when nesting `termSeqSym` in the first accepted rule of a term sequence created with `termSequence.newTermSequence()`. If so, that new term sequence uses `termSeqSym.defaultText` in its default text, which it uses as the display text for its substitution rules, if any.
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
function flattenNestedTermSequencePairs(termSeqPair, termSequenceType, isNestedTermSequence) {
	var termSeqLen = termSeqPair.length
	if (termSeqPair.length !== 2) {
		util.logErrorAndPath('Term sequence array is not an ordered pair:', termSeqPair)
		throw new Error('Ill-formed term sequence pair')
	}

	for (var s = 0; s < termSeqLen; ++s) {
		var termSym = termSeqPair[s]
		if (termSym.constructor === Array) {
			if (termSym.length !== 2) {
				util.logErrorAndPath('Nested term sequence array is not an ordered pair:', termSym)
				throw new Error('Ill-formed term sequence pair')
			}

			/**
			 * Recursively create an `NSymbol` that produces a single binary rule for the term sequence of this nested ordered pair.
			 *
			 * Pass `true` for the method's second parameter, `isNestedTermSequence`, to instruct the method to manually check if the pair `termSym` contains a verb, and ignore the parameters `type` and `verbTense` (even if defined).
			 * • This is necessary because `isVerb` only specifies if the entire base sequence contains or lacks a single verb, not every bigram within the sequence (i.e., recursive invocations of this function). E.g., do not check if "in common" within the verb phrase "have in common" contains a verb. Likewise, `verbTense` only specifies the grammatical tense of the entire base sequence.
			 */
			termSeqPair[s] = exports.newTermSequenceBinarySymbol({
				termPair: termSym,
				// Pass the base type so that if `termSequenceType` is not invariable, and any further nested term sequence pairs contain a term sequence of type other than (neutral) invariable or `termSequenceType`, can report error properly.
				type: termSequenceType,
			}, true)
		} else if (!termSym.isTermSequence) {
			util.logErrorAndPath('Term is terminal rule set, term sequence, nor a nested term sequence pair:', util.stylize(termSym))
			throw new Error('Ill-formed term sequence')
		}
	}

	/**
	 * After flattening nested term sequence pairs within `termSeqPair`:
	 * • If `isVerb` is `true`, check every term sequence `termSeqPair` produces contains exactly one verb terminal rule set.
	 * • If `isVerb` is falsey and `isNestedTermSequence` is falsey, check every term sequence contains zero verb terminal rule sets.
	 * • If `verbTense` is defined, checks every verb `termSeqPair` produces has matching grammatical tense.
	 *
	 * If `isNestedTermSequence` is `true`, `termSeqPair` must either be entire invariable or one invariable and the other of type `termSequenceType`.
	 * Else if `isNestedTermSequence` is `false`, `termSeqPair` must contain one sequence of `termSequenceType` and one invariable.
	 */
	if (isIllFormedTermSequencePair(termSeqPair, termSequenceType, isNestedTermSequence)) {
		throw new Error('Ill-formed term sequence pair')
	}

	// The flattened ordered pair of `NSymbol` instances for use as a `rhs` in a binary rule for a term sequence.
	return termSeqPair
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
	// Check `termSeqPair` is an ordered pair.
	if (termSeqPair.length !== 2) {
		util.logErrorAndPath('Term sequence is not an ordered pair:', termSeqPair)
		return true
	}

	// Check `termSeqPair` only contains term sequences.
	if (!termSeqPair.every(term => term.isTermSequence)) {
		util.logErrorAndPath('Non-term sequence provided in term sequence pair:', termSeqPair)
		return true
	}

	// Check `termSeqPair` does not contain a term sequence that is neither invariable nor of type `termSequenceType`.
	for (var t = 0; t < 2; ++t) {
		var termType = termSeqPair[t].termSequenceType
		if (termType !== exports.termTypes.INVARIABLE && termType !== termSequenceType) {
			util.logErrorAndPath('Term sequence pair of', util.stylize(termSequenceType), 'type contains term sequence of', util.stylize(termType), 'type:', termSeqPair)
			return true
		}
	}

	// Check both term sequences in `termSeqPair` are not of type `termSequenceType` unless invariable. Always check irrespective of `isNestedTermSequence`.
	if (termSequenceType !== exports.termTypes.INVARIABLE && termSeqPair.every(term => term.termSequenceType === termSequenceType)) {
		util.logErrorAndPath('Two', util.stylize(termSequenceType), 'term sequences in a single term sequence ordered pair:', termSeqPair)
		return true
	}

	/**
	 * Only alert if there are verbs when `isVerb` is falsey if `isNestedTermSequence` is also falsey. This is necessary because `isVerb` only specifies if the entire base sequence contains or lacks a single verb, not every bigram within the sequence.
	 *
	 * For example, this function does not check if "in common" within the verb sequence "have in common" contains verb; ergo, `isVerb` is unavailable should the nested pair be "have in", though the pair contains a verb.
	 */
	if (!isNestedTermSequence) {
		/**
		 * Check `termSeqPair` contains a term sequence of type `termSequenceType`.
		 *
		 * If `term` is a verb with grammatical tense (i.e., only produces verb forms for the specified tense), its compatibility is checked like all other term sequence types because `verb-present` and `verb-past` are distinct types.
		 */
		if (termSeqPair.every(term => term.termSequenceType !== termSequenceType)) {
			util.logErrorAndPath('Term sequence pair lacks term of specified type', util.stylize(termSequenceType) + ':', termSeqPair)
			return true
		}
	}

	return false
}

/**
 * Checks if `term` is a term sequence or terminal rule set with term sequence type, `type`.
 *
 * @static
 * @memberOf termSequence
 * @param {NSymbol} term The term sequence to inspect.
 * @param {string} type The term sequence type to match.
 * @returns {boolean} Returns `true` if `term` is of type `type`, else `false`.
 */
exports.isTermSequenceType = function (term, type) {
	return term.isTermSequence && term.termSequenceType === type
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