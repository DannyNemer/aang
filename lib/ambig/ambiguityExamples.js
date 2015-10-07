/**
 * Rules demonstrating each possible instance of ambiguity.
 *
 * Used by `checkForAmbiguity` to test the coverage of its algorithm. When used, `checkForAmbiguity` should print warnings for each of the following cases.
 */

var g = require('../grammar/grammar')


var x = g.newSymbol('x').addRule({ terminal: true, RHS: 'x' })
var y = g.newSymbol('y').addRule({ terminal: true, RHS: 'y' })
var z = g.newSymbol('z').addRule({ terminal: true, RHS: 'z' })

var xyTerm = g.newSymbol('xy', 'term').addRule({ terminal: true, RHS: 'x y'})
var yzTerm = g.newSymbol('yz', 'term').addRule({ terminal: true, RHS: 'y z'})

var xPar = g.newSymbol('x', 'par').addRule({ RHS: [ x ] })
var yPar = g.newSymbol('y', 'par').addRule({ RHS: [ y ] })
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


/**
 * Ambiguity at terminal symbols with paths of identical lengths.
 *
 * S -> X1 -> 'x'
 * S -> X2 -> 'x'
 */
var ambigTermsSameLengths = g.newSymbol('ambig', 'terms', 'same', 'lengths')
ambigTermsSameLengths.addRule({ RHS: [ x ] })
ambigTermsSameLengths.addRule({ RHS: [ xDup ] })

/**
 * Ambiguity at terminal symbols with paths of different lengths.
 *
 * S -> 'x'
 * S -> X-par-par -> X-par -> X -> 'x'
 */
var ambigTermsDiffLengths = g.newSymbol('ambig', 'terms', 'diff', 'lengths')
ambigTermsDiffLengths.addRule({ terminal: true, RHS: 'x' })
ambigTermsDiffLengths.addRule({ RHS: [ xParPar ] })

/**
 * Ambiguity at nonterminal symbols with paths of identical lengths.
 *
 * S -> X-par -> X
 * S -> X-par-dup -> X
 */
var ambigNontermsSameLengths = g.newSymbol('ambig', 'nonterms', 'same', 'lengths')
ambigNontermsSameLengths.addRule({ RHS: [ xPar ] })
ambigNontermsSameLengths.addRule({ RHS: [ xParDup ] })

/**
 * Ambiguity at nonterminal symbols with paths of different lengths.
 *
 * S -> X
 * S -> X-par-par -> X-par -> X
 */
var ambigNontermsDiffLengths = g.newSymbol('ambig', 'nonterms', 'diff', 'lengths')
ambigNontermsDiffLengths.addRule({ RHS: [ x ] })
ambigNontermsDiffLengths.addRule({ RHS: [ xParPar ] })

/**
 * Ambiguity with paths containing binary rules.
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
 * Ambiguity with terminal rules, same number of terminal symbols (i.e., branches).
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
 * Ambiguity with terminal rules, different number of terminal symbols (i.e., branches).
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
 * When `findAll` is `true`, avoid printing different instances of the same ambiguous relationship by removing a pair's identical rightmost symbols (using `diffTrees()`) and comparing to previous pairs.
 *
 * S -> X           (other ambig)  S -> X -> x           (trim)  S -> X           (identical so
 * S -> X-par -> X       =>        S -> X-par -> X -> x    =>    S -> X-par -> X   not printed)
 */
var ambigDupAvoidedByTrim = g.newSymbol('ambig', 'dup', 'avoided', 'by', 'trim')
ambigDupAvoidedByTrim.addRule({ RHS: [ x ] })
ambigDupAvoidedByTrim.addRule({ RHS: [ xPar ] })

/**
 * Ambiguity using a path built from a path used in an earlier instance of ambiguity.
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
 * Multiple instances of ambiguity within the same pair of start rules from the root nonterminal symbol.
 * By default, when the `findAll` option is set to `false`, the ambiguity check will only print one instance of ambiguity for each pair of rules from the root nonterminal symbol.
 * This exemplifies when one would want `findAll` set to `true`.
 *
 * S -> X-or-Y -> X   S -> X-or-Y -> Y
 * S -> X             S -> Y
 */
