var util = require('../util/util')
var stringUtil = require('./stringUtil')


// A map of the grammar's semantic names to the semantics.
exports.semantics = {}
// A map of semantic names to creation lines; used for error reporting.
exports.creationLines = {}

// The `intersect()` semantic used by `semantic.reduce()`.
var intersectSemantic
if (require.main.filename !== require.resolve('./buildGrammar')) {
	// If not currently building the grammar, then load the `intersect()` semantic from the grammar file, which works for comparisons because of `initSemantics`.
	intersectSemantic = require('../grammar.json').semantics.intersect
}

/**
 * Adds a new semantic function or argument to the grammar.
 *
 * @static
 * @memberOf semantic
 * @param {Object} options The options object.
 * @returns {Array} Returns the new semantic.
 */
exports.new = function (options) {
	options.name = stringUtil.formatName(options.name)

	if (exports.semantics.hasOwnProperty(options.name)) {
		util.logErrorAndPath('Duplicate semantic name:', options.name)
		throw new Error('Duplicate semantic name')
	}

	var semantic = options.isArg ? newSemanticArg(options) : newSemanticFunc(options)

	// Save instantiation file path and line number for error reporting.
	exports.creationLines[options.name] = util.getModuleCallerPathAndLineNumber()

	if (options.name === 'intersect') {
		// Save `insertect()` semantic for use by `semantic.reduce()`.
		intersectSemantic = semantic
	}

	return semantic
}

/**
 * Adds a new semantic function to the grammar.
 *
 * @private
 * @static
 * @param {Object} options The options object.
 * @returns {Array} Returns the new semantic function.
 */
var semanticFuncSchema = {
	// The unique name.
	name: String,
	// The parsing cost.
	cost: Number,
	// The minimum number of arguments this semantic function can accept.
	minParams: Number,
	// The maximum number of arguments this semantic function can accept.
	maxParams: Number,
	// Specify permitting only one instance of this semantic function in another semantic's RHS.
	// When a database object can only have one value for a specific property (e.g., "repos only created by 1 person") forbid multiple instances of the corresponding semantic function within another semantic's arguments (irrespective of children). Otherwise, an intersection of objects with different values for this property will return an empty set.
	forbidsMultiple: { type: Boolean, optional: true },
}

function newSemanticFunc(options) {
	if (util.illFormedOpts(semanticFuncSchema, options)) {
		throw new Error('Ill-formed semantic function')
	}

	if (options.minParams > options.maxParams) {
		util.logErrorAndPath('Semantic minParams > maxParams:', options)
		throw new Error('Ill-formed semantic function')
	}

	var semantic = exports.semantics[options.name] = {
		name: options.name,
		cost: options.cost,
		minParams: options.minParams,
		maxParams: options.maxParams,
		forbidsMultiple: options.forbidsMultiple,
	}

	// An `Array` is necessary for `semantic.arraysEqual()`, generating a non-reduced semantic tree for a rule (i.e., behaving as a non-reduced RHS semantic), and general consistency.
	return [ {
		semantic: semantic,
		children: [],
	} ]
}

/**
 * Adds a new semantic argument to the grammar.
 *
 * @private
 * @static
 * @param {Object} options The options object.
 * @returns {Array} Returns the new semantic argument.
 */
var semanticArgSchema = {
	// Specify this is a semantic argument.
	isArg: Boolean,
	// The unique name.
	name: String,
	// The parsing cost.
	cost: Number,
}

function newSemanticArg(options) {
	if (util.illFormedOpts(semanticArgSchema, options)) {
		throw new Error('Ill-formed semantic argument')
	}

	var semantic = exports.semantics[options.name] = {
		isArg: true,
		name: options.name,
		cost: options.cost,
	}

	return [ {
		semantic: semantic,
	} ]
}

/**
 * Calculates the sum of the costs of all semantic functions in a semantic tree.
 *
 * @static
 * @memberOf semantic
 * @param {Object[]} semanticArray The semantic tree to sum.
 * @returns {number} Returns the sum of the costs in the semantic tree.
 */
