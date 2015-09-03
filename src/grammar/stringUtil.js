var util = require('../util')

/**
 * Functions used for names of new Symbols, entity categories, and semantics.
 */

/**
 * Concatenates variadic string arguments (including `Symbol.name`) with dashes. This is used for the `Symbol()` constructor and when defining `name` in the schemas for `semantic.new(schema)` and `entityCategory.new(schema)`.
 *
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
 * Converts the name of a new grammar element to lowercase, strips brackets from passed instances of `Symbol.name`, and checks for illegal characters.
 *
 * @param {string} string The name of the grammar element.
 * @returns {string} Returns the validated, lowercase version of `name`.
 */
exports.formatName = function (string) {
	if (exports.hasIllegalCharacters(string)) {
		throw new Error('Grammar element name error')
	}

	// Remove brackets from instances of `Symbol.name`
	// Convert to lower case
	return string.replace(/[\[\]]/g, '').toLowerCase()
}

/**
 * Determines if a name of a grammar element contains illegal characters. If `true`, prints an error indicating the illegal character. The following characters are illegal:
 *   '[', ']' - Bounds of nonterminal symbols.
 *   '{', '}' - Bounds of terminal symbols for entity categories.
 *   '<', '>' - Bounds of special terminal symbols (e.g., integers).
 *   '(', ')' - Used in the string representation of semantic trees.
 *
 * @param {string} string The name of the grammar element to examine.
 * @returns {boolean} Returns `true` if `string` contains an illegal character, else `false`.
 */
exports.hasIllegalCharacters = function (string) {
	var match = string.match(/[\(\){}<>]/)

	if (match) {
		util.logError('The character \'' + match[0] + '\' is forbidden in names:', string)
		return true
	}

	return false
}