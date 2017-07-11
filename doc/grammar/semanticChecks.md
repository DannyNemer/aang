# `semanticChecks`

### `semanticChecks.removeRulesMissingRequiredSemantics(ruleSets, [printWarnings])`
Iterates over rules in `ruleSets`, invoking `semanticChecks.isRuleMissingReducedSemantic()` on each rule, removing non-edit rules that lack and can not produce a reduced semantic if required for themselves or their ancestor rules.

While checking ancestor rules for a non-reduced semantic, if finds a parent rule this method has yet to evaluate, recursively evaluates that rule first and removes it from the grammar if necessary. Must check parent rules first in order to only remove the problematic rules that always fail, and not the descendant rules that only fail sometimes because of the problematic ancestor rule.

Does not check edit-rules because if an edit-rules lacks a needed semantic, then that condition will also be true for the original rule from which it was derived.

Invoke method within `removeIllFormedRulesAndSyms` to remove any rule-less or unreachable nonterminal symbols that result from the removal of rules here.

Given this procedure, if a `Category` is created, which adds the essential base rules, but has neither entities nor rules specific to the category, then all rules and symbols for that category are removed because none can produce valid parse trees.

#### Arguments
- `ruleSets` *(Object)*: The map of the grammar's nonterminal symbols to rules.
- `[printWarnings]` *(boolean)*: Specify printing warnings for rules that can not produce a required reduced semantic.

#### Returns
*(boolean)*: Returns `true` if any rules were removed, else `false`.

### `semanticChecks.isRuleMissingReducedSemantic(ruleSets, nontermSym, rule, [printWarnings], [printFailedPaths])`
Checks if `rule` lacks and can not produce a reduced semantic if required for itself or its ancestor rules in `ruleSets`. If so, removes `rule` from the grammar if it exists in `ruleSets` (i.e., `rule` is a non-edit rule).

First, checks if `rule` has a reduced semantic. If not, checks if `rule.rhs` can produce a reduced semantic. (Must check for a reduced semantic, instead of any semantic, otherwise would not detect pairs of recursive rules that can never be reduced.) If neither has nor can produce a reduced semantic, checks if `rule` or all ancestor rules has a non-reduced semantic (which requires a semantic). If all do (i.e., `rule` fails in every possible path), then removes `rule` from grammar if it exists in `ruleSets` (i.e., `rule` is a non-edit rule), and returns `true` for all rules (i.e., edit- and non-edit-rules).

If at least one path can incorporate `rule` properly, i.e., the path does not require `rule` produce a reduced semantic, then returns `false`. Only rules that always fail are excluded from the output grammar.

For example, consider the following CFG:

	S -> A B | A, intersect()
	A -> C D | D
	C -> "my", `objects(me)`
	D -> "objects"
	B -> "with property x", objects-property(x)

The following parse trees constructed from the grammar are semantically legal:

	S -> A -> C -> "my"      => objects(me)
	       -> D -> "objects"
	S -> A -> D -> "objects"    => objects-property(x)
	  -> B -> "with property x"

The following parse tree constructed from the grammar is semantically legal:

	S -> A -> D -> "object" => null

As shown, `S -> A` and `A -> D` can both be used in semantically legal parse trees, though also fail to produce required semantics in other parse trees. Hence, only remove semantics if they can not produce a reduced semantic but are already required to by ancestor rules.

While checking ancestor rules for a non-reduced semantic, if finds a parent rule this module has yet to evaluate for producing any required semantic, recursively evaluates that rule first and removes it from the grammar if necessary (i.e., if can not produce a required reduced semantic). Must check parent rules first in order to only remove the problematic rules that always fail, and not the descendant rules that only fail sometimes because of the problematic ancestor rule.

Invoke method within `removeIllFormedRulesAndSyms` to remove any rule-less or unreachable nonterminal symbols that result from the removal of rules here.

#### Arguments
- `ruleSets` *(Object)*: The map of the grammar's nonterminal symbols to rules.
- `nontermSym` *(string)*: The LHS (nonterminal) symbol of the rule to check.
- `rule` *(Object)*: The rule `nontermSym` produces to check.
- `[printWarnings]` *(boolean)*: Specify printing warnings if `rule` (or ancestor rules) can not produce a required reduced semantic.
- `[printFailedPaths]` *(boolean)*: If `printWarnings` is truthy and `rule` (or ancestor rules) can not produce a reduced semantic, specify printing graph representations of the parse tree paths that require `rule` (or ancestor rules) to produce a reduced semantic, if any.

#### Returns
*(boolean)*: Returns `true` if `rule` lacks and can not produce a reduced semantic required for itself or its ancestor rules, else `false`.