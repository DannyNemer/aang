/**
 * Methods, which `grammar` inherits, that create `NSymbol` instances that produce terminal rule sets for pronouns.
 *
 * These methods create an `NSymbol` for complete pronoun form term sets, as opposed to adding rules to an existing `NSymbol`, and forbid adding rules to the returned `NSymbol` afterward to prevent external changes to the rule sets.
 */

var util = require('../../util/util')
var g = require('../grammar')
var NSymbol = require('../NSymbol')
var termSequence = require('./termSequence')
var termSequenceUtil = require('./termSequenceUtil')


// Instruct `util.getModuleCallerLocation()` to skip the `pronounTermSet` module when searching the call stack for instantiation file paths of `NSymbol` instances that `pronounTermSet` methods create. For use in error messages.
util.skipFileInLocationRetrieval()

/**
 * The inflections of a pronoun, from which `pronounTermSet.newPronoun()` creates a pronoun terminal rule set.
 *
 * Each terminal rule in the set has an object as its `text` with the properties `nom` and `obj` for the different personal pronoun case forms. When constructing parse trees, `pfsearch` conjugates the `text` object to the grammatical case (i.e., display text) according to the `grammaticalForm` property on the (immediate) parent rule.
 *
 * Note: Each of the pronoun forms becomes a terminal symbol, and can not contain whitespace.
 *
 * @typedef {Object} PronounFormsTermSetSchema
 * @property {string} nom The nominative case form, used as the subject of a verb, chosen by the parent nonterminal rule property `grammaticalForm`. E.g., "I", "we".
 * @property {string} obj The objective case form, used as the object of a verb, chosen by the parent nonterminal rule property `grammaticalForm`. E.g., "me", "us".
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
 * • isTermSet - `true`. Specifies every rule is a single-token terminal rule with the same `text` value.
 * • termSequenceType - 'pronoun'.
 * • defaultText - The conjugative `text` object for the pronoun forms. Identical for every (terminal) rule this `NSymbol` produces. For use when nesting this `NSymbol` in a term sequence.
 * • insertionCost - `options.insertionCost`, if defined.
 *
 * @memberOf pronounTermSet
 * @param {Object} options The options object.
 * @param {string} options.symbolName The name for the new `NSymbol`.
 * @param {number} [options.insertionCost] The insertion cost for the terminal rule set, assigned to the first rule in the set (i.e., `pronounFormsTermSet.nom`). Enables the creation of insertion rules using the new `NSymbol` that produces this set (i.e., the LHS symbol).
 * @param {PronounFormsTermSetSchema} options.pronounFormsTermSet The pronoun terminal symbol set with each pronoun form inflection.
 * @returns {NSymbol} Returns the new `NSymbol` for the pronoun terminal rule set.
 */
var pronounSchema = {
	symbolName: { type: String, required: true },
	insertionCost: Number,
	pronounFormsTermSet: { type: Object, schema: pronounFormsTermSetSchema, required: true },
}

exports.newPronoun = function (options) {
	if (util.illFormedOpts(pronounSchema, options)) {
		throw new Error('Ill-formed pronoun')
	}

	// Create the `NSymbol` that produces the pronoun terminal rule set.
	var pronounSym = g.newSymbol(options.symbolName)
	var pronounFormsTermSet = options.pronounFormsTermSet

	// The terminal rule conjugative `text` object containing the pronoun inflections for use in conjugation for each terminal symbol in `pronounFormsTermSet`.
	var pronounDisplayText = {
		nom: pronounFormsTermSet.nom,
		obj: pronounFormsTermSet.obj,
	}

	/**
	 * The terminal rule for the nominative case form, used as the subject of a verb, chosen by the parent nonterminal rule property `grammaticalForm`. E.g., "I", "we".
	 *
	 * Assign `options.insertionCost`, if defined, to the first terminal rule in the set.
	 */
	pronounSym.addRule(createPronounTerminalRule(pronounFormsTermSet.nom, pronounDisplayText, options.insertionCost))

	// The terminal rule for the objective case form, used as the object of a verb, chosen by the parent nonterminal rule property `grammaticalForm`. E.g., "me", "us",
	pronounSym.addRule(createPronounTerminalRule(pronounFormsTermSet.obj, pronounDisplayText))

	// Extend `pronounSym` with term sequence properties. Enables nesting of `pronounSym` in other term sequences with matching term sequence type, and prevents addition of further rules to `pronounSym`.
	return pronounSym._toTermSequence({
		isTermSet: true,
		type: termSequence.termTypes.PRONOUN,
		defaultText: pronounDisplayText,
		insertionCost: options.insertionCost,
	})
}

/**
 * Creates an `NSymbol.prototype.addRule()` options object for `terminalSymbol` with `displayText` as its `text` value and `insertionCost` if defined.
 *
 * For use by `pronounTermSet.newPronoun()`.
 *
 * @private
 * @static
 * @param {string} terminalSymbol The terminal symbol to match in input.
 * @param {Object} displayText The terminal rule conjugative `text` object.
 * @param {number} [insertionCost] The terminal rule insertion cost. Enables creation of insertion rules using the `NSymbol` to which the returned rule is added.
 * @returns {Object} Returns the new terminal rule `NSymbol.prototype.addRule()` options object.
 */
function createPronounTerminalRule(terminalSymbol, displayText, insertionCost) {
	// Check `terminalSymbol` lacks whitespace and forbidden characters.
	if (termSequenceUtil.isIllFormedTerminalSymbol(terminalSymbol)) {
		throw new Error('Ill-formed verb terminal symbol')
	}

	var newPronounTerminalRule = {
		isTerminal: true,
		rhs: terminalSymbol,
		text: displayText,
	}

	// Assign `insertionCost`, if provided.
	if (insertionCost !== undefined) {
		newPronounTerminalRule.insertionCost = insertionCost
	}

	return newPronounTerminalRule
}