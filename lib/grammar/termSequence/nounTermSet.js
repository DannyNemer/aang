/**
 * Methods, which `grammar` inherits, that create `NSymbol` instances that produce terminal rule sets for nouns.
 *
 * These methods create an `NSymbol` for complete noun form term sets, as opposed to adding rules to an existing `NSymbol`, and forbid adding rules to the returned `NSymbol` afterward to prevent external changes to the rule sets.
 */

var util = require('../../util/util')
var g = require('../grammar')
var termSequence = require('./termSequence')
var termSequenceUtil = require('./termSequenceUtil')


// Instruct `util.getModuleCallerLocation()` to skip the `nounTermSet` module when searching the call stack for instantiation file paths of `NSymbol` instances that `nounTermSet` methods create. For use in error messages.
util.skipFileInLocationRetrieval()

/**
 * The inflections of a noun, from which `nounTermSet.newNoun()` creates a noun terminal rule set.
 *
 * Each terminal rule in the set has the string `pl` as its `text`. The grammar generator and `pfsearch` do not use `sg` as display text. Rather, its parametrization serves only to enforce complete definition of nouns, and is replaced when input by `pl`.
 *
 * Note: Each of the noun forms becomes a terminal symbol and can not contain whitespace.
 *
 * @typedef {Object} NounFormsSet
 * @property {string} sg The singular noun form, replaced when input with `pl`. E.g., "follower".
 * @property {string} pl The plural noun form. E.g., "followers".
 */
var nounFormsSetSchema = {
	sg: { type: String, required: true },
	pl: { type: String, required: true },
}

/**
 * Creates an `NSymbol` that produces a terminal rule set for a noun.
 *
 * Each rule in the set, created from the terms in `options.nounFormsSet`, has the string `options.nounFormsSet.pl` as its `text`. The grammar generator and `pfsearch` do not use `options.nounFormsSet.sg` as display text. Rather, its parametrization serves only to enforce complete definition of nouns, and is replaced when input by `options.nounFormsSet.pl`.
 *
 * Note: Each noun form in `options.nounFormsSet` becomes a terminal symbol and can not contain whitespace.
 *
 * The returned `NSymbol` has the following properties:
 * • name - The concatenation of the prefix 'noun-' with the plural noun form, `options.nounFormsSet.pl`.
 * • isTermSequence - `true`. Enables nesting within term sequences and flattening in `flattenTermSequence`.
 * • isTermSet - `true`. Specifies every rule is a single-token terminal rule with the same `text` value.
 * • termSequenceType - 'noun'.
 * • defaultText - The invariable `text` string for the plural noun form, `options.nounFormsSet.pl`, used as display text for every (terminal) rule this `NSymbol` produces.
 * • insertionCost - `options.insertionCost`, if defined.
 *
 * @memberOf nounTermSet
 * @param {Object} options The options object.
 * @param {number} [options.insertionCost] The insertion cost for the terminal rule set, assigned to the first rule in the set (i.e., `options.nounFormsSet.pl`). Enables the creation of insertion rules using the new nonterminal symbol that produces this set.
 * @param {NounFormsSet} options.nounFormsSet The noun terminal symbol set with each noun form.
 * @returns {NSymbol} Returns the new `NSymbol` for the noun terminal rule set.
 */
var nounSchema = {
	insertionCost: Number,
	nounFormsSet: { type: Object, schema: nounFormsSetSchema, required: true },
}

exports.newNoun = function (options) {
	if (util.illFormedOpts(nounSchema, options)) {
		throw new Error('Ill-formed noun')
	}

	// Create the `NSymbol` that produces the noun terminal rule set.
	var nounFormsSet = options.nounFormsSet
	var nounSym = g.newSymbol(g.hyphenate('noun', nounFormsSet.pl))

	// The terminal rule invariable `text` string for each terminal symbol in `nounTermSet`.
	var nounDisplayText = nounFormsSet.pl

	/**
	 * The terminal rule for the plural noun form. E.g., "followers".
	 *
	 * Define before the singular noun form terminal rule because only the plural form is used as display text, and therefore its greater likelihood warrants a lower cost.
	 *
	 * Assign `options.insertionCost`, if defined, to the first terminal rule in the set.
	 */
	nounSym.addRule(createNounTerminalRule(nounFormsSet.pl, nounDisplayText, options.insertionCost))

	// The terminal rule for the singular noun form. E.g., "follower".
	nounSym.addRule(createNounTerminalRule(nounFormsSet.sg, nounDisplayText))

	// Extend `nounSym` with term sequence properties. Enables nesting of `nounSym` in other term sequences with matching term sequence type, and prevents addition of further rules to `nounSym`.
	return nounSym._toTermSequence({
		isTermSet: true,
		type: termSequence.termTypes.NOUN,
		defaultText: nounDisplayText,
		insertionCost: options.insertionCost,
	})
}

