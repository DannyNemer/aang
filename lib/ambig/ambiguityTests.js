/**
 * Rules demonstrating each possible instance of ambiguity.
 *
 * Used by `ambiguityCheck` to test its algorithm's coverage by reporting if it correctly detects each ambiguous test.
 */

var util = require('../util/util')
var g = require('../grammar/grammar')
var symbol = require('../grammar/symbol')
var semantic = require('../grammar/semantic')


var x = g.newSymbol('x').addRule({ terminal: true, RHS: 'x' })
var y = g.newSymbol('y').addRule({ terminal: true, RHS: 'y' })
var z = g.newSymbol('z').addRule({ terminal: true, RHS: 'z' })

var xyTerm = g.newSymbol('xy', 'term').addRule({ terminal: true, RHS: 'x y'})
var yzTerm = g.newSymbol('yz', 'term').addRule({ terminal: true, RHS: 'y z'})

var xPar = g.newSymbol('x', 'par').addRule({ RHS: [ x ] })
var xParPar = g.newSymbol('x', 'par', 'par').addRule({ RHS: [ xPar ] })

var xDup = g.newSymbol('x', 'dup').addRule({ terminal: true, RHS: 'x' })
var xParDup = g.newSymbol('x', 'par', 'dup').addRule({ RHS: [ x ] })

var xOrY = g.newSymbol('x', 'or', 'y')
xOrY.addRule({ RHS: [ x ] })
xOrY.addRule({ RHS: [ y ] })

var xx = g.newBinaryRule({ RHS: [ x, x ] })

var xyRecursive = g.newSymbol('x', 'y', 'recursive')
xyRecursive.addRule({ RHS: [ x, xyRecursive ] })
xyRecursive.addRule({ RHS: [ x ] })
xyRecursive.addRule({ RHS: [ y, xyRecursive ] })
xyRecursive.addRule({ RHS: [ y ] })

var xToY = g.newSymbol('x', 'to', 'y').addRule({ terminal: true, RHS: 'x', text: 'y' })
var xToYDup = g.newSymbol('x', 'to', 'y', 'dup').addRule({ terminal: true, RHS: 'x', text: 'y' })
var xyToX = g.newSymbol('xy', 'to', 'x').addRule({ terminal: true, RHS: 'x y', text: 'x' })

var xyVerb = g.newSymbol('x', 'y', 'verb').addVerb({
	insertionCost: 0.5,
	oneOrPl: [ 'x' ],
	threeSg: [ 'y' ],
})

var xyVerbDup = g.newSymbol('x', 'y', 'verb', 'dup').addVerb({
	insertionCost: 0.5,
	oneOrPl: [ 'x' ],
	threeSg: [ 'y' ],
})

var xInsert = g.newSymbol('x', 'insert').addRule({ terminal: true, RHS: 'x', insertionCost: 0.5 })
var yInsert = g.newSymbol('y', 'insert').addRule({ terminal: true, RHS: 'y', insertionCost: 0.5 })
var xyTermInsert = g.newSymbol('xy', 'term', 'insert').addRule({ terminal: true, RHS: 'x y', insertionCost: 0.5 })

var semanticFunc = g.newSemantic({ name: 'func', cost: 0.5, minParams: 1, maxParams: 1})
var semanticArg = g.newSemantic({ isArg: true, name: 'arg', cost: 0.5 })
var semanticFuncReduced = semantic.reduce(semanticFunc, semanticArg)

var xSemanticArg = g.newSymbol('x', 'semantic', 'arg').addRule({ RHS: [ x ], semantic: semanticArg })
var xInsertSemanticArg = g.newSymbol('x', 'insert', 'semantic', 'arg').addRule({ RHS: [ xInsert ], semantic: semanticArg })
var xInsertSemanticFuncReduced = g.newSymbol('x', 'insert', 'semantic', 'func', 'reduced').addRule({ RHS: [ xInsert ], semantic: semanticFuncReduced })
var emptySemanticArg = g.newSymbol('empty', 'semantic', 'arg').addRule({ terminal: true, RHS: g.emptySymbol, semantic: semanticArg })


