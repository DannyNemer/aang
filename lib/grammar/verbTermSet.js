/**
 * Methods, which `grammar` inherits, that create `NSymbol` instances that produce terminal rule sets for verbs.
 *
 * These methods create an `NSymbol` for the verb form term sets, as opposed to adding rules to an existing `NSymbol`, and forbid adding rules to the new `NSymbol` afterward to prevent external changes to the rule sets.
 */

var util = require('../util/util')
var g = require('./grammar')
var NSymbol = require('./NSymbol')
var termSequenceUtil = require('./termSequenceUtil')


// Instruct `util.getModuleCallerLocation()` to skip the `verbTermSet` module when searching the call stack for instantiation file paths of `NSymbol` instances that `verbTermSet` methods create. For use in error messages.
util.skipFileInLocationRetrieval()

/**
 * The inflections of a verb, from which `verbTermSet.newVerb()` creates a verb terminal rule set (of term sequence type 'verb') and `verbTermSet.newTenseVerb()` creates separate present and past tense verb terminal rule sets (of term sequence types 'verb-present' and 'verb-past', respectively).
 *
 * Each rule created from the terms in this set has an object as its `text` with the properties `oneSg`, `threeSg`, `pl`, and `past`. When constructing parse trees, `pfsearch` conjugates this `text` object to the correct verb form (i.e., display text) according to grammatical properties in the same tree:
 * • The person-number forms, `oneSg`, `threeSg`, and `pl`, are conjugated by the grammatical `personNumber` property in preceding nominative rules. The `pl` person-number form is also conjugated by the `grammaticalForm` value 'infinitive' in the (immediate) parent nonterminal rule.
 * • The tense form, `past`, is conjugated by the `grammaticalForm` property in the (immediate) parent nonterminal rule. Also, if the parent rule has `acceptedTense` defined as 'past', it accepts the `past` form when input, but does not conjugate to it otherwise (unlike `grammaticalForm`).
 *
 * The grammar generator and `pfsearch` use neither `presentSubjunctive`, `presentParticiple`, nor `pastParticiple` for conjugation. Rather, their parameterization serves only to enforce complete definitions of verbs for complete substitution sets. They are replaced when input by one of the first four forms in the set.
 *
 * Note: It is better to have a single terminal rule set with dynamic grammatical conjugation than to define separate rule sets with identical terminal symbols but different display text for the different non-nominative grammatical forms. The non-nominative forms (e.g., 'past', 'nom', 'obj') conjugate via the parent rule and therefore can determine inflection at compile time, unlike nominative conjugation which depends on the parse tree. The overhead `Parser` would endure for the additional reductions for the additional terminal rule matches is far greater than the `pfsearch` overhead for the conjugation.
 *
 * Note: Each verb form becomes a terminal symbol and can not contain whitespace.
 *
 * @typedef {Object} VerbFormsTermSet
 * @property {string} oneSg The first-person-singular verb form, chosen by the nonterminal rule property `personNumber`. E.g., "am", "was", "like".
 * @property {string} threeSg The third-person-singular verb form, chosen by the nonterminal rule property `personNumber`. E.g., "is", "was", "likes".
 * @property {string} pl The plural verb form, chosen by the nonterminal rule properties `personNumber` and `grammaticalForm`. E.g., "are", "were" "like".
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
 * The present tense inflections of a verb, which `verbTermSet.newTenseVerb()` constructs internally when creating the present tense verb terminal rule set (of term sequence type 'verb-present').
 *
 * Each rule created from the terms in this set has an object as its `text` with the properties `oneSg`, `threeSg`, and `pl`. When constructing parse trees, `pfsearch` conjugates this `text` object to the correct verb form (i.e., display text) according to the grammatical `personNumber` property in preceding nominative rules in the same tree. The `pl` person-number form is also conjugated by the `grammaticalForm` value 'infinitive' in the (immediate) parent nonterminal rule.
 *
 * The grammar generator and `pfsearch` use neither `presentSubjunctive` nor `presentParticiple` for conjugation. Rather, their parameterization serves only to enforce complete definitions of verbs for complete substitution sets. They are replaced when input by one of first three forms in the set.
 *
 * Inherits the present tense properties of `VerbFormsTermSet`.
 *
 * @typedef {Object} PresentVerbFormsTermSet
 * @property {string} oneSg The first-person-singular verb form, chosen by the nonterminal rule property `personNumber`. E.g., "am", "was", "like".
 * @property {string} threeSg The third-person-singular verb form, chosen by the nonterminal rule property `personNumber`. E.g., "is", "was", "likes".
 * @property {string} pl The plural verb form, chosen by the nonterminal rule properties `personNumber` and `grammaticalForm`. E.g., "are", "were" "like".
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
 * The past tense inflections of a verb, which `verbTermSet.newTenseVerb()` constructs internally when creating the past tense verb terminal rule set (of term sequence type 'verb-past').
 *
 * Each rule created from the terms in this set is an invariable term with the `past` form as its `text`. `pfsearch` can not conjugate these rules.
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
 * Each rule created from the terms in `options.verbFormsTermSet` has an object as its `text` with the properties `oneSg`, `threeSg`, `pl`, and `past` for the different verb forms. When constructing parse trees, `pfsearch` conjugates this `text` object to the correct verb form (i.e., display text) according to grammatical properties in the same tree:
 * • The person-number forms, `oneSg`, `threeSg`, and `pl`, are conjugated by the grammatical `personNumber`
 *   property in preceding nominative rules. The `pl` person-number form is also conjugated by the
 *   `grammaticalForm` value 'infinitive' in the (immediate) parent nonterminal rule.
 * • The tense form, `past`, is conjugated by the `grammaticalForm` property in the (immediate) parent
 *   nonterminal rule. Also, if the parent rule has `acceptedTense` defined as 'past', it accepts the `past`
 *   form when input, but does not conjugate to it otherwise (unlike `grammaticalForm`).
 *
 * Note: Each verb form in `options.verbFormsTermSet` becomes a terminal symbol and can not contain whitespace.
 *
 * The returned `NSymbol` has the following properties:
 * • name - `options.symbolName` if defined, else the concatenation of the prefix 'verb-' with the infinitive
 *   verb form, `options.verbFormsTermSet.pl`.
 * • isTermSequence - `true`. Enables nesting within term sequences and flattening in `flattenTermSequence`.
 * • isTermSet - `true`. Specifies every rule is a single-token terminal rule with the same `text` value.
 * • termSequenceType - 'verb'.
 * • defaultText - The conjugative `text` object for the verb forms.
 * • insertionCost - `options.insertionCost`, if defined.
 *
 * @memberOf verbSet
 * @param {Object} options The options object.
 * @param {string} [options.symbolName] The name for the new `NSymbol`. If `undefined`, concatenates the prefix 'verb-' with the infinitive verb form, `options.verbFormsTermSet.pl`.
 * @param {number} [options.insertionCost] The insertion cost for the terminal rule set, assigned to the first rule in the set (i.e., `verbFormsTermSet.oneSg`). Enables the creation of insertion rules using the new `NSymbol` that produces this set (i.e., the LHS symbol).
 * @param {boolean} [options.noPastDisplayText] Specify excluding the past tense verb form, `options.verbFormsTermSet.past`, from the display `text` object. Instead, substitute the `past` form when input with the verb's correct present tense form. Unlike the present tense set that `verbSet.newTenseVerb()` creates, this option creates terminal rules for the past tense verb forms as substitutions.
 * @param {VerbFormsTermSet} options.verbFormsTermSet The verb terminal symbol set with each verb form inflection.
 * @returns {NSymbol} Returns the new `NSymbol` for the verb terminal rule set.
 */