exports.sumCosts = function (semanticArray) {
	return semanticArray.reduce(function (accum, cur) {
		return accum + cur.semantic.cost + (cur.children ? exports.sumCosts(cur.children) : 0)
	}, 0)
}

/**
 * Merges two reduced (RHS) semantic arrays into a single array, if the merge is semantically legal. Else, returns `-1`.
 *
 * Note: It is faster to return `-1` and check the return value up the stack than to throw an exception to catch up the stack.
 *
 * @static
 * @memberOf semantic
 * @param {Object[]} a The semantic array to merge.
 * @param {Object[]} b The other semantic array to merge.
 * @returns {Object[]|number} Returns the new, merged semantic if semantically legal, else `-1`.
 */
exports.mergeRHS = function (a, b) {
	// Check if semantic merge is legal.
	if (exports.isIllegalRHS(a, b)) return -1

	// Do sort because will be sorted when added to a LHS.
	// `concat()` is faster here than `slice()` + `push.apply()`.
	return a.concat(b)
}

/**
 * Checks if reduced (RHS) semantic arrays `a` and `b` are forbidden to merge as a single set of RHS semantic arguments. This is `true` for the following cases:
 * - There are duplicate semantics.
 * - A semantic's `forbidsMultiple` rule is violated.
 * - There are contradictory negations.
 *
 * @static
 * @memberOf semantic
 * @param {Object[]} a The semantic array to compare.
 * @param {Object[]} b The other semantic array to compare.
 * @returns {boolean} Returns `true` if the semantics are forbidden to merge, else `false`.
 */
exports.isIllegalRHS = function (a, b) {
	var bLen = b.length

	for (var i = 0, aLen = a.length; i < aLen; ++i) {
		var semanticNodeA = a[i]
		var semanticA = semanticNodeA.semantic
		var semanticAForbidsMultiple = semanticA.forbidsMultiple
		var semanticAIsNegation = semanticA.name === 'not'

		for (var j = 0; j < bLen; ++j) {
			var semanticNodeB = b[j]
			var semanticB = semanticNodeB.semantic

			// Prevent multiple instances of this function within a function's arguments (e.g., 'users-gender()').
			if (semanticAForbidsMultiple && semanticA === semanticB) {
				return true
			}

			// Prevent contradiction with 'not()' function.
			if (semanticAIsNegation && exports.nodesEqual(semanticNodeA.children[0], semanticNodeB)) {
				return true
			}

			// Prevent contradiction with 'not()' function.
			if (semanticB.name === 'not' && exports.nodesEqual(semanticNodeA, semanticNodeB.children[0])) {
				return true
			}

			// Prevent duplicate semantic nodes using a deep comparison.
			if (exports.nodesEqual(semanticNodeA, semanticNodeB)) {
				return true
			}
		}
	}

	return false
}

/**
 * Checks if a new LHS semantic function (yet to be reduced) exists in the previous RHS semantics (already reduced) and multiple instances of that semantic function (irrespective of children) are forbidden. Hence, it allows its parse tree to be rejected without having to complete the new LHS semantic and later rejecting the tree for this reason in `semantic.mergeRHS()`
 *
 * @static
 * @memberOf semantic
 * @param {Object[]} rhs The most recent set of reduced semantics in a tree that have yet to be reduced into their parent semantic.
 * @param {Object[]} newLHS The new semantic, yet to be reduced, which will eventually be concatenated with `rhs` and share the same parent semantic.
 * @returns {boolean} Returns `true` if `rhs` contains an instance of `newLHS`'s semantic function of which multiple instances are forbidden, else `false`.
 */
exports.isForbiddenMultiple = function (rhs, newLHS) {
	// `newLHS` can only ever have one semantic (which has yet to be reduced).
	var lhsSemantic = newLHS[0].semantic

	if (lhsSemantic.forbidsMultiple) {
		for (var s = 0, rhsLen = rhs.length; s < rhsLen; ++s) {
			// Prevent multiple instances of this function within a function's args (e.g., 'users-gender()'').
			if (rhs[s].semantic === lhsSemantic) {
				return true
			}
		}
	}

	return false
}