/**
 * Ambiguity created by terminal symbols with paths of identical lengths.
 *
 * S -> X1 -> 'x'
 * S -> X2 -> 'x'
 */
var ambigTermsSameLengths = g.newSymbol('ambig', 'terms', 'same', 'lengths')
ambigTermsSameLengths.addRule({ RHS: [ x ] })
ambigTermsSameLengths.addRule({ RHS: [ xDup ] })

/**
 * Ambiguity created by terminal symbols with paths of different lengths.
 *
 * S -> 'x'
 * S -> X-par-par -> X-par -> X -> 'x'
 */
var ambigTermsDiffLengths = g.newSymbol('ambig', 'terms', 'diff', 'lengths')
ambigTermsDiffLengths.addRule({ terminal: true, RHS: 'x' })
ambigTermsDiffLengths.addRule({ RHS: [ xParPar ] })

/**
 * Ambiguity created by nonterminal symbols with paths of identical lengths.
 *
 * S -> X-par -> X
 * S -> X-par-dup -> X
 */
var ambigNontermsSameLengths = g.newSymbol('ambig', 'nonterms', 'same', 'lengths')
ambigNontermsSameLengths.addRule({ RHS: [ xPar ] })
ambigNontermsSameLengths.addRule({ RHS: [ xParDup ] })

/**
 * Ambiguity created by nonterminal symbols with paths of different lengths.
 *
 * S -> X
 * S -> X-par-par -> X-par -> X
 */
var ambigNontermsDiffLengths = g.newSymbol('ambig', 'nonterms', 'diff', 'lengths')
ambigNontermsDiffLengths.addRule({ RHS: [ x ] })
ambigNontermsDiffLengths.addRule({ RHS: [ xParPar ] })

/**
 * Ambiguity created by paths containing binary rules.
 *
 * S -> X
 *   -> X-par
 * S -> X
 *   -> X-par-par -> X-par
 */
var ambigBinary = g.newSymbol('ambig', 'binary')
ambigBinary.addRule({ RHS: [ x, xPar ] })
ambigBinary.addRule({ RHS: [ xPar, xParPar ] })
ambigBinary.addRule({ RHS: [ x, xParPar ] })

/**
 * Ambiguity created by terminal rules with the same number of terminal symbols (i.e., branches).
 *
 * S -> XY -> 'x y'
 *   -> Z  -> 'z'
 * S -> X  -> 'x'
 *   -> YZ -> 'y z'
 */
var ambigSameNumTerms = g.newSymbol('ambig', 'same', 'num', 'terms')
ambigSameNumTerms.addRule({ RHS: [ xyTerm, z ] })
ambigSameNumTerms.addRule({ RHS: [ x, yzTerm ] })

/**
 * Ambiguity created by terminal rules with a different number of terminal symbols (i.e., branches).
 *
 * S -> X -> 'x'
 *   -> Y -> 'y'
 * S -> 'x y'
 */
var ambigDiffNumTerms = g.newSymbol('ambig', 'diff', 'num', 'terms')
ambigDiffNumTerms.addRule({ RHS: [ xyTerm ] })
ambigDiffNumTerms.addRule({ RHS: [ x, y ] })

/**
 * The same instance of ambiguity represented at different depths by multiple pairs of paths.
 *
 * When `--find-all` is `true`, avoid printing different instances of the same ambiguous relationship by removing a pair's identical rightmost symbols (using `diffTrees()`) and comparing to previous pairs.
 *
 * S -> X           (other ambig)  S -> X -> x           (trim)  S -> X           (identical so
 * S -> X-par -> X       =>        S -> X-par -> X -> x    =>    S -> X-par -> X   not printed)
 */
var ambigDupAvoidedByTrim = g.newSymbol('ambig', 'dup', 'avoided', 'by', 'trim')
ambigDupAvoidedByTrim.addRule({ RHS: [ x ] })
ambigDupAvoidedByTrim.addRule({ RHS: [ xPar ] })