var verbSchema = {
	symbolName: String,
	insertionCost: Number,
	noPastDisplayText: Boolean,
	verbFormsTermSet: { type: Object, schema: verbFormsTermSetSchema, required: true },
}

exports.newVerb = function (options) {
	if (util.illFormedOpts(verbSchema, options)) {
		throw new Error('Ill-formed verb')
	}

	// Create a verb terminal rule set with every verb inflection in `options.verbFormsTermSet`, where each terminal rule has a conjugative `text` object with the verb forms `oneSg`, `threeSg`, `pl`, and `past`.
	return createVerbTerminalRuleSet({
		// If `options.symbolName` is `undefined`, generate the terminal rule set `NSymbol.prototype.name` using the infinitive verb form, `options.verbFormsTermSet.pl`.
		symbolName: options.symbolName || genVerbTermSetName(options.verbFormsTermSet),
		termSequenceType: g.termTypes.VERB,
		insertionCost: options.insertionCost,
		verbFormsTermSet: options.verbFormsTermSet,
		displayText: genVerbDisplayText(options.verbFormsTermSet, options.noPastDisplayText),
	})
}

/**
 * The object `verbTermSet.newTenseVerb()` returns, with two terminal rule sets from the verb forms in `options.verbFormsTermSet`, split by present and past grammatical tense, and a third nonterminal substitution term sequence that produces both without tense restrictions.
 *
 * The `verbTermSet.newTenseVerb()` method description delineates the properties of each these `NSymbol` instances.
 *
 * @typedef {Object} TenseVerbSet
 * @property {NSymbol} noTense The nonterminal term sequence of type 'verb' that produces `present` and `past`, with a substitution conjugative `text` object containing all verb forms in `options.verbFormsTermSet`
 * @property {NSymbol} present The terminal rule set of type 'verb-present' that produces the present tense verb forms: `oneSg`, `threeSg`, `pl`, `presentSubjunctive`, and `presentParticiple`.
 * @property {NSymbol} past The terminal rule set of type 'verb-past' that produces the past tense verb forms: `past`, `pastParticiple`.
 */

