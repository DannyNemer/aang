***Note**: This documentation is temporary and incomplete as I evaluate the best method to present the material. See over 100,000 words of extensive, excellent, existing documentation throughout the source files in [`/lib/`](https://github.com/DannyNemer/aang/tree/master/lib).*

# `parse`
	Usage
	  node parse <query> [options]

	Description
	  Parses <query> and outputs the k-best parse trees.

	Options
	  -k                        The maximum number of parse trees to find.                  [default: 7]
	  -q, --quiet               Suppress parse results from output.                            [boolean]
	  -b, --benchmark           Benchmark each test's parse duration.                          [boolean]
	  -c, --costs               Print the parse costs.                                         [boolean]
	  -a, --ambiguity           Print instances of semantic ambiguity.                         [boolean]
	  -t, --trees               Print the parse trees.                                         [boolean]
	  -n, --tree-node-costs     Include in parse trees each node's path cost.                  [boolean]
	  -r, --tree-token-ranges   Include in parse trees each node's token range.                [boolean]
	  -s, --semantics           Print the semantic representation of each parse tree.
	                                                                           [boolean] [default: true]
	  -o, --object-semantics    Print object representations of the semantics.                 [boolean]
	  -p, --parse-stack         Print the parse stack.                                         [boolean]
	  -f, --parse-forest        Print an equational representation of the parse forest.        [boolean]
	  -g, --parse-forest-graph  Print a graph representation of the parse forest.              [boolean]
	  -h, --help                Display this screen.                                           [boolean]

	Examples
	  node parse "people who follow me" -k=5 -t   Finds the 5-best parse trees for the query, and
	                                              includes the parse trees in the parse results.
	  node parse "people I follow" -sfq           Finds the 7-best parse trees for the query, prints the
	                                              parse forest and parse stack, but does not print the
	                                              parse results.
	  node parse "males my followers follow" -bc  Finds the 7-best parse trees for the query, prints the
	                                              duration of the parse, and includes the parse tree
	                                              costs in the parse results.