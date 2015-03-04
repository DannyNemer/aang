var util = require('../util')

module.exports = Semantic

var semantics = {}

var semanticDef = {
	name: String,
	cost: Number,
	arg: Boolean
}

//
// DO NOT IMPLEMENT UNTIL EVERYTHING ELSE IS PERFECT
// - parser, k-best, edits, generating display text, inflections
//

// Does Semantic need to be a Class? Yes - mergeSemantic stuff, but what about arguments?
function Semantic(opts) {
	if (!opts.hasOwnProperty('name')) {
		console.log('Semantic missing name:', opts)
		console.log(util.getLine())
		throw 'ill-formed rule'
	}

	if (!opts.hasOwnProperty('cost')) {
		console.log('Semantic missing cost:', opts)
		console.log(util.getLine())
		throw 'ill-formed rule'
	}

	if (util.illFormedOpts(opts, semanticDef)) {
		throw 'ill-formed Semantic'
	}

	// Unsure how we will seperate semantic arguments and functions with same name (seperate obj?, append name?)
	if (semantics.hasOwnProperty(opts.name)) {
		console.log('duplicate Symbol:', opts.name)
		console.log(util.getLine())
		throw 'duplicate Symbol'
	}

	semantics[opts.name] = {
		cost: opts.cost,
		arg: opts.arg
	}

	if (opts.arg) {
		return [ opts.name ]
	} else {
		var semantic = {}
		semantic[opts.name] = []
		return [ semantic ]
	}
}