/**
 * Creates two terminal rule sets from the verb forms in `options.verbFormsTermSet`, split by present and past grammatical tense, and a third nonterminal substitution term sequence that produces both without tense restrictions. Returns the three `NSymbol` instances in an object of the form `TenseVerbSet`.
 *
 * Each of the two terminal rule sets produces only terminal symbols and display text for the specified tense.
 * 1. TenseVerbSet.present - Each rule in the set has a conjugative `text` object with the person-number forms. The person-number forms, `oneSg`, `threeSg`, and `pl`, are conjugated by the grammatical `personNumber` property in preceding nominative rules. The `pl` person-number form is also conjugated by the `grammaticalForm` value 'infinitive' in the (immediate) parent nonterminal rule.
 * 2. TenseVerbSet.past - Each rule in the set has an invariable `text` string with the simple past form, `options.verbFormsTermSet.past`. `pfsearch` can not conjugate these rules.
 *
 * TenseVerbSet.noTense - The term sequence that produces the two tense term sets, with a substitution conjugative `text` object on each nonterminal rule with all verb forms in `options.verbFormsTermSet`. Behaves identically to verb terminal rule sets that `verbTermSet.newVerb()` creates.
 *
 * The terminal rule sets for each grammatical tense are for use with `Category.prototype.addTenseVerbRuleSet()`, where tense is semantically meaningful and input in one tense should never be substituted by forms of the other tense. The term sequence parent set is for use in all other verb sets where tense does not influence semantics.
 *
 * Note: Each verb form in `options.verbFormsTermSet` becomes a terminal symbol and can not contain whitespace.
 *
 * Note: Using this separate method to create a terminal rule set for only a verb's forms of a specific tense is superior to extending `verbTermSet.newVerb()` with an `options.tense` definition (for either 'present' or 'past') because the former enforces complete definitions of verbs. If only one tense terminal rule set is needed, the grammar generator deletes the unused set just as it deletes all unused grammar components.
 *
 * The returned `NSymbol` instances have the following properties:
 * 1. `TenseVerbSet.noTense`
 *    • name - `options.symbolName` if defined, else the concatenation of the prefix 'verb-' with the
 *      infinitive verb form, `options.verbFormsTermSet.pl`
 *    • isTermSequence - `true`. Enables nesting within term sequences and flattening in `flattenTermSequence`.
 *    • termSequenceType - 'verb'.
 *    • defaultText - The conjugative `text` object for the verb forms for both tenses, identical to that which
 *      `verbTermSet.newVerb()` uses.
 * 2. `TenseVerbSet.present`
 *    • name - The concatenation of `TenseVerbSet.noTense.name` with the suffix '-present'.
 *    • isTermSequence - `true`. Enables nesting within term sequences and flattening in `flattenTermSequence`.
 *    • isTermSet - `true`. Specifies every rule is a single-token terminal rule with the same `text` value.
 *    • termSequenceType - 'verb-present'.
 *    • defaultText - The conjugative `text` object for the present tense verb forms.
 *    • insertionCost - `options.insertionCost`, if defined.
 * 3. `TenseVerbSet.past`
 *    • name - The concatenation of `TenseVerbSet.noTense.name` with the suffix '-past'.
 *    • isTermSequence - `true`. Enables nesting within term sequences and flattening in `flattenTermSequence`.
 *    • isTermSet - `true`. Specifies every rule is a single-token terminal rule with the same `text` value.
 *    • termSequenceType - 'verb-past'.
 *    • defaultText - The invariable `text` string for the past tense verb form form.
 *
 * @memberOf verbSet
 * @param {Object} options The options object.
 * @param {string} [options.symbolName] The name for the new `NSymbol`. If `undefined`, concatenates the prefix 'verb-' with the infinitive verb form, `options.verbFormsTermSet.pl`.
 * @param {number} [options.insertionCost] The insertion cost for the pair of terminal rule sets, assigned to the first rule in the present tense set (i.e., `verbFormsTermSet.oneSg`). Enables the creation of insertion rules using the new `NSymbol` that produces the present set (i.e., the LHS symbol).
 * @param {VerbFormsTermSet} options.verbFormsTermSet The verb terminal symbol set with each verb form inflection.
 * @returns {TenseVerbSet} Returns the object containing the separate present and past terminal rule sets and the parent substitution term sequence that combines the two.
 */
