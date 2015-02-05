// symbols take names only for debugging
// create a symbol object with a prototype function to add rules
// do not deal with entities

this.grammar = {
	startSymbol: '[start]',
	nonterminals: {},
	terminals: {}
}

function Symbol(name) {
	this.name = name
}

var nontermRuleDef = {
	RHS: Array,
	semantic: Array,
	transpositionCost: Number,
	gramCase: [ 'nom', 'obj' ],
	verbForm: [ 'past', 'present', 'future', 'past-perfect', 'past-participle' ],
	personNumber: [ '1', 'pl', '3sg' ],
}

Symbol.prototype.NR = function (rule) {
	if (illFormedOpts(rule, nontermRuleDef))
		return
}

// do we add all at once?
// they will always be added together, same block of code
// will need to ensure only one has insertion cost
Symbol.prototype.TR = function () {

}