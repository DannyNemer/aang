var util = require('../util')

exports.semantics = {}

exports.Semantic = function (opts) {
	if (exports.semantics.hasOwnProperty(opts.name)) {
		console.log('Err: Duplicate Semantic:', opts.name)
		console.log(util.getLine())
		throw 'duplicate Semantic'
	}

	return opts.arg ? newSemanticArg(opts) : newSemanticFunc(opts)
}


// Schema for semantic functions
var semanticFuncOptsSchema = {
	name: String,
	cost: Number,
	minParams: Number,
	maxParams: Number
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
		maxParams: opts.maxParams
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
	arg: Boolean
}

// Create a new semantic argument from passed opts
function newSemanticArg(opts) {
	if (util.illFormedOpts(semanticArgOptsSchema, opts)) {
		throw 'ill-formed Semantic argument'
	}

	var semantic = exports.semantics[opts.name] = {
		name: opts.name,
		cost: opts.cost,
		arg: true
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

// rejected semantics:
// - exact duplicats (accouting for sub-semantics)
// - contradictions (unimplemented):
// - - returns empty-set: my male female friends, photos by me and my friends
// - - photos-of(), photos-of()

// A and B both always exist
exports.mergeRHS = function (A, B) {
	// Check for duplicates
	for (var i = A.length; i-- > 0;) {
		var semanticA = A[i]

		for (var j = B.length; j-- > 0;) {
			if (semanticsMatch(semanticA, B[j])) {
				return -1
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

	if (RHSLen > lhsSemantic.maxParams) {
		if (lhsSemantic.maxParams > 1) throw 'semantic problem'

		var newLHS = []
		// repos liked by me and my followers -> copy "repos-liked()" for each child
		for (var s = 0; s < RHSLen; ++s) {
			newLHS[s] = {
				semantic: lhsSemantic,
				children: [ RHS[s] ]
			}
		}

		return newLHS
	} else if (RHSLen < lhsSemantic.minParams) {
		// throw 'semantic problem: RHS.length < minParams'
		return -1
	} else {
		return [ {
			semantic: lhsSemantic,
			children: RHS.sort(compareSemantics)
		} ]
	}

	return newLHS
}


// arguments before functions, functions sorted alphabtetically, arugments sorted by oreder they appear, identical functions sorted by their arguments
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

		// same semantic function (by name)
		// compare semantic children
		var aChildren = a.children
		var bChildren = b.children
		var returnVal = 0

		for (var i = 0, minLength = Math.min(aChildren.length, bChildren.length); i < minLength; ++i) {
			returnVal = compareSemantics(aChildren[i], bChildren[i])
			if (returnVal) break
		}

		return returnVal
	}

	// Strings: semantic argument, numeric id, or number
	return a.semantic === b.semantic ? 0 : (a.semantic.name < b.semantic.name ? -1 : 1)
	// return a === b ? 0 : (a < b ? -1 : 1) // might be able to compare a == b
}


function semanticsMatch(a, b) {
	// entities
	if (a === b) return true

	if (a.semantic !== b.semantic) return false

	if (a.children && b.children) {
		return exports.semanticArraysMatch(a.children, b.children)
	}

	return true // args with same name
}

exports.semanticArraysMatch = function (a, b) {
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