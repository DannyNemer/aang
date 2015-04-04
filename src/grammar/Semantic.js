var util = require('../util')

// module.exports = Semantic

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

	exports.semantics[opts.name] = {
		name: opts.name,
		cost: opts.cost,
		minParams: opts.minParams,
		maxParams: opts.maxParams
	}

	var semantic = {}
	semantic[opts.name] = []
	return [ semantic ]
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

	exports.semantics[opts.name] = {
		name: opts.name,
		cost: opts.cost,
		arg: true
	}

	return [ opts.name ]
}


exports.costOfSemantic = function (semantic) {
	return semantic.reduce(function (accum, cur) {
		// Semantic function
		if (cur.constructor === Object) {
			var semanticName = Object.keys(cur)[0]
			return accum + exports.semantics[semanticName].cost + exports.costOfSemantic(cur[semanticName])
		}

		// Semantic argument
		else if (exports.semantics.hasOwnProperty(cur)) {
			return accum + exports.semantics[cur].cost
		}

		// ID or numeric value
		return accum
	}, 0)
}

exports.insertSemantic = function (LHS, RHS) {
	if (!RHS) return LHS

	if (dupSemantics(RHS)) return -1 // not doing anything because RHS.length == 1

	// might be unecessary - all semantics saved in grammar are sorted, otherwise previously seen + sorted
	// RHS = RHS.sort(compareSemantics)

	if (!LHS) return RHS

	var newSemantic = insert(LHS, RHS)
	if (!newSemantic) throw 'merge fail' // TURNED OFF temporarily for display text check
	if (!newSemantic) return -1

	// remove intersect() when contains single argument
	for (var s = newSemantic.length; s-- > 0;) {
		var semanticChild = newSemantic[s]

		var intersectSemantic = semanticChild.intersect
		if (intersectSemantic) {
			if (intersectSemantic.length === 1) {
				newSemantic[s] = intersectSemantic[0]
			}
		}
	}

	return newSemantic
}

exports.insertSemanticBinary = function (LHS, RHSA, RHSB) {
	var RHS = RHSA && RHSB ? RHSA.concat(RHSB) : (RHSA || RHSB)
	if (!RHS) return LHS

	if (dupSemantics(RHS)) return -1
	if (hasOpenEndedSemantic(RHS)) return -1

	RHS = RHS.sort(compareSemantics)

	if (!LHS) return RHS

	// RHS = RHS.sort(compareSemantics) // here? (or taken care of earlier)
	var newSemantic = insert(LHS, RHS)
	if (!newSemantic) throw 'merge fail' // TURNED OFF temporarily for display text check
	if (!newSemantic) return -1

	// remove intersect() when contains single argument
	for (var s = newSemantic.length; s-- > 0;) {
		var semanticChild = newSemantic[s]

		var intersectSemantic = semanticChild.intersect
		if (intersectSemantic) {
			if (intersectSemantic.length === 1) {
				newSemantic[s] = intersectSemantic[0]
			}
		}
	}

	return newSemantic
}

// not slicing RHS here because did before
// the LHS should always be empty
function insert(LHS, RHS) {
	var lastIdx = LHS.length - 1
	var lhsSemantic = LHS[lastIdx]

	var semanticName = getSemanticName(lhsSemantic)
	var semanticChildren = lhsSemantic[semanticName]

	var newSemanticChildren = null
	if (semanticChildren.length === 0) {
		newSemanticChildren = RHS
	} else {
		// Go to deeper level
		newSemanticChildren = insert(semanticChildren, RHS) // when LHS.length > 0
		if (!newSemanticChildren) return null
	}

	if (newSemanticChildren.length > exports.semantics[semanticName].maxParams) throw 'problem'

	var newLHS = LHS.slice()
	var newSemantic = newLHS[lastIdx] = {}
	newSemantic[semanticName] = newSemanticChildren.sort(compareSemantics)
	return newLHS
}


// arguments before functions, functions sorted alphabtetically, arugments sorted by oreder they appear, identical functions sorted by their arguments
// if returns less than 0, sort a to a lower index than b
// if returns greater than 0, sort b to a lower index than a
// if returns 0, leave a and b unchanged with respect to each other
function compareSemantics(a, b) {
	var aIsObject = a.constructor === Object
	var bIsObject = b.constructor === Object

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
		var aName = getSemanticName(a)
		var bName = getSemanticName(b)

		if (aName < bName) return -1
		if (aName > bName) return 1

		// compare semantic children
		var aChildren = a[aName]
		var bChildren = b[bName]
		var returnVal = 0

		for (var i = 0, minLength = Math.min(aChildren.length, bChildren.length); i < minLength; i++) {
			var returnVal = compareSemantics(aChildren[i], bChildren[i])
			if (returnVal) break
		}

		return returnVal
	}

	// Strings: semantic argument, numeric id, or number
	return a === b ? 0 : (a < b ? -1 : 1)
}

// could eventually make function a prototype of semant
// just adds the RHS directly to function in LHS
// if using semanticRHS, etc, might not need to check to concat, etc - you know it needs to go inside
// -- in fact, you should only do it that way (simpler) and throw err when failed
// -- events is working now because of our ridiculous checks
// change to taking one RHS
// TODO: maybe it stops duplicates not created by the multiplier


// rejected semantics:
	// exact duplicats (accouting for sub-semantics)
	// returns empty-set: my male female friends, photos by me and my friends
	// photos-of(), photos-of()

function dupSemantics(semantic) {
	return semantic.some(function (argA, aIdx) {
		return semantic.some(function (argB, bIdx) {
			return aIdx < bIdx && JSON.stringify(argA) === JSON.stringify(argB) // temporary because slow
		})
	})
}

function getSemanticName(semantic) {
	return Object.keys(semantic)[0]
}

function hasOpenEndedSemantic(RHS) {
	return RHS.some(function (semantic) {
		if (semantic.constructor === Object) {
			var semanticName = getSemanticName(semantic)
			return semantic[semanticName].length < exports.semantics[semanticName].minParams
		}
	})
}

exports.semanticToString = function (semanticArgs) {
	if (!semanticArgs) return

	return semanticArgs.map(function (semantic) {
		if (semantic.constructor === Object) {
			var semanticName = Object.keys(semantic)[0]
			return semanticName + '(' + exports.semanticToString(semantic[semanticName]) + ')'
		} else {
			return semantic // number or string
		}
	}).join(',')
}