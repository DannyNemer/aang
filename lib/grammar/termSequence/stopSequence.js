/**
 * Methods, which `grammar` inherits, that create `NSymbol` instances that produce stop sequences, which are term sequences that yield no display text when matched in input.
 */

var util = require('../../util/util')
var g = require('../grammar')
var NSymbol = require('../NSymbol')
var termSequence = require('./termSequence')
var termSequenceUtil = require('./termSequenceUtil')


// Instruct `util.getModuleCallerLocation()` to skip the `stopSequence` module when searching the call stack for instantiation file paths of `NSymbol` instances that `stopSequence` methods create. For use in error messages.
util.skipFileInLocationRetrieval()

/**
 * The stop term wrapper parameterization, for use in `stopSequenceSchema.stopTerms` with `stopSequence.newStopSequence()`, to specify properties specific to the wrapped `term`.
 *
 * @typedef {Object} StopTermWrapper
 * @property {string|NSymbol|NSymbol[]} term The terminal symbol, terminal rule set, term sequence, or term sequence pair to remove when matched in input.
 * @property {number} [costPenalty] The cost penalty added to the rule's base cost.
 */
var stopTermWrapperSchema = {
	term: { type: [ String, NSymbol, Array ], required: true },
	costPenalty: { type: Number },
}

/**
 * Creates an `NSymbol` that produces a stop sequence, which is a term sequence that yields no display text when matched in input.
 *
 * Each item in `options.stopTerms` must be one of the following:
 * 1. A terminal symbol.
 *    • I.e., an invariable term which `pfsearch` can not inflect when parsing.
 *    • Can not contain whitespace.
 * 2. A terminal rule set created by `verbTermSet.newVerb()`, `verbTermSet.newTenseVerb()`,
 *   `pronounTermSet.newPronoun()`, `nounTermSet.newCountNoun()`, or `nounTermSet.newMassNoun()`.
 * 3. A terminal rule sequence created by `termSequence.newTermSequence()` or
 *   `termSequence.newTermSequenceBinarySymbol()`.
 * 4. An ordered pair containing any combination of #2, #3, or nested ordered pairs from which to recursively
 *    create new term sequences of type 'stop'.
 *    • There are no term sequence type restrictions for the base term sequence pair or any nested pairs
 *      because these rules produce no display text and therefore need no structure
 *
 * In addition, items in `options.stopTerms` may also be the following:
 * 5. `StopTermWrapper` - A term with a cost penalty, parametrized as follows:
 *    • {string|NSymbol|} StopTermWrapper.term - Any of #1-4 above.
 *    • {number} [StopTermWrapper.costPenalty] - The cost penalty added to the rule's base cost.
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
 * @param {(string|NSymbol|StopTermWrapper)[]} options.stopTerms The terminal symbols, terminal rule sets, term sequences, and term sequence pairs (with a cost penalty if `StopTermWrapper`) to remove when matched in input.
 * @returns {NSymbol} Returns the new `NSymbol` for the stop term sequence.
 */
var stopSequenceSchema = {
	symbolName: { type: String, required: true },
	stopTerms: { type: Array, arrayType: [ String, NSymbol, Array, Object ], required: true },
}

