var util = require('../util')


exports.semantics = {}
// A mapping of semantic names to creation lines; used for error reporting
exports.creationLines = {}

// Create a new semantic function or argument
exports.new = function (opts) {
	opts.name = opts.name.toLowerCase()

	if (exports.semantics.hasOwnProperty(opts.name)) {
		util.logErrorAndLine('Duplicate Semantic:', opts.name)
		throw 'duplicate Semantic'
	}

	return opts.isArg ? newSemanticArg(opts) : newSemanticFunc(opts)
}

// Schema for semantic functions
var semanticFuncOptsSchema = {
	// Unique name for this semantic function
	name: String,
	cost: Number,
	// Minimum number of arguments this semantic function can accept
	minParams: Number,
	// Maximum number of arguments this semantic function can accept
	maxParams: Number,
	// When a database object can only have one value for a specific property (e.g., repos only created by 1 person) forbid multiple instances of the corresponding semantic function within another semantic's arguments (irrespective of children). Otherwise, an intersection of objects with different values for this property will return an empty set.
	forbidMultiple: { type: Boolean, optional: true },
}

// Create a new semantic function from passed opts
function newSemanticFunc(opts) {
	if (util.illFormedOpts(semanticFuncOptsSchema, opts)) {
		throw 'ill-formed Semantic function'
	}

	if (opts.minParams > opts.maxParams) {
		util.logErrorAndLine('Semantic minParams > maxParams:', opts)
		throw 'ill-formed Semantic function'
	}

	var semantic = exports.semantics[opts.name] = {
		name: opts.name,
		cost: opts.cost,
		minParams: opts.minParams,
		maxParams: opts.maxParams,
		forbidsMultiple: opts.forbidMultiple,
	}

	// Save calling line for error reporting
	exports.creationLines[opts.name] = util.getLine()

	return [ {
		semantic: semantic,
		children: [],
	} ]
}


// Schema for semantic arguments
var semanticArgOptsSchema = {
	isArg: Boolean,
	name: String,
	cost: Number,
}

// Create a new semantic argument from passed opts
function newSemanticArg(opts) {
	if (util.illFormedOpts(semanticArgOptsSchema, opts)) {
		throw 'ill-formed Semantic argument'
	}

	var semantic = exports.semantics[opts.name] = {
		isArg: true,
		name: opts.name,
		cost: opts.cost,
	}

	// Save calling line for error reporting
	exports.creationLines[opts.name] = util.getLine()

	return [ {
		semantic: semantic,
	} ]
}

/**
 * Calculates the sum cost of all semantic functions in a semantic tree.
 *
 * @param {Array} semanticArray The semantic tree to sum.
 * @return {Number} The sum cost of the semantic tree.
 */
exports.costOfSemantic = function (semanticArray) {
	return semanticArray.reduce(function (accum, cur) {
		return accum + cur.semantic.cost + (cur.children ? exports.costOfSemantic(cur.children) : 0)
	}, 0)
}


// Combines two semantics into a new array
// Returns -1 if union of semantics in a RHS contains duplicates
exports.mergeRHS = function (a, b) {
	// Check for duplicates
	var bLen = b.length

	for (var i = 0, aLen = a.length; i < aLen; ++i) {
		var semanticNodeA = a[i]
		var semanticA = semanticNodeA.semantic
		var semanticAForbidsMultiple = semanticA.forbidsMultiple
		var semanticAIsNegation = semanticA.name === 'not'

		for (var j = 0; j < bLen; ++j) {
			var semanticNodeB = b[j]
			var semanticB = semanticNodeB.semantic

			// Prevent multiple instances of this function within a function's args (e.g., 'users-gender()'')
			if (semanticAForbidsMultiple && semanticA === semanticB) {
				return -1
			}

			// Prevent contradiction with 'not()' function
			if (semanticAIsNegation && semanticsEqual(semanticNodeA.children[0], semanticNodeB)) {
				return -1
			}

			// Prevent contradiction with 'not()' function
			if (semanticB.name === 'not' && semanticsEqual(semanticNodeA, semanticNodeB.children[0])) {
				return -1
			}

			if (semanticsEqual(semanticNodeA, semanticNodeB)) {
				return -1
			}
		}
	}

	// Do not need to sort because will be sorted when added to a LHS
	// `concat()` is faster here than `slice()` + `push.apply()`
	return a.concat(b)
}