var tenseVerbSchema = {
	symbolName: String,
	insertionCost: Number,
	verbFormsTermSet: { type: Object, schema: verbFormsTermSetSchema, required: true },
}

exports.newTenseVerb = function (options) {
	if (util.illFormedOpts(tenseVerbSchema, options)) {
		throw new Error('Ill-formed tense verb')
	}

	var verbFormsTermSet = options.verbFormsTermSet

	// If `options.symbolName` is `undefined`, generate the terminal sequence `NSymbol.prototype.name` using the infinitive verb form, `verbFormsTermSet.pl`.
	if (!options.symbolName) {
		options.symbolName = genVerbTermSetName(verbFormsTermSet)
	}

	// Create a present tense verb terminal rule set with every present tense verb inflection in `options.verbFormsTermSet`, where each terminal rule has a conjugative `text` object with the verb forms `oneSg`, `threeSg`, and `pl`.
	var presentVerbSym = createVerbTerminalRuleSet({
		symbolName: g.hyphenate(options.symbolName, 'present'),
		termSequenceType: g.termTypes.VERB_PRESENT,
		insertionCost: options.insertionCost,
		verbFormsTermSet: {
			oneSg: verbFormsTermSet.oneSg,
			threeSg: verbFormsTermSet.threeSg,
			pl: verbFormsTermSet.pl,
			presentSubjunctive: verbFormsTermSet.presentSubjunctive,
			presentParticiple: verbFormsTermSet.presentParticiple,
		},
		displayText: {
			oneSg: verbFormsTermSet.oneSg,
			threeSg: verbFormsTermSet.threeSg,
			pl: verbFormsTermSet.pl,
		},
	})

	// Create a past tense verb terminal rule set with every past tense verb inflection in `options.verbFormsTermSet`, where each terminal rule has the invariable string `options.verbFormsTermSet.past` as its `text` value.
	// For now, restrict `options.insertionCost` to the present tense verb set.
	var pastVerbSym = createVerbTerminalRuleSet({
		symbolName: g.hyphenate(options.symbolName, 'past'),
		termSequenceType: g.termTypes.VERB_PAST,
		verbFormsTermSet: {
			past: verbFormsTermSet.past,
			pastParticiple: verbFormsTermSet.pastParticiple,
		},
		displayText: verbFormsTermSet.past,
	})

	// Create a term sequence that produces the two tense term sets, `presentVerbSym` and `pastVerbSym`, with substitution text on each nonterminal rule that contains all verb forms in `verbFormsTermSet`. Behaves identically to terminal rule sets that `verbTermSet.newVerb()` creates with `verbFormsTermSet`.
	var noTenseVerbSym = createNoTenseVerb(options.symbolName, verbFormsTermSet, presentVerbSym, pastVerbSym)

	// Return all symbols as a `TenseVerbSet`.
	return {
		noTense: noTenseVerbSym,
		present: presentVerbSym,
		past: pastVerbSym,
	}
}

/**
 * Creates a term sequence that produces the two tense term sets, `presentVerbSym` and `pastVerbSym`, with substitution text on each nonterminal rule that contains all verb forms in `verbFormsTermSet`. The returned `NSymbol` behaves identically to terminal rule sets that `verbTermSet.newVerb()` creates with `verbFormsTermSet`.
 *
 * For use by `verbTermSet.newTernseVerb()`, which created `presentVerbSym` and `pastVerbSym`.
 *
 * The returned `NSymbol` is for use when the verb defined in `verbFormsTermSet` is needed in both a tense verb rule set (where tense yield different semantics) and a non-tense verb rule set. It is more efficient to create a parent rule than to duplicate terminal symbols for a separate non-split terminal rule set.
 *
 * The returned `NSymbol` has the following properties:
 * • name - `options.symbolName`.
 * • isTermSequence - `true`. Enables nesting within term sequences and flattening in `flattenTermSequence`.
 * • termSequenceType - 'verb'.
 * • defaultText - The conjugative `text` object for the present and past verb forms.
 *
 * @private
 * @static
 * @param {string} symbolName The name for the new `NSymbol` that produces `presentVerbSym` and `pastVerbSym`.
 * @param {VerbFormsTermSet} verbFormsTermSet The verb terminal symbol set with each verb form inflection.
 * @param {NSymbol} presentVerbSym The present tense verb terminal rule set that only produces the present forms in `verbFormsTermSet`.
 * @param {NSymbol} pastVerbSym The past tense verb terminal rule set that only produces the past forms in `verbFormsTermSet`.
 * @returns {NSymbol} Returns the new `NSymbol` for the verb term sequence.
 */
