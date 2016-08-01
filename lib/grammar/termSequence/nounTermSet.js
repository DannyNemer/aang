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
 * Note: Each of the noun forms becomes a terminal symbol, and can not contain whitespace.
 *
 * @typedef {Object} NounTermSet
 * @property {string} sg The singular noun form, replaced when input with `pl`. E.g., "follower".
 * @property {string} pl The plural noun form. E.g., "followers".
 */
var nounTermSetSchema = {
	sg: { type: String, required: true },
	pl: { type: String, required: true },
}

var nounSchema = {
	insertionCost: Number,
	termSet: { type: Object, schema: nounTermSetSchema, required: true },
}

exports.newNoun = function (options) {
	if (util.illFormedOpts(nounSchema, options)) {
		throw new Error('Ill-formed noun')
	}
}