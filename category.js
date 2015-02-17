var g = require('./grammar')

var stopwords = require('./stopWords')

// Create the rules every category has
module.exports = function Category(catName) {
	this.lhs = new g.Symbol(catName, 'lhs')
	this.lhs.addRule({ RHS: [ stopwords.emptyTermSym ] })

	this.head = new g.Symbol(catName, 'head')

	this.lhsHead = new g.Symbol(catName, 'lhs', catName, 'head')
	this.lhsHead.addRule({ RHS: [ this.lhs, this.head ] })

	this.rhsExt = new g.Symbol(catName, 'rhs', 'ext')

	this.rhs = new g.Symbol(catName, 'rhs')
	this.rhs.addRule({ RHS: [ this.rhsExt ] })

	this.noRelativeBase = new g.Symbol(catName, 'no', 'relative', 'base')
	this.noRelativeBase.addRule({ RHS: [ this.lhsHead, this.rhs ] })

	this.noRelative = new g.Symbol(catName, 'no', 'relative')
	this.noRelative.addRule({ RHS: [ this.noRelativeBase ] })

	this.plural = new g.Symbol(catName, 'plural')
	this.plural.addRule({ RHS: [ this.noRelative ]})
}