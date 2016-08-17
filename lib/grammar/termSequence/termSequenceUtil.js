var util = require('../../util/util')


/**
 * Checks if `term` is a term sequence or terminal rule set with term sequence type, `type`.
 *
 * @static
 * @memberOf termSequenceUtil
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
 * @static
 * @memberOf termSequenceUtil
 * @param {string} terminalSymbol The terminal symbol to check.
 * @returns {boolean} Returns `true` if `terminalSymbol` contains any forbidden characters, else `false`.
 */
exports.isIllFormedTerminalSymbol = function (terminalSymbol) {
	// Check if `terminalSymbol` is an empty string.
	if (terminalSymbol === undefined || terminalSymbol === '') {
		util.logErrorAndPath('Terminal symbol is an empty string:', util.stylize(terminalSymbol))
		return true
	}

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

/**
 * Checks if `termSeqPair` is an ill-formed term sequence ordered pair. If so, prints an error.
 *
 * For use by `flattenNestedTermSequencePairs()` in `termSequence`.
 *
 * @static
 * @memberOf termSequenceUtil
 * @param {NSymbol[]} termSeqPair The term sequence ordered pair to inspect.
 * @returns {boolean} Returns `true` if `termSeqPair` is ill-formed, else `false`.
 */
exports.isIllFormedOrderedPair = function (termSeqPair) {
	if (termSeqPair.length !== 2) {
		util.logErrorAndPath('Term sequence array is not an ordered pair:', termSeqPair)
		return true
	}

	if (termSeqPair.indexOf(undefined) !== -1) {
		util.logErrorAndPath('Term sequence ordered pair contains `undefined`:', termSeqPair)
		return true
	}

	return false
}