function createNoTenseVerb(symbolName, verbFormsTermSet, presentVerbSym, pastVerbSym) {
	// The nonterminal substitution rule conjugative `text` object containing the inflections for every verb form. Identical to the `text` objects `verbTermSet.newVerb()` uses.
	var noTenseVerbDisplayText = genVerbDisplayText(verbFormsTermSet)

	return g.newSymbol(symbolName).addRule({
		rhs: [ presentVerbSym ],
		text: noTenseVerbDisplayText,
	}).addRule({
		// `pastVerbSym` is created with `tense` as 'past' on all terminal rules, whose values `noTenseVerbSym` can reach just as verb terminal rule sets that `verbTermSet.newVerb()` creates.
		rhs: [ pastVerbSym ],
		text: noTenseVerbDisplayText,
	})._toTermSequence({
		// Specify contains every verb form (of both tenses).
		type: g.termTypes.VERB,
		defaultText: noTenseVerbDisplayText,
	})
}

/**
 * Creates a verb terminal rule set of term sequence type `options.termSequenceType` that produces terminal rules for every verb form in `options.verbFormsTermSet`, with `options.displayText` as each rule's `text` value.
 *
 * If defined, assigns `options.insertionCost` to the first terminal rule in the set: `verbFormsTermSet.oneSg`, if defined, else `verbFormsTermSet.past` for past tense verb term sets (when `verbFormsTermSet` is of the form `PastVerbFormsTermSet`).
 *
 * If `options.termSequenceType` is 'verb' or 'verb-present', `options.displayText` must be a conjugative text object, else if `options.termSequenceType` is 'verb-past', `options.displayText` must be an invariable string.
 *
 * For use by `verbTermSet.newVerb()` and `verbTermSet.newTenseVerb()`.
 *
 * The returned `NSymbol` has the following properties:
 * • name - `options.symbolName`.
 * • isTermSequence - `true`. Enables nesting within term sequences and flattening in `flattenTermSequence`.
 * • isTermSet - `true`. Specifies every rule is a single-token terminal rule with the same `text` value.
 * • termSequenceType - `options.termSequenceType`.
 * • defaultText - `options.displayText`.
 * • insertionCost - `options.insertionCost`, if defined.
 *
 * @private
 * @static
 * @param {Object} options The options object.
 * @param {string} options.symbolName The name for the new `NSymbol` that produces the terminal rule set.
 * @param {string} options.termSequenceType The verb term sequence type of the terminal rule set: 'verb', 'verb-present', or 'verb-past'.
 * @param {number} [options.insertionCost] The insertion cost for the terminal rule set, assigned to the first rule in the set (i.e., `verbFormsTermSet.oneSg`, if defined, else `verbFormsTermSet.past`). Enables the creation of insertion rules using the new `NSymbol` that produces this set.
 * @param {VerbFormsTermSet|PresentVerbFormsTermSet|PastVerbFormsTermSet} options.verbFormsTermSet The verb terminal symbol set with each verb form inflection.
 * @param {Object|string} options.displayText The `text` value for every (terminal) rule in the set.
 * @returns {NSymbol} Returns the new `NSymbol` for the verb terminal rule set.
 */
var verbTerminalRuleSetSchema = {
	symbolName: { type: String, required: true },
	termSequenceType: { values: [ g.termTypes.VERB, g.termTypes.VERB_PRESENT, g.termTypes.VERB_PAST ], required: true },
	insertionCost: Number,
	verbFormsTermSet: { type: Object, required: true },
	displayText: { type: [ Object, String ], required: true }
}

function createVerbTerminalRuleSet(options) {
	if (util.illFormedOpts(verbTerminalRuleSetSchema, options, true) || isIllFormedTerminalRuleSetOptions(options)) {
		throw new Error('Ill-formed verb terminal rule set')
	}

	// Create the `NSymbol` that produces the verb terminal rule set.
	var verbSym = g.newSymbol(options.symbolName)

	// Extend `verbSym` with terminal rules for every terminal symbol in `options.verbFormsTermSet`, with `options.displayText` as each rule's `text` value, and `options.insertionCost` assigned to the first terminal rule in the set.
	addVerbTerminalRuleSet(verbSym, options.verbFormsTermSet, options.displayText, options.insertionCost)

	return verbSym._toTermSequence({
		isTermSet: true,
		/**
		 * Specify the `verbSym` term sequence type. For inclusion within a term sequence of matching type.
		 * • 'verb' - `verbSym` contains every verb form.
		 * • 'verb-present' - `verbSym` contains only the present tense verb forms.
		 * • 'verb-past' - `verbSym` contains only the past tense verb forms.
		 */
		type: options.termSequenceType,
		defaultText: options.displayText,
		insertionCost: options.insertionCost,
	})
}

