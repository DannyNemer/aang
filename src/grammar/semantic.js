var util = require('../util')

exports.semantics = {}

exports.newSemantic = function (opts) {
	if (exports.semantics.hasOwnProperty(opts.name)) {
		util.printErrWithLine('Duplicate Semantic:', opts.name)
		throw 'duplicate Semantic'
	}

	return opts.isArg ? newSemanticArg(opts) : newSemanticFunc(opts)
}

// Concatenate variadic arguments with hyphens
exports.hyphenate = function () {
	var chunks = Array.prototype.slice.call(arguments)

	if (chunks.indexOf(undefined) !== -1) {
		util.printErrWithLine('undefined String in Semantic name:', chunks)
		throw 'ill-formed Semantic name'
	}

	return chunks.join('-')
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
	preventDups: { type: Boolean, optional: true }
}

// Create a new semantic function from passed opts
function newSemanticFunc(opts) {
	if (util.illFormedOpts(semanticFuncOptsSchema, opts)) {
		throw 'ill-formed Semantic function'
	}

	if (opts.minParams > opts.maxParams) {
		util.printErrWithLine('Semantic minParams > maxParams:', opts)
		throw 'ill-formed Semantic function'
	}

	var semantic = exports.semantics[opts.name] = {
		name: opts.name,
		cost: opts.cost,
		minParams: opts.minParams,
		maxParams: opts.maxParams,
		preventDups: opts.preventDups
	}

	return [ {
		semantic: semantic,
		children: []
	} ]
}


// Schema for semantic arguments
var semanticArgOptsSchema = {
	name: String,
	cost: Number,
	isArg: Boolean
}

// Create a new semantic argument from passed opts
function newSemanticArg(opts) {
	if (util.illFormedOpts(semanticArgOptsSchema, opts)) {
		throw 'ill-formed Semantic argument'
	}

	var semantic = exports.semantics[opts.name] = {
		name: opts.name,
		cost: opts.cost,
		isArg: true
	}

	return [ {
		semantic: semantic
	} ]
}


exports.costOfSemantic = function (semanticArray) {
	return semanticArray.reduce(function (accum, cur) {
		return accum + cur.semantic.cost + (cur.children ? exports.costOfSemantic(cur.children) : 0)
	}, 0)
}

// A and B both always exist
exports.mergeRHS = function (A, B) {
	// Check for duplicates
	for (var i = A.length; i-- > 0;) {
		var semanticA = A[i]
		var semanticAPreventsDups = semanticA.semantic.preventDups

		for (var j = B.length; j-- > 0;) {
			var semanticB = B[j]

			// Prevent multiple instances of this function within a function's args (e.g., repos-by())
			if (semanticAPreventsDups && semanticA.semantic === semanticB.semantic) {
				return -1
			}

			if (semanticsMatch(semanticA, semanticB)) {
				return -1
			}
		}
	}

	// Do not need to sort because will be sorted when added to a LHS
	// And every one with the RHS (being check for dup) has been added to RHS

	return A.concat(B)
}

function semanticsMatch(a, b) {
	if (a === b) return true

	if (a.semantic !== b.semantic) return false

	if (a.children && b.children) {
		return semanticArraysMatch(a.children, b.children)
	}

	return true // args with same name
}

function semanticArraysMatch(a, b) {
	// Same entity arrays
	if (a === b) return true

	// One of two is undefined (different semantics)
	if (!a || !b) return false

	var i = a.length
	if (i !== b.length) return false

	while (i-- > 0) {
		if (semanticsMatch(a[i], b[i])) return true
	}

	return false
}

// LHS and RHS both always defined
// not slicing RHS here because did before
// the LHS should always be empty, and last one - because of sorting we know it is not arguemnt
exports.insertSemantic = function (LHS, RHS) {
	var lhsSemantic = LHS[0].semantic
	var RHSLen = RHS.length

	// If intersect with one semantic arg
	if (RHSLen === 1 && lhsSemantic.name === 'intersect') return RHS

	if (RHSLen < lhsSemantic.minParams) {
		// throw 'semantic problem: RHS.length < minParams'
		return -1
	} else if (RHSLen > lhsSemantic.maxParams) {
		// Prevent multiple instances of this function within a RHS
		// Only insert the first of the RHS, then merge with the remaining RHS
		// - Ex: my {language} repos -> [ repos-created(me), repos-language({language}) ]
		if (lhsSemantic.preventDups) {
			var firstSemantic = [ {
				semantic: lhsSemantic,
				children: [ RHS[0] ]
			} ]

			return firstSemantic.concat(RHS.slice(1))
		}

		if (lhsSemantic.maxParams > 1) throw 'semantic problem'

		// Copy LHS semantic for each RHS
		// repos liked by me and my followers -> copy "repos-liked()" for each child
		var newLHS = []

		for (var s = 0; s < RHSLen; ++s) {
			newLHS[s] = {
				semantic: lhsSemantic,
				children: [ RHS[s] ]
			}
		}

		return newLHS
	} else {
		return [ {
			semantic: lhsSemantic,
			children: RHS.sort(compareSemantics)
		} ]
	}

	return newLHS
}


// arguments before functions, functions and arguments separately sorted alphabetically, identical functions sorted by their arguments
// if returns less than 0, sort a to a lower index than b
// if returns greater than 0, sort b to a lower index than a
// if returns 0, leave a and b unchanged with respect to each other
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

exports.semanticToString = function (semanticArray) {
	var str = ''

	for (var s = 0, semanticArrayLen = semanticArray.length; s < semanticArrayLen; ++s) {
		var semanticNode = semanticArray[s]
		var semanticName = semanticNode.semantic.name

		if (semanticNode.children) {
			str += (s ? ',' : '') + semanticName + '(' + exports.semanticToString(semanticNode.children) + ')'
		} else {
			str += (s ? ',' : '') + semanticName
		}
	}

	return str
}