/**
 * Determines if a new LHS semantic function (yet to be reduced) exists in the previous RHS semantics (already reduced) and multiple instances of that semantic function (irrespective of children) are forbidden. Hence, it allows its parse tree to be rejected without having to complete the new LHS semantic and later rejecting the tree for this reason in `semantic.mergeRHS()`
 *
 * @param {Array} rhs The most recent set of reduced semantics in a tree that have yet to be reduced into their parent semantic.
 * @param {Array} newLHS The new semantic, yet to be reduced, which will eventually be concatenated with `rhs` and share the same parent semantic.
 * @return {Boolean} `true` if `rhs` contains an instance of `newLHS`'s semantic function of which multiple instances are forbidden, else `false`.
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
 * @param {Object} a The semantic to compare.
 * @param {Object} b The other semantic to compare.
 * @return {Boolean} `true` if the semantics are equivalent, else `false`.
 */
function semanticsEqual(a, b) {
	if (a === b) return true

	if (a.semantic !== b.semantic) return false

	if (a.children && b.children) {
		return exports.semanticArraysEqual(a.children, b.children)
	}

	// `a` and `b` are semantic arguments of the same name
	return true
}

/**
 * Performs a deep comparison between two arrays of semantics to determine if they are equivalent. Each array is a RHS semantic.
 *
 * @param {Object} a The semantic array to compare.
 * @param {Object} b The other semantic array to compare.
 * @return {Boolean} `true` if the semantic arrays are equivalent, else `false`.
 */
exports.semanticArraysEqual = function (a, b) {
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


// Applies a completed semantic tree (`rhs`) to a more recent semantic (`lhs`), joining them together as semantic with `lhs` as the root function
// - lhs and rhs both always defined
// - not slicing rhs here because did before
// - the lhs should always be empty
// - We are assuming the lhs is always one function, not more than 1 where we intended to insert in the innermost
exports.reduce = function (lhs, rhs) {
	var lhsSemantic = lhs[0].semantic
	var rhsLen = rhs.length

	// If intersect with one semantic arg
	if (rhsLen === 1 && lhsSemantic.name === 'intersect') return rhs

	if (rhsLen < lhsSemantic.minParams) {
		throw 'semantic.reduce: rhs.length < minParams'
		return -1
	} else if (rhsLen > lhsSemantic.maxParams) {
		if (lhsSemantic.maxParams > 1) throw 'semantic.reduce: rhsLen > lhs.maxParams && lhs.maxParams > 1'
		if (lhsSemantic.forbidsMultiple) throw 'semantic.reduce: rhsLen > lhs.maxParams && lhs.forbidsMultiple'

		// Copy lhs semantic for each rhs
		// "repos liked by me and my followers" -> copy "repos-liked()" for each child
		var newLHS = []

		for (var s = 0; s < rhsLen; ++s) {
			newLHS[s] = {
				semantic: lhsSemantic,
				children: [ rhs[s] ],
			}
		}

		return newLHS
	} else {
		return [ {
			semantic: lhsSemantic,
			children: rhs.sort(compareSemantics),
		} ]
	}

	return newLHS
}


/**
 * Recursively compares semantic trees for sorting. Sorts arguments before functions, sorts functions and arguments separately alphabetically, and recursively sorts identical functions by their arguments. This function is used as the compare function for `Array.sort()`.
 *
 * @param {Object} a The semantic tree to compare.
 * @param {Object} b The other semantic tree to compare.
 * @return {Number} -1 to sort `a` before `b`, 1 to sort `a` after `b`, or 0 to leave `a` and `b` unchanged with respect to each other.
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
 * @param {Array} semanticArray The semantic tree to inspect.
 * @return {Boolean} `true` if the `semanticArray` is completely reduced, else `false.
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
 * @param {Array} semanticArray The semantic tree to convert.
 * @return {String} The string representation of `semanticArray`.
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
 * @param {String} semanticString The semantic string, output by `semantic.toString()`.
 * @return {String} The stylized semantic string.
 */
exports.colorString = function (semanticString) {
	var colors = require('colors')
	return semanticString.replace(/([\w-]+(?=\())|([\w-]+(?=[,\)]))/g, function (match, p1, p2) {
		return p1 ? colors.green(p1) : colors.red(p2)
	})
}

/**
 * Converts a semantic tree to a simple Object representation for printing.
 *
 * @param {Array} semanticArray The semantic tree to convert.
 * @return {Object} The simplified Object representation of `semanticArray`.
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