/**
 * Ambiguity created by path built from a path used in an earlier instance of ambiguity.
 *
 * Hence, a path cannot be discarded after finding ambiguity.
 *
 * S -> X-par               (other ambig)  S -> X
 * S -> X-par-par -> X-par       =>        S -> X-par-par -> X-par -> X  (built from previous path)
 */
var ambigBuiltFromEarlierAmbig = g.newSymbol('ambig', 'built', 'from', 'earlier', 'ambig')
ambigBuiltFromEarlierAmbig.addRule({ RHS: [ x ] })
ambigBuiltFromEarlierAmbig.addRule({ RHS: [ xPar ] })
ambigBuiltFromEarlierAmbig.addRule({ RHS: [ xParPar ] })

/**
 * Multiple instances of ambiguity created by same pair of start rules from the root nonterminal symbol.
 *
 * By default, when the `--find-all` option is set to `false`, the ambiguity check will only print one instance of ambiguity for each pair of rules from the root nonterminal symbol.
 *
 * This exemplifies when one would want `--find-all` set to `true`.
 *
 * S -> X-or-Y -> X   S -> X-or-Y -> Y
 * S -> X             S -> Y
 */
var ambigMultSameStartRules = g.newSymbol('ambig', 'mult', 'same', 'start', 'rules')
ambigMultSameStartRules.addRule({ RHS: [ xOrY ] })
ambigMultSameStartRules.addRule({ RHS: [ x ] })
ambigMultSameStartRules.addRule({ RHS: [ y ] })

/**
 * Ambiguity created by a recursive rule (i.e., a rule whose RHS contains the LHS).
 *
 * - The grammar enforces symbols with recursive rules to require a non-recursive rule to be the stop case.
 *
 * - In the grammar, recursive rules are made with `<empty>` in `createEditRules`; however, here they are made manually (without `createEditRules`).
 *
 * S -> X
 *   -> S -> Y
 * S -> S -> X
 *   -> Y
 */
var ambigRecursive = g.newSymbol('ambig', 'recursive')
ambigRecursive.addRule({ RHS: [ x, ambigRecursive ] })
ambigRecursive.addRule({ RHS: [ x ] })
ambigRecursive.addRule({ RHS: [ ambigRecursive, y ] })
ambigRecursive.addRule({ RHS: [ y ] })

/**
 * Ambiguity created by rules where one the rules' RHS contains a non-ambiguous recursive symbol. Ambiguity occurs only in these rules, not in the recursive symbol's rules alone.
 *
 * Hence, cannot prevent recursive rules in path search.
 *
 * S -> recur -> X
 *            -> recur -> Y
 * S -> X
 *   -> Y
 */
var ambigRecursiveRHS = g.newSymbol('ambig', 'recursive', 'rhs')
ambigRecursiveRHS.addRule({ RHS: [ xyRecursive ] })
ambigRecursiveRHS.addRule({ RHS: [ x, xyRecursive ] })
ambigRecursiveRHS.addRule({ RHS: [ x, y ] })
ambigRecursiveRHS.addRule({ RHS: [ xx, y ] })

/**
 * Ambiguity created by a recursive start rule and a path using multiple instances of a single rule.
 *
 * Hence, cannot prevent paths where the start rule is recursive and contains multiple instances of the same rule.
 *
 * S -> X (start rule is ambiguous)
 *   -> S -> X (second instance of same rule)
 *        -> S -> X
 * S -> X
 *   -> XX -> X
 *         -> X
 */
var ambigRecursiveMultRule = g.newSymbol('ambig', 'recursive', 'mult', 'rule')
ambigRecursiveMultRule.addRule({ RHS: [ x, ambigRecursiveMultRule ] })
ambigRecursiveMultRule.addRule({ RHS: [ x ] })
ambigRecursiveMultRule.addRule({ RHS: [ x, xx ] })

/**
 * Multiple instances of ambiguity created by the same pair of start rules from the root nonterminal symbol.
 *
 * The presence of multiple instances, as opposed to one, is caused by an ambiguous symbol in one of the rules' RHS.
 *
 * By default, when the `--find-all` option is set to `false`, the ambiguity check will only print one instance of ambiguity for each pair of rules from the root nonterminal symbol.
 *
 * This also exemplifies a single instance of a path being ambiguous with multiple paths from the same start rule. Hence, when `--find-all` is `true`, cannot `break` after finding ambiguity with a pair of paths.
 *
 * S -> X-or-X-dup -> X -> x   S -> X-or-X-dup -> X-dup -> x
 * S -> X -> x                 S -> X -> x
 */
