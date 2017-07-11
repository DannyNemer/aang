# `Parser`

### `Parser(stateTable)`
The `Parser` constructor.

Accepts a `StateTable` instance instead of instantiating it itself because multiple `Parser` instances can be created for the same `StateTable` instance.

#### Arguments
- `stateTable` *(StateTable)*: The `StateTable` instance generated from the grammar.

### `ParseResults`
The parse results containing the `k`-best parse trees output by `pfsearch` and the associated parse statistics.

#### Properties
- `trees` *(Object[]|undefined)*: The `k`-best parse trees output by `pfsearch` if the parse reaches the start symbol, else `undefined`.
- `failedInitStartSym` *(boolean)*: Indicates the parse initially failed to reach the start symbol (which required marking all input tokens as deletable and reparsing).
- `failedInitLegalTrees` *(boolean)*: Indicates the parse initially failed to generate any legal parse trees due to illegal semantics (which required marking all input tokens as deletable and reparsing).
- `pathCount` *(number)*: The number of paths created in `pfsearch`. (If `failedInitLegalTrees` is `true`, includes the number of paths created in the first `pfsearch` invocation.)
- `ambiguousTreeCount` *(number)*: The number of ambiguous parse trees discarded in `pfsearch`.

### `Parser.prototype.parse(query, [k=7], [options={}])`
Parses `query` using the state table generated for the grammar and returns the `k`-best parse trees, along with the trees' associated semantic trees and conjugated display texts.

#### Arguments
- `query` *(string)*: The input query to parse.
- `[k=7]` *(number)*: The maximum number of parse trees to find.
- `[options={}]` *(Object)*: The `pfsearch` options object.
- `[options.buildTrees=false]` *(boolean)*: Specify constructing parse trees for printing.
- `[options.printAmbiguity=false]` *(boolean)*: Specify printing instances of ambiguity.

#### Returns
*(ParseResults)*: Returns the `k`-best parse trees and associated parse statistics.