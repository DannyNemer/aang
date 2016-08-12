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

	// Extend `stopSeqSym` with term sequence properties. Enables nesting of `stopSeqSym` in other term sequences.
	// Omit `defaultText`, which is inapplicable to stop sequences.
	return stopSeqSym._toTermSequence({
		type: termSequence.termTypes.STOP,
	})

	return stopSeqSym
}