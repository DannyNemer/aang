var g = require('./grammar')

// Create the rules every category has
module.exports = function Category(catName) {
	this.name = catName

	var lhs = new g.Symbol(catName, 'lhs')
	lhs.addRule({ RHS: [ g.emptyTermSym ] })

	// people (I follow); people (followed by me)
	this.head = new g.Symbol(catName, 'head')

	var lhsHead = new g.Symbol(catName, 'lhs', catName, 'head')
	// people (I follow)
	lhsHead.addRule({ RHS: [ lhs, this.head ] })

	// (people) followed by me
	this.reducedNoTense = new g.Symbol(catName, 'reduced', 'no', 'tense')

	// (people) followed by me
	var reduced = new g.Symbol(catName, 'reduced')
	reduced.addRule({ RHS: [ this.reducedNoTense ]})

	// (people) I follow
	this.rhsExt = new g.Symbol(catName, 'rhs', 'ext')

	var rhs = new g.Symbol(catName, 'rhs')
	// (people) followed by me
	rhs.addRule({ RHS: [ reduced ] })
	// (people) I follow
	rhs.addRule({ RHS: [ this.rhsExt ] })

	var noRelativeBase = new g.Symbol(catName, 'no', 'relative', 'base')
	// people I follow; people followed by me
	noRelativeBase.addRule({ RHS: [ lhsHead, rhs ] })

	var noRelative = new g.Symbol(catName, 'no', 'relative')
	noRelative.addRule({ RHS: [ noRelativeBase ] })

	this.plural = new g.Symbol(catName, 'plural')
	this.plural.addRule({ RHS: [ noRelative ]})
}