/**
 * Checks if `options`, which was passed to `createVerbTerminalRuleSet()`, is ill-formed. if so, prints an error.
 *
 * @private
 * @static
 * @param {Object} options The `createVerbTerminalRuleSet()` options object to inspect.
 * @returns {boolean} Returns `true` if `options` is ill-formed, else `false`.
 */
function isIllFormedTerminalRuleSetOptions(options) {
	if (options.termSequenceType === g.termTypes.VERB) {
		if (util.illFormedOpts(verbFormsTermSetSchema, options.verbFormsTermSet)) {
			return true
		}

		if (options.displayText.constructor !== Object) {
			util.logErrorAndPath('`displayText` for terminal rule set of type', util.stylize(options.termSequenceType), 'is not a conjugative object:', util.stylize(options.displayText), options)
			return true
		}
	} else if (options.termSequenceType === g.termTypes.VERB_PRESENT) {
		if (util.illFormedOpts(presentVerbFormsTermSetSchema, options.verbFormsTermSet, true)) {
			return true
		}

		if (options.displayText.constructor !== Object) {
			util.logErrorAndPath('`displayText` for terminal rule set of type', util.stylize(options.termSequenceType), 'is not a conjugative object:', util.stylize(options.displayText), options)
			return true
		}
	} else if (options.termSequenceType === g.termTypes.VERB_PAST) {
		if (util.illFormedOpts(pastVerbFormsTermSetSchema, options.verbFormsTermSet, true)) {
			return true
		}

		if (options.displayText.constructor !== String) {
			util.logErrorAndPath('`displayText` for terminal rule set of type', util.stylize(options.termSequenceType), 'is not an invariable string:', util.stylize(options.displayText), options)
			return true
		}
	}

	return false
}

/**
 * Adds a verb terminal rule set to `verbSym` for every terminal symbol in `verbFormsTermSet`, with `displayText` as each rule's `text` value.
 *
 * For past tense verb forms in `verbFormsTermSet`, assigns 'past' as each associated rule's `tense` value.
 *
 * If provided, assigns `insertionCost` to the first terminal rule in the set: `verbFormsTermSet.oneSg`, if defined, else `verbFormsTermSet.past` for past tense verb term sets (when `verbFormsTermSet` is of the form `PastVerbFormsTermSet`).
 *
 * For use by `createVerbTerminalRuleSet()`.
 *
 * @private
 * @static
 * @param {NSymbol} verbSym The symbol to extend with the verb terminal rule set.
 * @param {VerbFormsTermSet|PresentVerbFormsTermSet|PastVerbFormsTermSet} verbFormsTermSet The verb terminal symbol set with each verb form inflection.
 * @param {Object|string} displayText The `text` value for every (terminal) rule in the set.
 * @param {number} [insertionCost] The insertion cost for the terminal rule set, assigned to the first rule in the set (i.e., `verbFormsTermSet.oneSg`). Enables the creation of insertion rules using `verbSym`.
 * @returns {NSymbol} Returns `verbSym` after adding the verb terminal rule set.
 */