/**
 * Performs a deep comparison between two semantics to determine if they are equivalent.
 *
 * Requires invoking `initSemantics` on the semantics beforehand, which enables comparing semantics by reference instead of checking their `name` properties. In addition, `initSemantics` accelerates semantic comparisons by replacing identical semantics in the grammar with references to a single object.
 *
 * @static
 * @param {Object} a The semantic to compare.
 * @param {Object} b The other semantic to compare.
 * @returns {boolean} Returns `true` if the semantics are equivalent, else `false`.
 */
 exports.nodesEqual = function (a, b) {
 	// Identical semantics or both `undefined`.
	if (a === b) return true

	// One of two is `undefined`.
	if (!a || !b) return false

	if (a.semantic !== b.semantic) return false

	if (a.children && b.children) {
		// Both are semantic functions.
		return exports.arraysEqual(a.children, b.children)
	} else if (a.children || b.children) {
		// One is a semantic function and other is a semantic argument.
		return false
	}

	// This is never reached.
	return true
}

/**
 * Performs a deep comparison between two arrays of semantics to determine if they are equivalent. Each semantic in the arrays is a reduced (i.e., RHS) semantic.
 *
 * Requires invoking `initSemantics` on the semantics beforehand, which enables comparing semantics by reference instead of checking their `name` properties. In addition, `initSemantics` accelerates semantic comparisons by replacing identical semantics in the grammar with references to a single object.
 *
 * @static
 * @memberOf semantic
 * @param {Object} a The semantic array to compare.
 * @param {Object} b The other semantic array to compare.
 * @returns {boolean} Returns `true` if the semantic arrays are equivalent, else `false`.
 */
exports.arraysEqual = function (a, b) {
	// Identical semantic arrays or both `undefined`.
	if (a === b) return true

	// One of two is `undefined`.
	if (!a || !b) return false

	var aLen = a.length
	if (aLen !== b.length) return false

	for (var i = 0; i < aLen; ++i) {
		if (!exports.nodesEqual(a[i], b[i])) return false
	}

	// Semantic arrays are identical.
	return true
}

/**
 * Applies a completed semantic rule (`lhs` -> `rhs`) to a more recent semantic tree (`rhs`), joining them together as one semantic tree with `lhs` as the new root function.
 *
 * @static
 * @memberOf semantic
 * @param {Object[]} lhs The LHS semantic.
 * @param {Object[]} rhs The array of RHS semantic arguments.
 * @returns {Object[]|number} Returns the new, reduced semantic if semantically legal, else `-1`.
 */
exports.reduce = function (lhs, rhs) {
	lhs = lhs[0]
	var lhsSemantic = lhs.semantic

	if (lhs.children.length > 0) {
		// Insert `rhs` at innermost semantic function and then rebuild the trees as unwrapping (duplicating if necessary).
		// - Ex: not(repos-liked()) -> not(repos-liked(1), repos-liked(2)) -> not(repos-liked(1)), not(repos-liked(2))
		rhs = exports.reduce(lhs.children, rhs)
		if (rhs === -1) return -1
	}

	var rhsLen = rhs.length

	// Ignore `lhs` if it is `intersect()` and `rhs` is just one argument.
	if (lhsSemantic === intersectSemantic && rhsLen === 1) {
		return rhs
	}

	if (rhsLen < lhsSemantic.minParams) {
		throw new Error('semantic.reduce: rhs.length < minParams')
	}

	if (rhsLen > lhsSemantic.maxParams) {
		if (lhsSemantic.maxParams > 1) {
			util.logError('Semantic reduction: rhsLen > lhs.maxParams && lhs.maxParams > 1:')
			util.dir(lhs, rhs)
			throw new Error('Semantic error')
		}

		if (lhsSemantic.forbidsMultiple) {
			// Ex: "repos of [poss-user-plural]"
			return -1
		}

		// Copy the LHS semantic for each RHS semantic.
		// - "repos liked by me and my followers" -> copy "repos-liked()" for each child.
		var newLHS = []

		for (var s = 0; s < rhsLen; ++s) {
			newLHS[s] = {
				semantic: lhsSemantic,
				children: [ rhs[s] ],
			}
		}

		return newLHS
	}

	// An array is necessary because it becomes another semantic's `children`.
	return [ {
		semantic: lhsSemantic,
		children: rhs.sort(exports.compare),
	} ]
}

