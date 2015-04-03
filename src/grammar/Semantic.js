var util = require('../util')

// module.exports = Semantic

exports.semantics = {}

var semanticSchema = {
	name: String,
	cost: Number,
	arg: { type: Boolean, optional: true },
	minParams: { type: Number, optional: true },
	maxParams: { type: Number, optional: true }
}

exports.Semantic = function (opts) {
	if (util.illFormedOpts(semanticSchema, opts)) {
		throw 'ill-formed Semantic'
	}

	if (opts.args && (opts.hasOwnProperty('minParams') || opts.hasOwnProperty('maxParams'))) {
		console.log('Err: Semantic arguments cannot have parameter settings:', opts.name)
		console.log(util.getLine())
		throw 'ill-formed Semantic'
	}

	if (exports.semantics.hasOwnProperty(opts.name)) {
		console.log('Err: Duplicate Semantic:', opts.name)
		console.log(util.getLine())
		throw 'duplicate Semantic'
	}

	exports.semantics[opts.name] = {
		cost: opts.cost,
		arg: opts.arg,
		minParams: opts.minParams,
		maxParams: opts.maxParams
	}

	if (opts.arg) {
		return [ opts.name ]
	} else {
		var semantic = {}
		semantic[opts.name] = []
		return [ semantic ]
	}
}

exports.costOfSemantic = function (semantic) {
	return semantic.reduce(function (accum, cur) {
		// Semantic function
		if (util.isType(cur, Object)) {
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

exports.insertSemantic = function (LHS) {
	var RHS = Array.prototype.slice.call(arguments, 1).filter(Boolean)
	if (RHS.length === 0) return LHS

	RHS = RHS.reduce(function (prev, cur) {
		return prev.concat(cur)
	}, [])

	if (dupSemantics(RHS)) return -1
	if (hasOpenEndedSemantic(RHS)) return -1

	RHS = RHS.sort(compareSemantics)

	if (!LHS) return RHS

	// RHS = RHS.sort(compareSemantics) // here? (or taken care of later)
	var newSemantic = insert(LHS, RHS)
	// if (!newSemantic) throw 'merge fail' // TURNED OFF temporarily for display text check
	if (!newSemantic) return -1

	// remove intersect() when contains single argument
	newSemantic.forEach(function (semanticChild, i) {
		var intersectSemantic = semanticChild.intersect
		if (intersectSemantic && intersectSemantic.length === 1) {
			newSemantic[i] = intersectSemantic[0]
		}
	})

	return newSemantic
}

function insert(LHS, RHS) {
	var newLHS
	var newLHSIdxOffset = 0

	for (var lhsIdx = 0, lhsLength = LHS.length; lhsIdx < lhsLength; lhsIdx++) {
		var lhsSemantic = LHS[lhsIdx]
		if (!util.isType(lhsSemantic, Object)) continue

		var semanticName = getSemanticName(lhsSemantic)
		var maxParams = exports.semantics[semanticName].maxParams
		if (maxParams === 0) continue

		var semanticChildren = lhsSemantic[semanticName]

		var newSemanticChildren
		if (semanticChildren.length === 0) {
			newSemanticChildren = RHS
		} else {
			newSemanticChildren = insert(semanticChildren, RHS)
			if (!newSemanticChildren) continue
		}

		if (newSemanticChildren.length > maxParams && maxParams > 1) throw 'problem'
		newLHS = newLHS || LHS.slice()

		if (newSemanticChildren.length > maxParams) {
			newSemanticChildren.forEach(function (newSemanticChild, i) {
				if (i) newLHSIdxOffset++
				var newSemantic = newLHS[lhsIdx + newLHSIdxOffset] = {}
				newSemantic[semanticName] = [ newSemanticChild ]
			})
		} else {
			var newSemantic = newLHS[lhsIdx + newLHSIdxOffset] = {}
			newSemantic[semanticName] = newSemanticChildren.sort(compareSemantics)
		}
	}

	return newLHS
}


// arguments before functions, functions sorted alphabtetically, arugments sorted by oreder they appear, identical functions sorted by their arguments
// if returns less than 0, sort a to a lower index than b
// if returns greater than 0, sort b to a lower index than a
// if returns 0, leave a and b unchanged with respect to each other
function compareSemantics(a, b) {
	var aIsObject = util.isType(a, Object)
	var bIsObject = util.isType(b, Object)

	// arg, func()
	if (!aIsObject && bIsObject)
		return -1

	// func(), arg
	if (aIsObject && !bIsObject)
		return 1

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
		if (util.isType(semantic, Object)) {
			var semanticName = getSemanticName(semantic)
			return exports.semantics[semanticName].length < exports.semantics[semanticName].minParams
		}
	})
}

// need a create semantic class, and a create semantic thing