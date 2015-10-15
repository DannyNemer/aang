var util = require('../util/util')

/**
 * Functions used for names of new Symbols, entity categories, and semantics.
 */

/**
 * Concatenates variadic string arguments (including `Symbol.prototype.name`) with dashes. This is used for the `Symbol()` constructor and when defining `name` in the schemas for `semantic.new(schema)` and `entityCategory.new(schema)`.
 *
 * @static
 * @memberOf stringUtil
 * @param {...string} [strN] The strings to concatenate.
 * @returns {string} Returns the dash-separated string.
 * @example
 *
 * g.hyphenate('category', 'lhs') // -> 'category-lhs'
 * g.hyphenate(category.nameSg, 'rhs') // -> 'category-rhs'
 * g.hyphenate(possSymbol.name, 'head') // -> 'poss-head'
 */
exports.hyphenate = function () {
	var chunks = Array.prototype.slice.call(arguments)

	if (chunks.indexOf(undefined) !== -1) {
		util.logErrorAndPath('undefined string in name:', chunks)
		throw new Error('Ill-formed name')
	}

	// Concatenate string arguments with dashes
	return chunks.join('-')
}

/**
 * Converts the name of a new grammar element to lowercase, strips brackets from passed instances of `Symbol.prototype.name`, and checks for reserved characters.
 *
 * @static
 * @memberOf stringUtil
 * @param {string} string The name of the grammar element.
 * @returns {string} Returns the validated, lowercase version of `name`.
 */
exports.formatName = function (string) {
	if (exports.hasReservedCharacters(string)) {
		throw new Error('Grammar element name error')
	}

	// Remove brackets from instances of `Symbol.prototype.name`
	// Convert to lower case
	return string.replace(/[\[\]]/g, '').toLowerCase()
}

/**
 * Checks if a name of a grammar element contains reserved characters. If `true`, prints an error indicating the reserved character. The following characters are reserved:
 *   '[', ']' - Bounds of nonterminal symbols.
 *   '{', '}' - Bounds of terminal symbols for entity categories.
 *   '<', '>' - Bounds of special terminal symbols (e.g., integers).
 *   '(', ')' - Used in the string representation of semantic trees.
 *
 * @static
 * @memberOf stringUtil
 * @param {string} string The name of the grammar element to examine.
 * @returns {boolean} Returns `true` if `string` contains an reserved character, else `false`.
 */
exports.hasReservedCharacters = function (string) {
	var match = string.match(/[\(\){}<>]/)

	if (match) {
		util.logError('The character', util.stylize(match[0]), 'is forbidden:', util.stylize(string))
		return true
	}

	return false
}