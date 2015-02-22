var g = require('../grammar')
var relativePronouns = require('./relativePronouns')
var auxVerbs = require('./auxVerbs')

// Create the rules every category has
module.exports = function Category(catName) {
	this.name = catName

	var lhs = new g.Symbol(catName, 'lhs')
	lhs.addRule({ terminal: true, RHS: g.emptyTermSym })

	var lhsHead = new g.Symbol(catName, 'lhs', catName, 'head')
	// people (I follow); people (followed by me)
	this.head = new g.Symbol(catName, 'head')
	lhsHead.addRule({ RHS: [ lhs, this.head ], transpositionCost: 1 })


	var passivePlus = new g.Symbol(catName, 'passive+')
	// (people) followed by me
	this.passive = new g.Symbol(catName, 'passive')
	passivePlus.addRule({ RHS: [ this.passive ] })

	var reducedNoTense = new g.Symbol(catName, 'reduced', 'no', 'tense')
	// (people) followed by me; (people who are) followed by me
	reducedNoTense.addRule({ RHS: [ passivePlus ]})

	var reduced = new g.Symbol(catName, 'reduced')
	// (people) followed by me
	reduced.addRule({ RHS: [ reducedNoTense ]})


	var objFilterPlus = new g.Symbol(catName, 'obj', 'filter+')
	// (people) I follow
	this.objFilter = new g.Symbol(catName, 'obj', 'filter')
	objFilterPlus.addRule({ RHS: [ this.objFilter ] })

	var rhsExt = new g.Symbol(catName, 'rhs', 'ext')
	// (people) I follow
	rhsExt.addRule({ RHS: [ objFilterPlus ] })


	var rhs = new g.Symbol(catName, 'rhs')
	rhs.addRule({ terminal: true, RHS: g.emptyTermSym })
	// (people) followed by me
	rhs.addRule({ RHS: [ reduced ] })
	// (people) I follow
	rhs.addRule({ RHS: [ rhsExt ] })


	var noRelativeBase = new g.Symbol(catName, 'no', 'relative', 'base')
	// people I follow; people followed by me
	noRelativeBase.addRule({ RHS: [ lhsHead, rhs ], transpositionCost: 1 })


	var filter = new g.Symbol(catName, 'filter')
	// (people who) are followed by me
	filter.addRule({ RHS: [ auxVerbs.beNon1Sg, reducedNoTense ]})

	var filterPlus = new g.Symbol(catName, 'filter+')
	filterPlus.addRule({ RHS: [ filter ] })

	var relativeclause = new g.Symbol(catName, 'relativeclause')
	// (people) who are followed by me
	relativeclause.addRule({ RHS: [ relativePronouns.who, filterPlus ]})


	var noRelative = new g.Symbol(catName, 'no', 'relative')
	// people I follow
	noRelative.addRule({ RHS: [ noRelativeBase ] })
	// people who are followed by me
	noRelative.addRule({ RHS: [ noRelativeBase, relativeclause ]})


	this.plural = new g.Symbol(catName, 'plural')
	this.plural.addRule({ RHS: [ noRelative ]})
}