var ambigMultSameStartRulesSubambig = g.newSymbol('ambig', 'mult', 'same', 'start', 'rules', 'subambig')
ambigMultSameStartRulesSubambig.addRule({ RHS: [ ambigTermsSameLengths ] })
ambigMultSameStartRulesSubambig.addRule({ RHS: [ x ] })

/**
 * Ambiguity created by a path with two other paths at different rightmost symbols.
 *
 * Hence, parse trees must be cloned before removing their rightmost symbols (when found ambiguous).
 *
 * In a binary rule, the first branch is reduced down to the terminal symbol. That path can be found ambiguous and have rightmost symbols removed. Then, it might be found ambiguous again, but using symbols that were previously removed.
 *
 * S -> X-par -> X -> 'x'                   S -> X-par                   S -> X -> 'x'
 *   -> X-par                         (trim)  -> X-par      (other ambig)  -> X -> 'x'
 * S -> X-par-par -> X-par -> X -> 'x'  =>  S -> X-par-par -> X-par  =>  S -> X-par-par -> X-par (missing syms)
 *   -> X-par-par -> X-par                    -> X-par-par -> X-par        -> X-par-par -> X-par -> X -> 'x'
 */
var ambigMultPathsAtDiffDepths = g.newSymbol('ambig', 'mult', 'paths', 'at', 'diff', 'depths')
ambigMultPathsAtDiffDepths.addRule({ RHS: [ x, x ] })
ambigMultPathsAtDiffDepths.addRule({ RHS: [ xPar, xPar ] })
ambigMultPathsAtDiffDepths.addRule({ RHS: [ xParPar, xParPar ] })

/**
 * Ambiguity created by a pair of paths, each ambiguous with at least one other path.
 *
 * Both paths may find their other instance of ambiguity before the instance they share. Hence, cannot stop a check for ambiguity after finding first instance of ambiguity; otherwise, that shared instance will not be reached.
 *
 * - If only one of the pair of ambiguous paths has more than one instance of ambiguity, then it can be stopped early because its other instances of ambiguity will be reached by the other paths (which have one instance of ambiguity).
 *
 * - Must be terminal rules, otherwise the ambiguity can be found at different instances of the path (i.e., different lengths) rather than at a single instance.
 *
 * The third pair of ambiguous paths will not be reached if both paths are stopped earlier:
 * S -> 'x'         S -> 'x'         S -> X1 -> 'x'
 * S -> X1 -> 'x'   S -> X2 -> 'x'   S -> X2 -> 'x'
 */
var ambigMultPathsAtSameDepths = g.newSymbol('ambig', 'mult', 'paths', 'at', 'same', 'depth')
ambigMultPathsAtSameDepths.addRule({ terminal: true, RHS: 'x' })
ambigMultPathsAtSameDepths.addRule({ RHS: [ x ] })
ambigMultPathsAtSameDepths.addRule({ RHS: [ xDup ] })

/**
 * Ambiguity created by display text substitution.
 *
 * S -> X1 -> 'x' - 'y'
 * S -> X2 -> 'x' - 'y'
 */
var ambigTextSubstitution = g.newSymbol('ambig', 'text', 'substitution')
ambigTextSubstitution.addRule({ RHS: [ xToY ] })
ambigTextSubstitution.addRule({ RHS: [ xToYDup ] })

/**
 * Unambiguity created by display text substitution.
 *
 * S -> X -> 'x' - 'y'
 * S -> X2 -> 'x' - 'y'
 */
var unambigTextSubstitution = g.newSymbol('unambig', 'text', 'substitution')
unambigTextSubstitution.addRule({ RHS: [ x ] })
unambigTextSubstitution.addRule({ RHS: [ xToY ] })

