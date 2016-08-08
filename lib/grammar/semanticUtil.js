/**
 * Utility methods, which `semantic` inherits, for manipulating string and object representations of semantic.
 */

var util = require('../util/util')
var _semantics = require('./semantic')._semantics


/**
 * Converts `semanticArray` to a lambda calculus string representation (e.g., `func(arg,arg)`).
 *
 * Used to check if completed parse trees are semantically identical. (Semantic arguments are sorted during construction.)
 *
 * @static
 * @memberOf semanticUtil
 * @param {Object[]} semanticArray The semantic to convert.
 * @returns {string} Returns the string representation of `semanticArray`.
 */
exports.toString = function (semanticArray) {
	var str = ''

	for (var s = 0, semanticArrayLen = semanticArray.length; s < semanticArrayLen; ++s) {
		var semanticNode = semanticArray[s]
		var semanticName = semanticNode.semantic.name

		if (semanticNode.children) {
			str += (s ? ',' : '') + semanticName + '(' + exports.toString(semanticNode.children) + ')'
		} else {
			str += (s ? ',' : '') + semanticName
		}
	}

	return str
}

/**
 * Coverts `semanticArray` to a string representation like `semantic.toString()`, but with syntax highlighting (for printing).
 *
 * @static
 * @memberOf semanticUtil
 * @param {Object[]} semanticArray The semantic to convert.
 * @returns {string} Returns the stylized string representation of `semanticArray`.
 */
exports.toStylizedString = function (semanticArray) {
	var semanticString = exports.toString(semanticArray)
	return semanticString.replace(/([\w-]+(?=\())|([\w-]+(?=[,\)]|$))/g, function (match, p1, p2) {
		return p1 ? util.colors.green(p1) : util.colors.yellow(p2)
	})
}

/**
 * Converts `semanticArray` to a simple `Object` representation (for printing).
 *
 * @static
 * @memberOf semanticUtil
 * @param {Object[]} semanticArray The semantic tree to convert.
 * @returns {Object} Returns the simplified Object representation of `semanticArray`.
 */
exports.toSimpleObject = function (semanticArray) {
	var array = []

	for (var s = 0, semanticArrayLen = semanticArray.length; s < semanticArrayLen; ++s) {
		var semanticNode = semanticArray[s]
		var semanticName = semanticNode.semantic.name

		if (semanticNode.children) {
			var obj = {}
			obj[semanticName] = exports.toSimpleObject(semanticNode.children)
			array.push(obj)
		} else {
			array.push(semanticName)
		}
	}

	return array
}

/**
 * Converts `semanticString` output by `semantic.toString()` to its original object array format.
 *
 * @static
 * @memberOf semanticUtil
 * @param {string} semanticString The semantic string to convert.
 * @returns {Object[]} Returns the semantic array.
 */
exports.stringToObject = function (semanticString) {
	var firstLeftParen = semanticString.indexOf('(')

	// Check if `semanticString` is a semantic argument.
	if (firstLeftParen === -1) {
		return [ {
			// Map string to semantic argument definition or create an object for semantics created from input (e.g., entities). This enables parameter checks in `printParseResults`.
			semantic: _semantics[semanticString] || {
				name: semanticString,
				isArg: true,
			},
		} ]
	}

	var semanticFuncName = semanticString.slice(0, firstLeftParen)
	var semanticNode = {
		// Map string to semantic function definition.
		semantic: _semantics[semanticFuncName],
		children: [],
	}

	if (!semanticNode.semantic) {
		util.logError('Unrecognized semantic function name:', util.stylize(semanticFuncName))
		throw new Error('Unrecognized semantic function name')
	}

	// Split semantic function's children and recursively parse each.
	var stackHeight = 0
	var semanticLen = semanticString.length

	for (var startIdx = firstLeftParen + 1, endIdx = startIdx; endIdx < semanticLen; ++endIdx) {
		var c = semanticString[endIdx]

		if (stackHeight === 0 && (c === ',' || c === ')') && endIdx - startIdx > 0) {
			Array.prototype.push.apply(semanticNode.children, exports.stringToObject(semanticString.slice(startIdx, endIdx)))
			startIdx = endIdx + 1
		} else if (c === '(') {
			++stackHeight
		} else if (c === ')') {
			--stackHeight
		}
	}

	return [ semanticNode ]
}

/**
 * Gets the name of the semantic in `semanticArray`.
 *
 * @static
 * @memberOf semanticUtil
 * @param {Object[]} semanticArray The semantic node array.
 * @returns {string} Returns the name of the semantic in `semanticArray`.
 */
exports.getName = function (semanticArray) {
	if (semanticArray.length !== 1) {
		util.logErrorAndPath('semantic.getName(): Provided semantic array does not contain only one node:', semanticArray)
		throw new Error('Ill-formed semantic')
	}

	var semanticNode = semanticArray[0]
	if (semanticNode.children && semanticNode.children.length > 0) {
		util.logErrorAndPath('semantic.getName(): Provided semantic node has children:', semanticArray)
		throw new Error('Ill-formed semantic')
	}

	return semanticNode.semantic.name
}

/**
 * Checks if the root semantic of `semanticArray` has the property `forbidsMultipleIntersection` defined as `true`.
 *
 * The semantic property `forbidsMultipleIntersection` specifies forbidding multiple instantces of its semantic function in the arguments of an `intersect()`, irrespective of this semantic's arguments.
 *
 * @static
 * @memberOf semanticUtil
 * @param {Object[]} semanticArray The semantic node array to inspect.
 * @returns {boolean} Returns `true` if the root of `semanticArray` has `forbidsMultipleIntersection`, else `false`.
 */
exports.forbidsMultipleIntersection = function (semanticArray) {
	if (semanticArray.length !== 1) {
		util.logErrorAndPath('semantic.forbidsMultipleIntersection(): Provided semantic array does not contain only one node:', semanticArray)
		throw new Error('Ill-formed semantic')
	}

	return !!semanticArray[0].semantic.forbidsMultipleIntersection
}