/**
 * Creates an `NSymbol` that produces a terminal rule set for a mass (uncountable) noun.
 *
 * Mass nouns, or uncountable nouns, do not represent distinct objects, and therefore do not have separate singular and plural forms like count nouns. I.e., it has the syntactic property that any quantity of it is treated as an undifferentiated unit, rather than as something with discrete subsets. E.g., "funding".
 *
 * The one rule in the set, created from `options.nounTerm`, has its terminal symbol as its string `text` value.
 *
 * Note: `options.nounTerm` becomes a terminal symbol and can not contain whitespace.
 *
 * The returned `NSymbol` has the following properties:
 * • name - The concatenation of the prefix 'noun-' with the noun term, `options.nounTerm`.
 * • isTermSequence - `true`. Enables nesting within term sequences and flattening in `flattenTermSequence`.
 * • isTermSet - `true`. Specifies every rule is a single-token terminal rule with the same `text` value.
 * • termSequenceType - 'noun'.
 * • defaultText - The invariable `text` string for noun term, `options.nounTerm`, used as display text for the
 *   single (terminal) rule this `NSymbol` produces.
 * • insertionCost - `options.insertionCost`, if defined.
 *
 * @memberOf nounTermSet
 * @param {Object} options The options object.
 * @param {number} [options.insertionCost] The insertion cost for the terminal rule set, assigned to the first rule in the set (i.e., `options.nounTerm`). Enables the creation of insertion rules using the new nonterminal symbol that produces this set.
 * @param {string} options.nounTerm The noun terminal symbol.
 * @returns {NSymbol} Returns the new `NSymbol` for the noun terminal rule set.
 */
var massNounSchema = {
	insertionCost: Number,
	nounTerm: { type: String, required: true },
}

exports.newMassNoun = function (options) {
	if (util.illFormedOpts(massNounSchema, options)) {
		throw new Error('Ill-formed mass noun')
	}

	// Create the `NSymbol` that produces the mass noun terminal rule set.
	var nounTerm = options.nounTerm
	var nounSym = g.newSymbol(g.hyphenate('noun', nounTerm))

	// The terminal rule for the noun; e.g., "funding".
	// Assign `options.insertionCost`, if defined.
	nounSym.addRule(createNounTerminalRule(nounTerm, nounTerm, options.insertionCost))

	// Extend `nounSym` with term sequence properties. Enables nesting of `nounSym` in other term sequences with matching term sequence type, and prevents addition of further rules to `nounSym`.
	return nounSym._toTermSequence({
		isTermSet: true,
		type: termSequence.termTypes.NOUN,
		defaultText: nounTerm,
		insertionCost: options.insertionCost,
	})
}

/**
 * Creates an `NSymbol.prototype.addRule()` options object for `terminalSymbol` with `displayText` as its `text` value and `insertionCost` if defined.
 *
 * For use by `nounTermSet.newNoun()` and `nounTermSet.newMassNoun()`.
 *
 * @private
 * @static
 * @param {string} terminalSymbol The terminal symbol to match in input.
 * @param {string} displayText The terminal rule invariable `text` string.
 * @param {number} [insertionCost] The terminal rule insertion cost. Enables creation of insertion rules using the `NSymbol` to which the returned rule is added.
 * @returns {Object} Returns the new terminal rule `NSymbol.prototype.addRule()` options object.
 */
function createNounTerminalRule(terminalSymbol, displayText, insertionCost) {
	// Check `terminalSymbol` lacks whitespace and forbidden characters.
	if (termSequenceUtil.isIllFormedTerminalSymbol(terminalSymbol)) {
		throw new Error('Ill-formed noun terminal symbol')
	}

	var newNounTerminalRule = {
		isTerminal: true,
		rhs: terminalSymbol,
		text: displayText,
	}

	// Assign `insertionCost`, if provided.
	if (insertionCost !== undefined) {
		newNounTerminalRule.insertionCost = insertionCost
	}

	return newNounTerminalRule
}