/**
 * Ambiguity created by conjugated display text objects.
 *
 * XY -> pl   -> 'x'
 *    -> 3-sg -> 'y'
 * S -> XY1-pl -> 'x'|'y' -> 'x'
 * S -> XY2-pl -> 'x'|'y' -> 'x'
 */
var ambigConjugatedText = g.newSymbol('ambig', 'conjugated', 'text')
ambigConjugatedText.addRule({ RHS: [ xyVerb ], personNumber: 'pl' })
ambigConjugatedText.addRule({ RHS: [ xyVerbDup ], personNumber: 'pl' })

/**
 * Unambiguity created by conjugated display text objects.
 *
 * XY -> pl   -> 'x'
 *    -> 3-sg -> 'y'
 * S -> XY1-pl   -> 'x'|'y' -> 'x'
 * S -> XY2-3-sg -> 'x'|'y' -> 'y'
 */
var unambigUnconjugatedText = g.newSymbol('unambig', 'conjugated', 'text')
unambigUnconjugatedText.addRule({ RHS: [ xyVerb ], personNumber: 'pl' })
unambigUnconjugatedText.addRule({ RHS: [ xyVerbDup ], personNumber: 'threeSg' })

/**
 * Ambiguity created by unconjugated display text objects. This requires a deep comparison of the text object values to detect the ambiguity.
 *
 * XY -> pl   -> 'x'
 *    -> 3-sg -> 'y'
 * S -> XY1-pl -> 'x'|'y'
 * S -> XY2-pl -> 'x'|'y'
 */
var ambigUnconjugatedText = g.newSymbol('ambig', 'unconjugated', 'text')
ambigUnconjugatedText.addRule({ RHS: [ xyVerb ] })
ambigUnconjugatedText.addRule({ RHS: [ xyVerbDup ] })

/**
 * Ambiguity created by inserted display text.
 *
 * S -> X  -> 'x'
 *   -> Y  -> 'y'
 * S -> XY -> 'x' 'y' -> 'x y'
 */
var ambigInsertedText = g.newSymbol('ambig', 'inserted', 'text')
ambigInsertedText.addRule({ RHS: [ x, y ] })
ambigInsertedText.addRule({ RHS: [ xyToX, yInsert ] })

/**
 * Unambiguity created by inserted display text.
 *
 * S -> X -> 'x'
 * S -> X -> 'x' 'y' -> 'x y'
 */
var unambigInsertedText = g.newSymbol('unambig', 'inserted', 'text')
unambigInsertedText.addRule({ RHS: [ x ] })
unambigInsertedText.addRule({ RHS: [ x, yInsert ] })

/**
 * Ambiguity created by inserted text across multiple insertions. This requires concatenating the display text to detect the ambiguity.
 *
 * S -> X     -> 'x' 'x' 'y' -> 'x x y'
 * S -> X-par -> X 'x y'     -> 'x' 'x y' -> 'x x y'
 */
var ambigInsertedTextSpanningMultRules = g.newSymbol('ambig', 'inserted', 'text', 'spanning', 'mult', 'rules')
ambigInsertedTextSpanningMultRules.addRule({ RHS: [
	x,
	g.newBinaryRule({ RHS: [ xInsert, yInsert ] }),
] })
ambigInsertedTextSpanningMultRules.addRule({ RHS: [ xPar, xyTermInsert ] })

/**
 * Ambiguity created by semantics of rules with display text substitution.
 *
 * S -> X1 -> 'x' func(arg)
 * S -> X2 -> 'y' func(arg)
 */
var ambigSemantics = g.newSymbol('ambig', 'semantics')
ambigSemantics.addRule({ RHS: [ x ], semantic: semanticFuncReduced })
ambigSemantics.addRule({ RHS: [ xToY ], semantic: semanticFuncReduced })

/**
 * Unambiguity created by semantics of rules with display text substitution.
 *
 * S -> X1 -> 'x' arg
 * S -> X2 -> 'y' func(arg)
 */
var unambigSemantics = g.newSymbol('unambig', 'semantics')
unambigSemantics.addRule({ RHS: [ x ], semantic: semanticArg })
unambigSemantics.addRule({ RHS: [ xToY ], semantic: semanticFuncReduced })

