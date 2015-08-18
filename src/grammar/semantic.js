var util = require('../util')


exports.semantics = {}
// A mapping of semantic names to creation lines; used for error reporting
exports.creationLines = {}

exports.newSemantic = function (opts) {
	opts.name = opts.name.toLowerCase()

	if (exports.semantics.hasOwnProperty(opts.name)) {
		util.printErrWithLine('Duplicate Semantic', opts.name)
		throw 'duplicate Semantic'
	}

	return opts.isArg ? newSemanticArg(opts) : newSemanticFunc(opts)
}

// Schema for semantic functions
var semanticFuncOptsSchema = {
	name: String,
	cost: Number,
	minParams: Number,
	maxParams: Number,
	// When a DB object can only have one value for a specific property (e.g., repos only created by 1 person)
	// prevent multiple instances of the corresponding semantic function within another semantic's arguments
	// Otherwise, an intersection of objects with different values for this property will return an empty set
	preventDups: { type: Boolean, optional: true },
}

// Create a new semantic function from passed opts
function newSemanticFunc(opts) {
	if (util.illFormedOpts(semanticFuncOptsSchema, opts)) {
		throw 'ill-formed Semantic function'
	}

	if (opts.minParams > opts.maxParams) {
		util.printErrWithLine('Semantic minParams > maxParams', opts)
		throw 'ill-formed Semantic function'
	}

	var semantic = exports.semantics[opts.name] = {
		name: opts.name,
		cost: opts.cost,
		minParams: opts.minParams,
		maxParams: opts.maxParams,
		preventDups: opts.preventDups,
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


exports.costOfSemantic = function (semanticArray) {
	return semanticArray.reduce(function (accum, cur) {
		return accum + cur.semantic.cost + (cur.children ? exports.costOfSemantic(cur.children) : 0)
	}, 0)
}


// Combines two semantics into a new array
// Returns -1 if union of semantics in a RHS contains duplicates
exports.mergeRHS = function (A, B) {
	// Check for duplicates
	var BLength = B.length
	for (var i = A.length; i-- > 0;) {
		var semanticNodeA = A[i]
		var semanticA = semanticNodeA.semantic
		var semanticAPreventsDups = semanticA.preventDups
		var semanticAIsNegation = semanticA.name === 'not'

		for (var j = BLength; j-- > 0;) {
			var semanticNodeB = B[j]
			var semanticB = semanticNodeB.semantic

			// Prevent multiple instances of this function within a function's args (e.g., users-gender())
			if (semanticAPreventsDups && semanticA === semanticB) {
				return -1
			}

			// Prevent contradiction with not() function
			if (semanticAIsNegation && semanticsEqual(semanticNodeA.children[0], semanticNodeB)) {
				return -1
			}

			// Prevent contradiction with not() function
			if (semanticB.name === 'not' && semanticsEqual(semanticNodeA, semanticNodeB.children[0])) {
				return -1
			}

			if (semanticsEqual(semanticNodeA, semanticNodeB)) {
				return -1
			}
		}
	}

	// Do not need to sort because will be sorted when added to a LHS
	// concat() is faster here than slice() + push.apply()
	return A.concat(B)
}

// Returns `true` if the two semantics are identical (excluding children) and duplicates are forbidden
exports.forbiddenDups = function (A, B) {
	var BLength = B.length
	for (var i = A.length; i-- > 0;) {
		var semanticA = A[i].semantic
		var semanticAPreventsDups = semanticA.preventDups

		for (var j = BLength; j-- > 0;) {
			// Prevent multiple instances of this function within a function's args (e.g., users-gender())
			if (semanticAPreventsDups && semanticA === B[j].semantic) {
				return true
			}
		}
	}
}

// Returns `true` if passed semantics and their children are identical
// Each semantic is a LHS
function semanticsEqual(a, b) {
	if (a === b) return true

	if (a.semantic !== b.semantic) return false

	if (a.children && b.children) {
		return exports.semanticArraysEqual(a.children, b.children)
	}

	return true // args with same name
}

// Returns `true` if passed arrays of semantics are identical
// Each array is a RHS
exports.semanticArraysEqual = function (a, b) {
	// Same entity arrays
	if (a === b) return true

	// One of two is undefined (different semantics)
	if (!a || !b) return false

	var i = a.length
	if (i !== b.length) return false

	while (i-- > 0) {
		if (semanticsEqual(a[i], b[i])) return true
	}

	return false
}

// LHS and RHS both always defined
// not slicing RHS here because did before
// the LHS should always be empty
// We are assuming the LHS is always one function, not more than 1 where we intended to insert in the innermost
exports.insertSemantic = function (LHS, RHS) {
	var lhsSemantic = LHS[0].semantic
	var rhsLen = RHS.length

	// If intersect with one semantic arg
	if (rhsLen === 1 && lhsSemantic.name === 'intersect') return RHS

	if (rhsLen < lhsSemantic.minParams) {
		throw 'insertSemantic: RHS.length < minParams'
		return -1
	} else if (rhsLen > lhsSemantic.maxParams) {
		if (lhsSemantic.maxParams > 1) throw 'insertSemantic: rhsLen > LHS.maxParams && LHS.maxParams > 1'
		if (lhsSemantic.preventDups) throw 'insertSemantic: rhsLen > LHS.maxParams && LHS.preventDups'

		// Copy LHS semantic for each RHS
		// repos liked by me and my followers -> copy "repos-liked()" for each child
		var newLHS = []

		for (var s = 0; s < rhsLen; ++s) {
			newLHS[s] = {
				semantic: lhsSemantic,
				children: [ RHS[s] ],
			}
		}

		return newLHS
	} else {
		return [ {
			semantic: lhsSemantic,
			children: RHS.sort(compareSemantics),
		} ]
	}

	return newLHS
}


// Sort semantics: Arguments before functions, functions and arguments separately sorted alphabetically, identical functions sorted by their arguments
// If returns less than 0, sort a to a lower index than b
// If returns greater than 0, sort b to a lower index than a
// If returns 0, leave a and b unchanged with respect to each other
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

// Returns `true` if semantic is legal and thereby constitutes a RHS (called in grammar generation)
// Otherwise, semantic expected to accept other semantics as arguments
exports.isRHS = function (semanticArray) {
	return semanticArray.every(function (semanticNode) {
		var semanticChildren = semanticNode.children
		if (semanticChildren) {
			return semanticChildren.length === 0 ? false : exports.isRHS(semanticChildren)
		}

		return true
	})
}

// Convert semantic tree to a string represenation (used in Parser)
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