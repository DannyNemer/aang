/**
 * Methods, which `grammar` inherits, that create `NSymbol` instances that produce terminal rule sets for nouns.
 *
 * These methods create an `NSymbol` for complete noun form term sets, as opposed to adding rules to an existing `NSymbol`, and forbid adding rules to the returned `NSymbol` afterward to prevent external changes to the rule sets.
 */

var util = require('../../util/util')
var g = require('../grammar')


// Instruct `util.getModuleCallerLocation()` to skip the `nounTermSet` module when searching the call stack for instantiation file paths of `NSymbol` instances that `nounTermSet` methods create. For use in error messages.
util.skipFileInLocationRetrieval()

/**
 * The inflections of a noun, from which `nounTermSet.newNoun()` creates a noun terminal rule set.
 *
 * Each terminal rule in the set has the string `pl` as its `text`. The grammar generator and `pfsearch` do not use `sg` as display text. Rather, its parametrization serves only to enforce complete definition of nouns, and is replaced when input by `pl`.
 *
 * Note: Each of the noun forms becomes a terminal symbol and can not contain whitespace.
 *
 * @typedef {Object} NounTermSet
 * @property {string} sg The singular noun form, replaced when input with `pl`. E.g., "follower".
 * @property {string} pl The plural noun form. E.g., "followers".
 */
var nounTermSetSchema = {
	sg: { type: String, required: true },
	pl: { type: String, required: true },
}

/**
 * Creates an `NSymbol` that produces a terminal rule set for a noun.
 *
 * Each rule in the set, created from the terms in `options.termSet`, has the string `option.termSet.pl` as its `text`. The grammar generator and `pfsearch` do not use `options.termSet.sg` as display text. Rather, its parametrization serves only to enforce complete definition of nouns, and is replaced when input by `option.termSet.pl`.
 *
 * Note: Each noun form in `options.termSet` becomes a terminal symbol and can not contain whitespace.
 *
 * The returned `NSymbol` has the following properties:
 * • name - The concatenation of the prefix 'noun-' with the plural noun form, `options.termSet.pl`.
 * • isTermSequence - `true`. Enables nesting within term sequences and flattening in `flattenTermSequence`.
 * • isTermSet - `true`. Specifies every rule is a single-token terminal rule with the same `text` value.
 * • termSequenceType - 'noun'.
 * • defaultText - The invariable `text` string for the plural noun form, `options.termSet.pl`, used as display text for every (terminal) rule this `NSymbol` produces.
 * • insertionCost - `options.insertionCost`, if defined.
 *
 * @memberOf nounTermSet
 * @param {Object} options The options object.
 * @param {number} [options.insertionCost] The insertion cost for the terminal rule set, assigned to the first rule in the set (i.e., `options.termSet.pl`). Enables the creation of insertion rules using the new nonterminal symbol that produces this set.
 * @param {NounTermSet} options.termSet The noun terminal symbol set with each noun form.
 * @returns {NSymbol} Returns the new `NSymbol` for the noun terminal rule set.
 */
var nounSchema = {
	insertionCost: Number,
	termSet: { type: Object, schema: nounTermSetSchema, required: true },
}

exports.newNoun = function (options) {
	if (util.illFormedOpts(nounSchema, options)) {
		throw new Error('Ill-formed noun')
	}
}