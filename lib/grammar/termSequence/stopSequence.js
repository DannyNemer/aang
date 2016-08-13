/**
 * Methods, which `grammar` inherits, that create `NSymbol` instances that produce stop sequences, which delete terminal symbols matched in input.
 */

var util = require('../../util/util')
var g = require('../grammar')
var NSymbol = require('../NSymbol')
var termSequence = require('./termSequence')
var termSequenceUtil = require('./termSequenceUtil')


// Instruct `util.getModuleCallerLocation()` to skip the `stopSequence` module when searching the call stack for instantiation file paths of `NSymbol` instances that `stopSequence` methods create. For use in error messages.
util.skipFileInLocationRetrieval()


/**
 * Creates an `NSymbol` that produces a stop sequence, which is a term sequence that yields no display text when matched in input.
 *
 * Each item in `options.stopTerms` must be one of the following:
 * 1. A terminal symbol.
 *   • I.e., an invariable term which `pfsearch` can not inflect when parsing.
 *   • Can not contain whitespace.
 * 2. A terminal rule set created by `verbTermSet.newVerb()`, `verbTermSet.newTenseVerb()`, `pronounTermSet.newPronoun()`, `nounTermSet.newCountNoun()`, or `nounTermSet.newMassNoun()`.
 * 3. A terminal rule sequence created by `termSequence.newTermSequence()` or `termSequence.newTermSequenceBinarySymbol()`.
 *
 * All terminal rules the new `NSymbol` produces lack `text`, such that `pfsearch` adds no display text when it visits their parse nodes.
 *
 * All nonterminal rules the new `NSymbol` produces have the following boolean properties:
 * • isTermSequence - Instructs `flattenTermSequence` to create a new, terminal `ruleProps` for the rule's node.
 * • isStopSequence - Instructs `flattenTermSequence` to omit a `text` value from the new `ruleProps`, so that `pfsearch` adds no display text when it visits the node. Also prevents `flattenTermSequence` from wastefully traversing the node's children because there is no need to retrieve input tense of any matched verb terminal rules.
 *
 * The returned `NSymbol` has the following properties:
 * • name - `options.symbolName`.
 * • isTermSequence - `true`. Enables nesting within term sequences and flattening in `flattenTermSequence`.
 * • termSequenceType - 'stop'.
 *
 * @memberOf stopSequence
 * @param {Object} options The options object.
 * @param {string} options.symbolName The name for the new `NSymbol`.
 * @param {(string|NSymbol)[]} options.stopTerms The terminal symbols, terminal rule sets, term sequences to remove when matched in input.
 * @returns {NSymbol} Returns the new `NSymbol` for the stop term sequence.
 */
var stopSequenceSchema = {
	symbolName: { type: String, required: true },
	stopTerms: { type: Array, arrayType: [ String, NSymbol ], required: true },
}

exports.newStopSequence = function (options) {
	if (util.illFormedOpts(stopSequenceSchema, options)) {
		throw new Error('Ill-formed stop sequence')
	}

	// Create the `NSymbol` that produces the stop sequence.
	var stopSeqSym = g.newSymbol(options.symbolName)

	options.stopTerms.forEach(function (term) {
		/**
		 * If `term` is a terminal symbol.
		 *
		 * An example:
		 *   `[stop-words]` -> "to", text: `undefined`
		 */
		if (term.constructor === String) {
			// Check `term` lacks whitespace and forbidden characters.
			if (termSequenceUtil.isIllFormedTerminalSymbol(term)) {
				throw new Error('Ill-formed terminal symbol')
			}

			stopSeqSym.addRule({
				isTerminal: true,
				// Omit `text` and mark `isStopTerm` such that the symbol yields no display text when matched in input.
				isStopTerm: true,
				rhs: term,
			})
		}

		/**
		 * If `term` is a term sequence or terminal rule set of any term sequence type.
		 *
		 * An example where `term` is the verb terminal rule set `[have]`:
		 *   `[stop-words]` -> `[have]`, text: `undefined`
		 */
		else if (term.isTermSequence) {
			stopSeqSym.addRule({
				// Instruct `flattenTermSequence` to omit display text (that `term` produces) when creating the terminal node from this rule's nonterminal node.
				isStopSequence: true,
				rhs: [ term ],
			})
		}

		else {
			util.logErrorAndPath('Stop term is neither a terminal symbol, terminal rule set, nor a term sequence:', term, options)
			throw new Error('Ill-formed stop sequence')
		}
	})

	// Extend `stopSeqSym` with term sequence properties. Enables nesting of `stopSeqSym` in other term sequences.
	// Omit `defaultText`, which is inapplicable to stop sequences.
	return stopSeqSym._toTermSequence({
		type: termSequence.termTypes.STOP,
	})

	return stopSeqSym
}