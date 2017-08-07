/**
 * Rules demonstrating varying parse tree formations. Used to check for errors in parsing and forest search.
 *
 * This file currently contains very few test cases. Will be expanded with rules from 'ambiguityTests.js'.
 */

var g = require('./grammar')

var x = g.newSymbol('x').addRule({ isTerminal: true, rhs: 'x' })
var y = g.newSymbol('y').addRule({ isTerminal: true, rhs: 'y' })
var z = g.newSymbol('z').addRule({ isTerminal: true, rhs: 'z' })
var semanticFunc = g.newSemantic({ isArg: true, name: 'func', cost: 0 })

var xInsert = g.newSymbol('x', 'insertion').addRule({ isTerminal: true, rhs: 'x', insertionCost: 1 })


// Terminal symbol on start symbol. (Uses a semantic to avoid the error for a tree lacking a semantic).
g.startSymbol.addRule({ isTerminal: true, rhs: "x", semantic: semanticFunc })

// Unary terminal rule on start symbol.
g.startSymbol.addRule({ rhs: [ x ], semantic: semanticFunc })

// Insertion on start symbol.
g.startSymbol.addRule({ rhs: [ xInsert ], semantic: semanticFunc })
g.startSymbol.addRule({ rhs: [ xInsert, y ], semantic: semanticFunc })

// Binary terminal rule on start symbol.
g.startSymbol.addRule({ rhs: [ x, y ], semantic: semanticFunc })

// Transposition on start rule.
g.startSymbol.addRule({ rhs: [ y, z ], transpositionCost: 0 })

// Semantic on transposition.
g.startSymbol.addRule({ rhs: [ y, z ], semantic: semanticFunc, transpositionCost: 0 })

// Overlapping terminal symbols.
g.startSymbol.addRule({ isTerminal: true, rhs: "x y z", semantic: semanticFunc })
g.startSymbol.addRule({ isTerminal: true, rhs: "z", semantic: semanticFunc })
g.startSymbol.addRule({ rhs: [
	x,
	g.newSymbol('y', 'z').addRule({ isTerminal: true, rhs: "y z" })
], semantic: semanticFunc })