var ambigMultSameStartRules = g.newSymbol('ambig', 'mult', 'same', 'start', 'rules')
ambigMultSameStartRules.addRule({ RHS: [ xOrY ] })
ambigMultSameStartRules.addRule({ RHS: [ x ] })
ambigMultSameStartRules.addRule({ RHS: [ y ] })

/**
 * Ambiguity with a recursive rule (i.e., a rule whose RHS contains the LHS).
 * - The grammar enforces symbols with recursive rules to require a non-recursive rule to be the stop case.
 * - In the grammar, recursive rules are made with `<empty>` in createEditRules; however, here they are made manually (without createEditRules).
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
 * Ambiguity where one of the rules' RHS contains a non-ambiguous recursive symbol.
 * Ambiguity occurs only in these rules, not in the recursive symbol's rules alone.
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
 * Ambiguity where the start rule is recursive and the path uses multiple instances of a single rule.
 * Hence, cannot prevent paths where start rule is recursive and contains multiple instances of the same rule.
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
 * Multiple instances of ambiguity within the same pair of start rules from the root nonterminal symbol.
 * The presence of multiple instances, as opposed to one, is caused by an ambiguous symbol in one of the rules' RHS.
 * By default, when the `findAll` option is set to `false`, the ambiguity check will only print one instance of ambiguity for each pair of rules from the root nonterminal symbol.
 * This is also an example of a single instance of a path being ambiguous with multiple paths from the same start rule. Hence, when `findAll` is `true`, cannot `break` after finding ambiguity with a pair of paths.
 *
 * S -> X-or-X-dup -> X -> x   S -> X-or-X-dup -> X-dup -> x
 * S -> X -> x                 S -> X -> x
 */
var ambigMultSameStartRulesSubambig = g.newSymbol('ambig', 'mult', 'same', 'start', 'rules', 'subambig')
ambigMultSameStartRulesSubambig.addRule({ RHS: [ ambigTermsSameLengths ] })
ambigMultSameStartRulesSubambig.addRule({ RHS: [ x ] })

/**
 * A path ambiguous with two other paths at different rightmost symbols.
 * Hence, parse trees must be cloned before removing their rightmost symbols (when found ambiguous).
 * In a binary rule, the first branch is completed down to the terminal symbol. That path can be found ambiguous, have rightmost symbols removed. Then, it might be found ambiguous again, but using symbols that were previously removed.
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
 * A pair of ambiguous paths, each ambiguous with at least one other path.
 * Both may find their other instance of ambiguity before the instance they share.
 * Hence, cannot stop a check for ambiguity after finding first instance of ambiguity; otherwise, that shared instance will not be reached.
 * - If only one of the pair of ambiguous paths has more than one instance of ambiguity, then it can be stopped early because its other instances of ambiguity will be reached by the other paths (which have one instance of ambiguity).
 * - Must be terminal rules, otherwise the ambiguity can be found at different instances of the path (i.e., different lengths) rather than at a single instance.
 * The third pair of ambiguous paths will not be reached if both paths are stopped earlier:
 * S -> 'x'         S -> 'x'         S -> X1 -> 'x'
 * S -> X1 -> 'x'   S -> X2 -> 'x'   S -> X2 -> 'x'
 */
var ambigMultPathsAtSameDepths = g.newSymbol('ambig', 'mult', 'paths', 'at', 'same', 'depth')
ambigMultPathsAtSameDepths.addRule({ terminal: true, RHS: 'x' })
ambigMultPathsAtSameDepths.addRule({ RHS: [ x ] })
ambigMultPathsAtSameDepths.addRule({ RHS: [ xDup ] })

// Export grammar.
module.exports = require('../grammar/symbol').ruleSets