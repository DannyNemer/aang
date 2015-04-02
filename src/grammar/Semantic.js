var util = require('../util')

module.exports = Semantic

var semantics = {}

var semanticSchema = {
	name: String,
	cost: Number,
	arg: { type: Boolean, optional: true }
}

function Semantic(opts) {
	if (util.illFormedOpts(semanticSchema, opts)) {
		throw 'ill-formed Semantic'
	}

	if (semantics.hasOwnProperty(opts.name)) {
		console.log('Err: Duplicate Semantic:', opts.name)
		console.log(util.getLine())
		throw 'duplicate Semantic'
	}

	this.cost = opts.cost

	semantics[opts.name] = {
		cost: this.cost,
		arg: opts.arg
	}

	if (opts.arg) {
		this.function = [ opts.name ]
	} else {
		var semantic = {}
		semantic[opts.name] = []
		this.function = [ semantic ]
	}
}