function addVerbTerminalRuleSet(verbSym, verbFormsTermSet, displayText, insertionCost) {
	/**
	 * Note: Manually add every verb form in `VerbFormsTermSet`, instead of iterating through its defined values, for the following reasons:
	 * 1. Must define each verb form's grammatical tense, which is not defined elsewhere.
	 * 2. Must manually check the present tense person-number forms in `verbFormsTermSet` are distinct from each other to avoid `NSymbol` duplicate rule errors, because grammatically they can be identical. In contrast, must allow all other verb forms to pass through unchecked so that ``NSymbol.prototype.addRule()` can properly catch duplicity among them.
	 */

	/**
	 * The terminal rule for the first-person-singular verb form, chosen by the nonterminal rule property `personNumber`. E.g., "am", "was", "like".
	 *
	 * Assign `insertionCost`, if defined, to the first terminal rule in the set (when `verbFormsTermSet` is of the form `VerbFormsTermSet` or `PresentVerbFormsTermSet`).
	 */
	if (verbFormsTermSet.oneSg) {
		verbSym.addRule(createVerbTerminalRule(verbFormsTermSet.oneSg, displayText, 'present', insertionCost))

		// Delete `insertionCost` to prevent its assignment to the terminal rule for `verbFormsTermSet.past`, if defined.
		insertionCost = undefined
	}

	/**
	 * The terminal rule for the third-person-singular verb form, chosen by the nonterminal rule property `personNumber`. E.g., "is", "was", "likes".
	 *
	 * Check if distinguishable from the first-person-singular verb form to avoid duplicity errors, because grammatically the two verb forms can be identical. E.g., "was".
	 */
	if (verbFormsTermSet.threeSg && verbFormsTermSet.threeSg !== verbFormsTermSet.oneSg) {
		verbSym.addRule(createVerbTerminalRule(verbFormsTermSet.threeSg, displayText, 'present'))
	}

	/**
	 * The terminal rule for the the plural verb form, chosen by the nonterminal rule property `personNumber` and the `grammaticalForm` value 'infinitive'. E.g., "are", "were" "like".
	 *
	 * Check if distinguishable from the first-person-singular verb form to avoid duplicity errors, because grammatically the two verb forms can be identical. E.g., "like".
	 */
	if (verbFormsTermSet.pl && verbFormsTermSet.pl !== verbFormsTermSet.oneSg) {
		verbSym.addRule(createVerbTerminalRule(verbFormsTermSet.pl, displayText, 'present'))
	}

	/**
	 * The terminal rule for the simple past tense verb form (or, preterite), chosen by the parent nonterminal rule property `grammaticalForm` and accepted when input by matching `acceptedTense`. E.g., "was", "liked", "did", "had".
	 *
	 * Assign `insertionCost`, if defined, to the first terminal rule in the past tense verb set (when `verbFormsTermSet` is of the form `PastVerbFormsTermSet`).
	 */
	if (verbFormsTermSet.past) {
		verbSym.addRule(createVerbTerminalRule(verbFormsTermSet.past, displayText, 'past', insertionCost))
	}

	// The terminal rule for the present-subjunctive verb form, substituted when input with `displayText`. E.g., "be".
	if (verbFormsTermSet.presentSubjunctive) {
		verbSym.addRule(createVerbTerminalRule(verbFormsTermSet.presentSubjunctive, displayText, 'present'))
	}

	// The terminal rule for the present-participle verb form, substituted when input with `displayText`. E.g., "being", "liking".
	if (verbFormsTermSet.presentParticiple) {
		verbSym.addRule(createVerbTerminalRule(verbFormsTermSet.presentParticiple, displayText, 'present'))
	}

	// The terminal rule for the past-participle verb form, substituted when input with `displayText` (and substituted with `verbFormsTermSet.past` if the parent rule has matching `acceptedTense`). E.g., "been", "done".
	if (verbFormsTermSet.pastParticiple) {
		verbSym.addRule(createVerbTerminalRule(verbFormsTermSet.pastParticiple, displayText, 'past'))
	}

	return verbSym
}

/**
 * Creates a `NSymbol.prototype.addRule()` options object for `terminalSymbol` with `displayText` as its `text` value, `tense`, and `insertionCost` if defined.
 *
 * For use by `addVerbTerminalRuleSet()`.
 *
 * @private
 * @static
 * @param {string} terminalSymbol The terminal symbol to match in input.
 * @param {Object|string} displayText The terminal rule `text` value.
 * @param {string} tense The grammatical tense of `terminalSymbol`. Either 'present' or 'past'.
 * @param {number} [insertionCost] The terminal rule insertion cost. Enables creation of insertion rules using the `NSymbol` to which the returned rule is added.
 * @returns {Object} Returns the new terminal rule `NSymbol.prototype.addRule()` options object.
 */
function createVerbTerminalRule(terminalSymbol, displayText, tense, insertionCost) {
	// Check `terminalSymbol` lacks whitespace and forbidden characters.
	if (termSequenceUtil.isIllFormedTerminalSymbol(terminalSymbol)) {
		throw new Error('Ill-formed verb terminal symbol')
	}

	if (tense !== 'present' && tense !== 'past') {
		util.logError('Unrecognized verb rule grammatical tense:', util.stylize(tense))
		throw new Error('Ill-formed verb terminal rule')
	}

	var newVerbTerminalRule = {
		isTerminal: true,
		rhs: terminalSymbol,
		text: displayText,
	}

	/**
	 * If `tense` is 'past', define `tense` for use by the parent nonterminal rule property `acceptedTense`, which uses the verb form of the same tense when a terminal rule with identical `tense` is matched in input. Does not conjugate to that tense if not input unless the parent rule property `grammaticalForm` dictates as such.
	 *
	 * If `displayText` is a conjugative text object with present and past tense verb forms, this rule is a past-participle form, `terminalSymbol` is matched in input, and the parent rule's `acceptedTense` matches `tense`, then `pfsearch` substitutes the verb set's simple past form, `VerbFormsTermSet.past`.
	 *
	 * If the entire verb set is a substitution set, this property maintains input tense for rules with `acceptedTense`. For example:
	 *   "repos I work on" -> "repos I contribute to"
	 *   "repos I worked on" -> "repos I contributed to" (maintained optional input tense)
	 */
	if (tense === 'past') {
		newVerbTerminalRule.tense = tense
	}

	// Assign `insertionCost`, if provided.
	if (insertionCost !== undefined) {
		newVerbTerminalRule.insertionCost = insertionCost
	}

	return newVerbTerminalRule
}

