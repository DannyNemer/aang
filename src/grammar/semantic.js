var util = require('../util')

exports.semantics = {}

exports.newSemantic = function (opts) {
	if (exports.semantics.hasOwnProperty(opts.name)) {
		console.log('Err: Duplicate Semantic:', opts.name)
		console.log(util.getLine())
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
	preventDups: { type: Boolean, optional: true }
}

// Create a new semantic function from passed opts
function newSemanticFunc(opts) {
	if (util.illFormedOpts(semanticFuncOptsSchema, opts)) {
		throw 'ill-formed Semantic function'
	}

	if (opts.minParams > opts.maxParams) {
		console.log('Err: Semantic minParams > maxParams:', opts)
		console.log(util.getLine())
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
	if (semanticArray.constructor === String) {
		var semanticDef = exports.semantics[semanticArray]
		if (semanticDef) return semanticDef.cost
		else {
			console.log(semanticArray)
		}
	}
	return semanticArray.reduce(function (accum, cur) {
		return accum + cur.semantic.cost + (cur.children ? exports.costOfSemantic(cur.children) : 0)
	}, 0)
}

// Check for duplicates
// A and B both always exist
exports.mergeRHS = function (A, B) {
	for (var i = A.length; i-- > 0;) {
		var semanticA = A[i]
		var semanticAPreventsDups = semanticA.semantic.preventDups

		for (var j = B.length; j-- > 0;) {
			var semanticB = B[j]

			if (semanticA.semantic === semanticB.semantic) {
				// Prevent multiple instances of this function within a function's args (e.g., repos-by())
				if (semanticAPreventsDups) return -1

				if (semanticA.children === semanticB.children) return -1
			}
		}
	}

	// Do not need to sort because will be sorted when added to a LHS
	// And every one with the RHS (being check for dup) has been added to RHS

	return A.concat(B)
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
				children: toString(RHS[0])
			} ]

			// keep children untouched, already in format
			return firstSemantic.concat(RHS.slice(1))
		}

		if (lhsSemantic.maxParams > 1) throw 'semantic problem'

		// Copy LHS semantic for each RHS
		// repos liked by me and my followers -> copy "repos-liked()" for each child
		var newLHS = []
		for (var s = 0; s < RHSLen; ++s) {
			newLHS[s] = {
				semantic: lhsSemantic,
				children: toString(RHS[s]) // could put parentehsis around (or later if this proves illegal)
			}
		}

		return newLHS
	} else {
		// remove array?
		var RHSCopy = []
		for (var r = RHSLen; r-- > 0;) {
			RHSCopy[r] = toString(RHS[r])
		}

		return [ {
			semantic: lhsSemantic,
			children: RHSCopy.sort().join(',') // could join here, or later (later might me additional work, but saved for working on lost causes)
		} ]
	}
}

exports.semanticToString = function (semanticArray) {
	if (semanticArray.length > 1) throw 'semanticArray.length > 1'

	return toString(semanticArray[0])
}

function toString(semanticNode) {
	var semanticName = semanticNode.semantic.name

	if (semanticNode.children) {
		return semanticName + '(' + semanticNode.children + ')'
	} else {
		return semanticName
	}
}