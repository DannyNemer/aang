/**
 * Rules demonstrating varying parse tree formations. Used to check for errors in parsing and forest search.
 *
 * This file currently contains very few test cases. Will be expanded with rules from 'ambiguityTests.js'.
 */

var g = require('./grammar')

var x = g.newSymbol('x').addRule({ isTerminal: true, RHS: 'x' })
var y = g.newSymbol('y').addRule({ isTerminal: true, RHS: 'y' })
var z = g.newSymbol('z').addRule({ isTerminal: true, RHS: 'z' })
var semanticFunc = g.newSemantic({ isArg: true, name: 'func', cost: 0 })

var xInsert = g.newSymbol('x', 'insertion').addRule({ isTerminal: true, RHS: 'x', insertionCost: 1 })


// Terminal symbol on start symbol. (Uses a semantic to avoid the error for a tree lacking a semantic).
g.startSymbol.addRule({ isTerminal: true, RHS: "x", semantic: semanticFunc })

// Unary terminal rule on start symbol.
g.startSymbol.addRule({ RHS: [ x ], semantic: semanticFunc })

// Insertion on start symbol.
g.startSymbol.addRule({ RHS: [ xInsert ], semantic: semanticFunc })
g.startSymbol.addRule({ RHS: [ xInsert, y ], semantic: semanticFunc })

// Binary terminal rule on start symbol.
g.startSymbol.addRule({ RHS: [ x, y ], semantic: semanticFunc })

// Transposition on start rule.
g.startSymbol.addRule({ RHS: [ y, z ], transpositionCost: 0 })

// Semantic on transposition.
g.startSymbol.addRule({ RHS: [ y, z ], semantic: semanticFunc, transpositionCost: 0 })

// Overlapping terminal symbols.
g.startSymbol.addRule({ isTerminal: true, RHS: "x y z", semantic: semanticFunc })
g.startSymbol.addRule({ isTerminal: true, RHS: "z", semantic: semanticFunc })
g.startSymbol.addRule({ RHS: [
	x,
	g.newSymbol('y', 'z').addRule({ isTerminal: true, RHS: "y z" })
], semantic: semanticFunc })