exports.newStopSequence = function (options) {
	if (util.illFormedOpts(stopSequenceSchema, options)) {
		throw new Error('Ill-formed stop sequence')
	}

	// Create the `NSymbol` that produces the stop sequence.
	var stopSeqSym = g.newSymbol(options.symbolName)

	options.stopTerms.forEach(function (term) {
		// The stop sequence cost penalty incurred when `term` is matched in input (and removed).
		var costPenalty = 0
		if (term.constructor === Object) {
			if (util.illFormedOpts(stopTermWrapperSchema, term)) {
				throw new Error('Ill-formed stop sequence')
			}

			costPenalty = term.costPenalty || 0
			term = term.term
		}

		/**
		 * If `term` is a terminal symbol.
		 *
		 * An example:
		 *   `[stop-word]` -> "to", text: `undefined`
		 */
		if (term.constructor === String) {
			// Check `term` lacks whitespace and forbidden characters.
			if (termSequenceUtil.isIllFormedTerminalSymbol(term)) {
				throw new Error('Ill-formed terminal symbol')
			}

			stopSeqSym.addRule({
				isTerminal: true,
				rhs: term,
				// Omit `text` and mark `isStopTerm` such that the symbol yields no display text when matched in input.
				isStopTerm: true,
				costPenalty: costPenalty,
			})
		}

		/**
		 * If `term` is a term sequence or terminal rule set of any term sequence type.
		 *
		 * An example where `term` is the verb terminal rule set `[verb-have]`:
		 *   `[stop-word]` -> `[verb-have]`, text: `undefined`
		 */
		else if (term.isTermSequence) {
			stopSeqSym.addRule({
				rhs: [ term ],
				// Instruct `flattenTermSequence` to create a new, terminal `ruleProps` for the rule's node that lacks `text` and prevents `pfsearch` from traversing that node's children (and accessing the children's `text`).
				isStopSequence: true,
				costPenalty: costPenalty,
			})
		}

		/**
		 * If `term` is an ordered pair containing any combination of term sequences, terminal rule sets, or nested ordered pairs from which to recursively create new term sequences of type 'stop'.
		 *
		 * An example of two terminal rule sets:
		 *   `[stop-word]` -> `[verb-have]` `[verb-got]`, text: `undefined`
		 *
		 * An example of a term sequence and a nested ordered pair of term sequences from which to recursively create a new term sequence:
		 *   `[stop-word]` -> `[from]` [ `[last]` `[period]` ] -> `[from]` `[last-period]`, text: `undefined`
		 */
		else if (term.constructor === Array) {
			stopSeqSym.addRule({
				// Recursively flatten any nested ordered pairs to `NSymbol` instances that produce the term sequence. All new, nested pairs become term sequences of type 'stop' and are marked `isStopSequence`.
				rhs: flattenNestedStopSequencePairs(term),
				// Instruct `flattenTermSequence` to create a new, terminal `ruleProps` for the rule's node that lacks `text` and prevents `pfsearch` from traversing that node's children (and accessing the children's `text`).
				isStopSequence: true,
				costPenalty: costPenalty,
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

/**
 * Checks `termSeqPair` is a valid stop sequence pair and recursively flattens any nested ordered pairs to `NSymbol` instances that produce the nested term sequence of type 'stop'. If `termSeqPair` is invalid, throws an exception.
 *
 * Each item in `termSeqPair` must be one of the following:
 * 1. A terminal rule set created by `verbTermSet.newVerb()`, `verbTermSet.newTenseVerb()`, `pronounTermSet.newPronoun()`, `nounTermSet.newCountNoun()`, or `nounTermSet.newMassNoun()`.
 * 2. A terminal rule sequence created by `termSequence.newTermSequence()` or `termSequence.newTermSequenceBinarySymbol()`.
 * 3. An ordered pair containing any combination of #1, #2, or nested ordered pairs from which to recursively create new term sequences of type 'stop'.
 *
 * There are no term sequence type restrictions for the base pair or any nested pairs because these rules produce no display text and therefore need no structure. All nested pairs become new term sequences of type 'stop'.
 * • The nested pairs need not also be stop sequences to prevent display text, because only the sequence's root node must have `isStopSequence` for `flattenTermSequence`.
 * • The nested pair still must be 'stop' sequences, however, because there must be no type restrictions. In contrast, `termSequence.newTermSequence()` create term sequence binary symbols for its nested pairs, for which all but one term in the sequence must be of type 'invariable'.
 * • This type agnosticism is a potential drawback because marking these nested rules with `isStopSequence`, when they could be valid sequences of a different type that behave identically for the base rule, prevents their use in other places not as stop sequences. In such a case, manually create these nested sequences.
 *
 * Returns the flattened ordered pair of `NSymbol` instances for use as a term sequence binary rule's `rhs`.
 *
 * @private
 * @static
 * @param {(NSymbol|NSymbol[])[]} termSeqPair The term sequence ordered pair to validate and flatten.
 * @returns {NSymbol[]} Returns `termSeqPair` with any nested term sequences pairs flattened.
 */
function flattenNestedStopSequencePairs(termSeqPair) {
	// Check `termSeqPair` is an ordered pair, does not contains `undefined`.
	if (termSequenceUtil.isIllFormedOrderedPair(termSeqPair)) {
		throw new Error('Ill-formed stop sequence pair')
	}

	for (var t = 0, termSeqLen = termSeqPair.length; t < termSeqLen; ++t) {
		var termSym = termSeqPair[t]
		if (termSym.constructor === Array) {
			// Recursively create an `NSymbol` that produces a single binary rule, marked `isStopSequence`, for the term sequence of this nested ordered pair.
			termSeqPair[t] = g.newBinaryRule({
				// The recursive invocation will check `termSym` is a valid ordered pair.
				rhs: flattenNestedStopSequencePairs(termSym),
				// Instruct `flattenTermSequence` to omit display text, which this rule's node's children produces, when creating the terminal node from this rule's nonterminal node.
				isStopSequence: true,
			})._toTermSequence({
				type: termSequence.termTypes.STOP,
			})
		} else if (!termSym.isTermSequence) {
			util.logErrorAndPath('Term is terminal rule set, term sequence, nor a nested term sequence pair:', util.stylize(termSym))
			throw new Error('Ill-formed term sequence')
		}
	}

	// After flattening, check `termSeqPair` contains only term sequences.
	if (!termSeqPair.every(term => term.isTermSequence)) {
		util.logErrorAndPath('Non-term sequence provided in term sequence pair:', termSeqPair)
		throw new Error('Ill-formed stop sequence pair')
	}

	return termSeqPair
}