/**
 * Creates a conjugative `text` object from the verb forms in `verbFormsTermSet` for rule sets of term sequence type 'verb'.
 *
 * For use by `verbTermSet.newVerb()` as the `text` values of every rule in a verb terminal rule set, and `verbTermSet.noTenseVerb()` as the nonterminal substitution `text` of the rules that produce a pair of present and past verb terminal rule sets (but behaves identically to sets that `verbTermSet.newVerb()` creates).
 *
 * The `text` object has the properties `oneSg`, `threeSg`, `pl`, and `past` for the different verb forms. When constructing parse trees, `pfsearch` conjugates this `text` object to the correct verb form (i.e., display text) according to grammatical properties in the same tree:
 * • The person-number forms, `oneSg`, `threeSg`, and `pl`, are conjugated by the grammatical `personNumber`
 *   property in preceding nominative rules. The `pl` person-number form is also conjugated by the
 *   `grammaticalForm` value 'infinitive' in the (immediate) parent nonterminal rule.
 * • The tense form, `past`, is conjugated by the `grammaticalForm` property in the (immediate) parent
 *   nonterminal rule. Also, if the parent rule has `acceptedTense` defined as 'past', it accepts the `past`
 *   form when input, but does not conjugate to it otherwise (unlike `grammaticalForm`).
 *
 * @private
 * @static
 * @param {VerbFormsTermSet} verbFormsTermSet The verb terminal symbol set with each verb form inflection.
 * @param {boolean} [noPastDisplayText] Specify excluding the past tense verb form, `verbFormsTermSet.past`, from the display `text` object. Instead, substitute the `past` form when input with the verb's correct present tense form.
 * @returns {Object} Returns the conjugative verb `text` object with the different verb forms.
 */
function genVerbDisplayText(verbFormsTermSet, noPastDisplayText) {
	// The conjugative `text` object containing the verb inflections that `pfsearch` uses in conjugation.
	var verbDisplayText = {
		oneSg: verbFormsTermSet.oneSg,
		threeSg: verbFormsTermSet.threeSg,
		pl: verbFormsTermSet.pl,
	}

	/**
	 * If `noPastDisplayText` is `true`, exclude the past tense form, `verbFormsTermSet.past`, from the display `text` object. Instead, substitute the `past` form when input with the verb's correct present tense form.
	 *
	 * For example, exclude "had", the past tense of the auxiliary verb "have", from display text because it yields the past perfect construction. Past perfect implies the event/action took place in the past and excludes the present. This implication may be undesirable if input when the DB behind the NLI lacks this specific information.
	 * • For example, "people I had followed" means people the user previously followed and no longer follows. If the DB lacks this information and can only return people the user currently follows, then correct the display text to "have" to accurately reflect the returned data.
	 *
	 * Note: `noPastDisplayText` is no longer required for `[have]` following a redesign of `gramProps` conjugation that requires nonterminal rules to specify to which RHS index the grammatical property applies.
	 */
	if (!noPastDisplayText) {
		verbDisplayText.past = verbFormsTermSet.past
	}

	return verbDisplayText
}

/**
 * Creates the `NSymbol.prototype.name` string for a verb term sequence. Concatenates the prefix 'verb-' with the infinitive verb form, `verbFormsTermSet.pl`.
 *
 * For use by `verbTermSet.newVerb(options)` and `verbTermSet.newTenseVerb(options)` when `options.symbolName` is `undefined`.
 *
 * @private
 * @static
 * @param {VerbFormsTermSet} verbFormsTermSet The verb terminal symbol set with each verb form inflection.
 * @returns {string} Returns the `NSymbol.prototype.name` string for the verb term sequence
 */
function genVerbTermSetName(verbFormsTermSet) {
	return g.hyphenate('verb', verbFormsTermSet.pl)
}