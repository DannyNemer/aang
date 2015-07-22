// Examples of ambiguous rules

var g = require('./grammar')


var x = g.newSymbol('x').addRule({ terminal: true, RHS: 'x' })
var y = g.newSymbol('y').addRule({ terminal: true, RHS: 'y' })
var z = g.newSymbol('z').addRule({ terminal: true, RHS: 'z' })

var xy = g.newSymbol('xy').addRule({ terminal: true, RHS: 'x y'})
var yz = g.newSymbol('yz').addRule({ terminal: true, RHS: 'y z'})

var xPar = g.newSymbol('x', 'par').addRule({ RHS: [ x ] })
var yPar = g.newSymbol('y', 'par').addRule({ RHS: [ y ] })
var xParPar = g.newSymbol('x', 'par', 'par').addRule({ RHS: [ xPar ] })

var xDup = g.newSymbol('x', 'dup').addRule({ terminal: true, RHS: 'x' })
var xParDup = g.newSymbol('x', 'par', 'dup').addRule({ RHS: [ x ] })


// Ambiguity at terminal symbols with paths of identical lengths
// S -> X1 -> 'x'
// S -> X2 -> 'x'
var ambigTermsSameLengths = g.newSymbol('ambig', 'terms', 'same', 'lengths')
ambigTermsSameLengths.addRule({ RHS: [ x ] })
ambigTermsSameLengths.addRule({ RHS: [ xDup ] })

// Ambiguity at terminal symbols with paths of different lengths
// S -> 'x'
// S -> B -> A -> X -> 'x'
var ambigTermsDiffLengths = g.newSymbol('ambig', 'terms', 'diff', 'lengths')
ambigTermsDiffLengths.addRule({ terminal: true, RHS: 'x' })
ambigTermsDiffLengths.addRule({ RHS: [ xParPar ] })

// Ambiguity at nonterminal symbols with paths of identical lengths
// S -> A -> X
// S -> A1 -> X
var ambigNontermsSameLengths = g.newSymbol('ambig', 'nonterms', 'same', 'lengths')
ambigNontermsSameLengths.addRule({ RHS: [ xPar ] })
ambigNontermsSameLengths.addRule({ RHS: [ xParDup ] })

// Ambiguity at nonterminal symbols with paths of different lengths
// S -> X
// S -> B -> A -> X
var ambigNontermsDiffLengths = g.newSymbol('ambig', 'nonterms', 'diff', 'lengths')
ambigNontermsDiffLengths.addRule({ RHS: [ x ] })
ambigNontermsDiffLengths.addRule({ RHS: [ xParPar ] })

// Ambiguity with paths containing binary rules
var ambigBinary = g.newSymbol('ambig', 'binary')
ambigBinary.addRule({ RHS: [ x, xPar ] })
ambigBinary.addRule({ RHS: [ xPar, xParPar ] })
ambigBinary.addRule({ RHS: [ x, xParPar ] })

// Ambiguity with terminal rules, same number of terminal symbols (i.e., branches)
// S -> XY -> 'x y'
//   -> Z  -> 'z'
// S -> X  -> 'x'
//   -> YZ -> 'y z'
var ambigSameNumTerms = g.newSymbol('ambig', 'same', 'num', 'terms')
ambigSameNumTerms.addRule({ RHS: [ xy, z ] })
ambigSameNumTerms.addRule({ RHS: [ x, yz ] })

// Ambiguity with terminal rules, different number of terminal symbols (i.e., branches)
// S -> X -> 'x'
//   -> Y -> 'y'
// S -> 'x y'
var ambigDiffNumTerms = g.newSymbol('ambig', 'diff', 'num', 'terms')
ambigDiffNumTerms.addRule({ RHS: [ xy ] })
ambigDiffNumTerms.addRule({ RHS: [ x, y ] })

// Ambiguity using a path built from a path used in an earlier instance of ambiguity
// Hence, a path cannot be discarded after finding ambiguity
// S -> X       (other ambig)  S -> 'x'
// S -> A -> X       =>        S -> A -> X -> 'x' (built from previous path)
var ambigBuiltFromEarlierAmbig = g.newSymbol('ambig', 'built', 'from', 'earlier', 'ambig')
ambigBuiltFromEarlierAmbig.addRule({ RHS: [ x ] })
ambigBuiltFromEarlierAmbig.addRule({ RHS: [ xPar ] })
ambigBuiltFromEarlierAmbig.addRule({ RHS: [ xParPar ] })

// A path ambiguous with two other paths at different rightmost symbols
// Hence, parse trees must be cloned before removing their rightmost symbols (when found ambiguous)
// In a binary rule, the first branch is completed down to the terminal symbol. That path can be found ambiguous, have rightmost symbols removed. Then, it might be found ambiguous again, but using symbols that were previously removed.
// S -> A -> X -> 'x'               S -> A                      S -> X -> 'x'
//   -> A                   (trim)    -> A       (other ambig)    -> X -> 'x'
// S -> B -> A -> X -> 'x'    =>    S -> B -> A       =>        S -> B -> A  (missing symbols)
//   -> B -> A                        -> B -> A                   -> B -> A -> X -> 'x'
var ambigMultPathsAtDiffDepths = g.newSymbol('ambig', 'mult', 'paths', 'at', 'diff', 'depths')
ambigMultPathsAtDiffDepths.addRule({ RHS: [ x, x ] })
ambigMultPathsAtDiffDepths.addRule({ RHS: [ xPar, xPar ] })
ambigMultPathsAtDiffDepths.addRule({ RHS: [ xParPar, xParPar ] })

// A pair of ambiguous paths, each ambiguous with at least one other path
// Both may find their other instance of ambiguity before the instance they share
// Hence, cannot stop a check for ambiguity after finding first instance of ambiguity; otherwise, that shared instance will not be reached
// - If only one of the pair of ambiguous paths has more than one instance of ambiguity, then it can be stopped early because its other instances of ambiguity will be reached by the other paths (which have one instance of ambiguity)
// - Must be terminal rules, otherwise the ambiguity can be found at different instances of the path (i.e., different lengths) rather than at a single instance
// The third pair of ambiguous paths will not be reached if both paths are stopped earlier:
// S -> 'x'         S -> 'x'         S -> X1 -> 'x'
// S -> X1 -> 'x'   S -> X2 -> 'x'   S -> X2 -> 'x'
var ambigMultPathsAtSameDepths = g.newSymbol('ambig', 'mult', 'paths', 'at', 'same', 'depth')
ambigMultPathsAtSameDepths.addRule({ terminal: true, RHS: 'x' })
ambigMultPathsAtSameDepths.addRule({ RHS: [ x ] })
ambigMultPathsAtSameDepths.addRule({ RHS: [ xDup ] })