/**
 * Ambiguity created by semantics of rules with inserted display text.
 *
 * Ambiguity created by semantics
 * S -> X1 -> 'x' func(arg)
 * S -> X2 -> 'x x' func(arg)
 */
var ambigSemanticsInsertedText = g.newSymbol('ambig', 'semantics', 'inserted', 'text')
ambigSemanticsInsertedText.addRule({ RHS: [ x ], semantic: semanticFuncReduced })
ambigSemanticsInsertedText.addRule({ RHS: [
	g.newBinaryRule({ RHS: [ x, xInsert ], semantic: semanticFuncReduced }),
] })

/**
 * Ambiguity created by semantics across multiple rules.
 *
 * S -> X        -> 'x' func(arg)
 * S -> X func() -> 'x' func() arg -> 'x' func(arg)
 */
var ambigSemanticsMultRules = g.newSymbol('ambig', 'semantics', 'mult', 'rules')
ambigSemanticsMultRules.addRule({ RHS: [ x ], semantic: semanticFuncReduced })
ambigSemanticsMultRules.addRule({ RHS: [
	g.newBinaryRule({ RHS: [ x, xInsertSemanticArg ], semantic: semanticFunc }),
] })

/**
 * Ambiguity created by inserted semantics.
 *
 * S -> X func() -> 'x' arg func()      -> 'x' func(arg)
 * S -> X func() -> 'x' 'x' argv func() -> 'x x' func(arg)
 */
var ambigInsertedSemantic = g.newSymbol('ambig', 'inserted', 'semantics')
ambigInsertedSemantic.addRule({ RHS: [ xSemanticArg ], semantic: semanticFunc })
ambigInsertedSemantic.addRule({ RHS: [
	g.newBinaryRule({ RHS: [ xInsertSemanticArg, x ] }),
], semantic: semanticFunc })

/**
 * Unambiguity created by inserted semantics.
 *
 * S -> X -> 'x'
 * S -> X -> 'x' 'x' arg
 */
var unambigInsertedSemantic = g.newSymbol('unambig', 'inserted', 'semantic')
unambigInsertedSemantic.addRule({ RHS: [ x ] })
unambigInsertedSemantic.addRule({ RHS: [ x, xInsertSemanticArg ] })

/**
 * Ambiguity created by semantics parsed in a different order. This requires sorting semantic arguments to detect the ambiguity.
 *
 * S -> X1 -> 'x' arg, 'x' func(arg) -> 'x x' arg,func(arg)
 *   -> X2 -> 'x' func(arg), 'x' arg -> 'x x' arg,func(arg)
 */
var ambigSemanticsSorted = g.newSymbol('ambig', 'semantics', 'sorted')
ambigSemanticsSorted.addRule({ RHS: [ xSemanticArg, xInsertSemanticFuncReduced ] })
ambigSemanticsSorted.addRule({ RHS: [
	g.newBinaryRule({ RHS: [ xInsertSemanticFuncReduced, xSemanticArg ] }),
] })

/**
 * Ambiguity created by a semantic on an `<empty>` terminal rule.
 *
 * S -> X arg
 * S -> X-par -> X arg
 */
var ambigEmptySemantic = g.newSymbol('ambig', 'empty', 'semantic')
ambigEmptySemantic.addRule({ RHS: [ x ], semantic: semanticArg })
ambigEmptySemantic.addRule({ RHS: [ xPar, emptySemanticArg ] })


// Generate edit rules.
g.createEditRules()

var grammar = g.getGrammar()

// Check for ill-formed tests.
var ruleSets = grammar.ruleSets
for (var nontermSym in ruleSets) {
	if (/^\[(ambig|unambig)-/.test(nontermSym) && ruleSets[nontermSym].length < 2) {
		util.logError('Ambiguous test symbol has < 2 rules:', util.stylize(nontermSym))
		util.log('  ' + symbol.creationLines[nontermSym])
		throw 'Ill-formed test'
	}
}

// Export grammar.
module.exports = grammar