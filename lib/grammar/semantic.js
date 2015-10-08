var util = require('../util/util')
var stringUtil = require('./stringUtil')


// A map of the grammar's semantic names to the semantics.
exports.semantics = {}
// A map of semantic names to creation lines; used for error reporting.
exports.creationLines = {}

/**
 * Adds a new semantic function or argument to the grammar.
 *
 * @static
 * @memberOf semantic
 * @param {Object} options The options object.
 * @returns {Array} Returns the new semantic.
 */
exports.new = function (opts) {
	opts.name = stringUtil.formatName(opts.name)

	if (exports.semantics.hasOwnProperty(opts.name)) {
		util.logErrorAndPath('Duplicate semantic:', opts.name)
		throw new Error('Duplicate semantic')
	}

	var semantic = opts.isArg ? newSemanticArg(opts) : newSemanticFunc(opts)

	// Save instantiation file path and line number for error reporting.
	exports.creationLines[opts.name] = util.getModuleCallerPathAndLineNumber()

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
var semanticFuncOptsSchema = {
	// The unique name.
	name: String,
	// The parsing cost.
	cost: Number,
	// The minimum number of arguments this semantic function can accept.
	minParams: Number,
	// The maximum number of arguments this semantic function can accept.
	maxParams: Number,
	// Specifies only one instance of this semantic function is permitted in another semantic's RHS>
	// When a database object can only have one value for a specific property (e.g., repos only created by 1 person) forbid multiple instances of the corresponding semantic function within another semantic's arguments (irrespective of children). Otherwise, an intersection of objects with different values for this property will return an empty set.
	forbidMultiple: { type: Boolean, optional: true },
}

function newSemanticFunc(opts) {
	if (util.illFormedOpts(semanticFuncOptsSchema, opts)) {
		throw new Error('Ill-formed semantic function')
	}

	if (opts.minParams > opts.maxParams) {
		util.logErrorAndPath('Semantic minParams > maxParams:', opts)
		throw new Error('Ill-formed semantic function')
	}

	var semantic = exports.semantics[opts.name] = {
		name: opts.name,
		cost: opts.cost,
		minParams: opts.minParams,
		maxParams: opts.maxParams,
		forbidsMultiple: opts.forbidMultiple,
	}

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
var semanticArgOptsSchema = {
	// Specifies this semantic is a semantic argument.
	isArg: Boolean,
	// The unique name.
	name: String,
	// The parsing cost.
	cost: Number,
}

function newSemanticArg(opts) {
	if (util.illFormedOpts(semanticArgOptsSchema, opts)) {
		throw new Error('Ill-formed semantic argument')
	}

	var semantic = exports.semantics[opts.name] = {
		isArg: true,
		name: opts.name,
		cost: opts.cost,
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
 * Merges two semantic arrays into a single array. Checks that there will be no duplicates, no `forbidsMultiple` rules are violated, and there are no contradictory negations.
 *
 * @static
 * @memberOf semantic
 * @param {Object[]} a The semantic array to merge.
 * @param {Object[]} b The other semantic array to merge.
 * @returns {Object[]|number} Returns the merged semantic arrays if the union does not contain duplicates, else `-1`.
 */
exports.mergeRHS = function (a, b) {
	// Check for duplicates.
	var bLen = b.length

	for (var i = 0, aLen = a.length; i < aLen; ++i) {
		var semanticNodeA = a[i]
		var semanticA = semanticNodeA.semantic
		var semanticAForbidsMultiple = semanticA.forbidsMultiple
		var semanticAIsNegation = semanticA.name === 'not'

		for (var j = 0; j < bLen; ++j) {
			var semanticNodeB = b[j]
			var semanticB = semanticNodeB.semantic

			// Prevent multiple instances of this function within a function's arguments (e.g., 'users-gender()'').
			if (semanticAForbidsMultiple && semanticA === semanticB) {
				return -1
			}

			// Prevent contradiction with 'not()' function.
			if (semanticAIsNegation && semanticsEqual(semanticNodeA.children[0], semanticNodeB)) {
				return -1
			}

			// Prevent contradiction with 'not()' function.
			if (semanticB.name === 'not' && semanticsEqual(semanticNodeA, semanticNodeB.children[0])) {
				return -1
			}

			if (semanticsEqual(semanticNodeA, semanticNodeB)) {
				return -1
			}
		}
	}

	// Do sort because will be sorted when added to a LHS.
	// `concat()` is faster here than `slice()` + `push.apply()`.
	return a.concat(b)
}

/**
 * Determines if a new LHS semantic function (yet to be reduced) exists in the previous RHS semantics (already reduced) and multiple instances of that semantic function (irrespective of children) are forbidden. Hence, it allows its parse tree to be rejected without having to complete the new LHS semantic and later rejecting the tree for this reason in `semantic.mergeRHS()`
 *
 * @static
 * @memberOf semantic
 * @param {Object[]} rhs The most recent set of reduced semantics in a tree that have yet to be reduced into their parent semantic.
 * @param {Object[]} newLHS The new semantic, yet to be reduced, which will eventually be concatenated with `rhs` and share the same parent semantic.
 * @returns {boolean} Returns `true` if `rhs` contains an instance of `newLHS`'s semantic function of which multiple instances are forbidden, else `false`.
 */
exports.isForbiddenMultiple = function (rhs, newLHS) {
	// `newLHS` can only ever have one semantic (which has yet to be reduced)
	var lhsSemantic = newLHS[0].semantic

	if (lhsSemantic.forbidsMultiple) {
		for (var s = 0, rhsLen = rhs.length; s < rhsLen; ++s) {
			// Prevent multiple instances of this function within a function's args (e.g., 'users-gender()'')
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
 * @private
 * @static
 * @param {Object} a The semantic to compare.
 * @param {Object} b The other semantic to compare.
 * @returns {boolean} Returns `true` if the semantics are equivalent, else `false`.
 */
function semanticsEqual(a, b) {
	if (a === b) return true

	if (a.semantic !== b.semantic) return false

	if (a.children && b.children) {
		return exports.arraysEqual(a.children, b.children)
	}

	// `a` and `b` are semantic arguments of the same name
	return true
}

/**
 * Performs a deep comparison between two arrays of semantics to determine if they are equivalent. Each array is a RHS semantic.
 *
 * @static
 * @memberOf semantic
 * @param {Object} a The semantic array to compare.
 * @param {Object} b The other semantic array to compare.
 * @returns {boolean} Returns `true` if the semantic arrays are equivalent, else `false`.
 */
exports.arraysEqual = function (a, b) {
	// Same entity arrays
	if (a === b) return true

	// One of two is undefined (different semantics)
	if (!a || !b) return false

	var aLen = a.length
	if (aLen !== b.length) return false

	for (var i = 0; i < aLen; ++i) {
		if (semanticsEqual(a[i], b[i])) return true
	}

	return false
}


/**
 * Applies a completed semantic rule (`lhs` -> `rhs`) to a more recent semantic tree (`rhs`), joining them together as one semantic tree with `lhs` as the new root function.
 *
 * @static
 * @memberOf semantic
 * @param {Object[]} lhs The LHS semantic.
 * @param {Object[]} rhs The array of RHS semantic arguments.
 * @returns {Object[]} Returns the reduced semantic.
 */
exports.reduce = function (lhs, rhs) {
	lhs = lhs[0]
	var lhsSemantic = lhs.semantic

	if (lhs.children.length) {
		// Insert 'rhs' at innermost semantic function and then rebuild the trees as unwrapping (duplicating if necessary).
		// - EX: not(repos-liked()) -> not(repos-liked(1), repos-liked(2)) -> not(repos-liked(1)), not(repos-liked(2))
		rhs = exports.reduce(lhs.children, rhs)
	}

	var rhsLen = rhs.length

	// Ignore `lhs` if it is `intersect()` and `rhs` is just one argument.
	if (rhsLen === 1 && lhsSemantic.name === 'intersect') {
		return rhs
	}

	if (rhsLen < lhsSemantic.minParams) {
		throw new Error('semantic.reduce: rhs.length < minParams')
		return -1
	}

	if (rhsLen > lhsSemantic.maxParams) {
		if (lhsSemantic.maxParams > 1) {
			throw new Error('semantic.reduce: rhsLen > lhs.maxParams && lhs.maxParams > 1')
		}

		if (lhsSemantic.forbidsMultiple) {
			throw new Error('semantic.reduce: rhsLen > lhs.maxParams && lhs.forbidsMultiple')
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

	// Use an `Array` to enable use in `semantic.mergeRHS()`.
	return [ {
		semantic: lhsSemantic,
		children: rhs.sort(compareSemantics),
	} ]
}


/**
 * Recursively compares semantic trees for sorting. Sorts arguments before functions, sorts functions and arguments separately alphabetically, and recursively sorts identical functions by their arguments. This function is used as the compare function for `Array.prototype.sort()`.
 *
 * @private
 * @static
 * @param {Object} a The semantic tree to compare.
 * @param {Object} b The other semantic tree to compare.
 * @returns {number} Returns -1 to sort `a` before `b`, 1 to sort `a` after `b`, or 0 to leave `a` and `b` unchanged with respect to each other.
 */
function compareSemantics(a, b) {
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
			returnVal = compareSemantics(aChildren[i], bChildren[i], a, b)
			if (returnVal) break
		}

		return returnVal
	}

	// Semantic argument, numeric id, or input-number
	return a === b ? 0 : (a.semantic.name < b.semantic.name ? -1 : 1)
}

/**
 * Determines if a semantic tree has been completely reduced. I.e., it does not expect to accept semantic arguments; rather is can be passed to another semantic function (as a RHS semantic). This is the state after every function in the tree has been output by `semantic.reduce()`. This function is used in grammar generation to mark a rule's semantic as RHS or not (properties which are using in parsing).
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