/**
 * Recursively compares semantic trees for sorting. Sorts arguments before functions, sorts functions and arguments separately alphabetically, and recursively sorts identical functions by their arguments. This function is used as the compare function for `Array.prototype.sort()`.
 *
 * @static
 * @param {Object} a The semantic tree to compare.
 * @param {Object} b The other semantic tree to compare.
 * @returns {number} Returns -1 to sort `a` before `b`, 1 to sort `a` after `b`, or 0 to leave `a` and `b` unchanged with respect to each other.
 */
exports.compare = function (a, b) {
	var aIsObject = a.children !== undefined
	var bIsObject = b.children !== undefined

	// arg, func()
	if (!aIsObject && bIsObject) {
		return -1
	}

	// func(), arg
	if (aIsObject && !bIsObject) {
		return 1
	}

	// func(), func()
	if (aIsObject && bIsObject) {
		var aName = a.semantic.name
		var bName = b.semantic.name

		if (aName < bName) return -1
		if (aName > bName) return 1

		// Same semantic function (by name)
		// Compare semantic children
		var aChildren = a.children
		var bChildren = b.children
		var returnVal = 0

		for (var i = 0, minLength = Math.min(aChildren.length, bChildren.length); i < minLength; ++i) {
			returnVal = exports.compare(aChildren[i], bChildren[i], a, b)
			if (returnVal) break
		}

		return returnVal
	}

	// Semantic argument, numeric id, or input-number
	return a === b ? 0 : (a.semantic.name < b.semantic.name ? -1 : 1)
}

/**
 * Checks if a semantic tree has been completely reduced. I.e., it does not expect to accept semantic arguments; rather is can be passed to another semantic function (as a RHS semantic). This is the state after every function in the tree has been output by `semantic.reduce()`. This function is used in grammar generation to mark a rule's semantic as RHS or not (properties which are using in parsing).
 *
 * @static
 * @memberOf semantic
 * @param {Object[]} semanticArray The semantic tree to inspect.
 * @returns {boolean} Returns `true` if the `semanticArray` is completely reduced, else `false.
 */
exports.isRHS = function (semanticArray) {
	return semanticArray.every(function (semanticNode) {
		var semanticChildren = semanticNode.children
		if (semanticChildren) {
			return semanticChildren.length === 0 ? false : exports.isRHS(semanticChildren)
		}

		return true
	})
}

/**
 * Converts a semantic tree to a string representation. This is used to quickly compare if completed parse trees are semantically identical. (Semantic trees have their arguments sorted during construction.)
 *
 * @static
 * @memberOf semantic
 * @param {Object[]} semanticArray The semantic tree to convert.
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
 * Stylizes a semantic string output by `semantic.toString()` with syntax highlighting for printing.
 *
 * @static
 * @memberOf semantic
 * @param {string} semanticString The semantic string, output by `semantic.toString()`.
 * @returns {string} Returns the stylized semantic string.
 */
exports.colorString = function (semanticString) {
	return semanticString.replace(/([\w-]+(?=\())|([\w-]+(?=[,\)]|$))/g, function (match, p1, p2) {
		return p1 ? util.colors.green(p1) : util.colors.yellow(p2)
	})
}

/**
 * Converts a semantic tree to a simple Object representation for printing.
 *
 * @static
 * @memberOf semantic
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