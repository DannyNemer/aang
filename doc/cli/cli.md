***Note**: This documentation is temporary and incomplete as I evaluate the best method to present the material. See over 100,000 words of extensive, excellent, existing documentation throughout the source files in [`/lib/`](https://github.com/DannyNemer/aang/tree/master/lib).*

# `cli`
	Usage
	  node cli [options]

	Description
	  The command line interface for aang.

	  Contains the following built-in programs:
	   • [query] - Parses the provided query and outputs the k-best parse trees.

	   • `.test` - Parses the suite of test queries and checks output conforms to
	   the test's specifications.

	   • `.benchmark` - Benchmarks the duration of parsing the queries in the test
	   suite.

	   • `.buildGrammar` - Generates and outputs the grammar containing the grammar
	   rules, semantics, entities, and deletables, for use with the parser.

	   • `.ambiguityCheck` - Finds and prints instances of ambiguity in the grammar.

	   • `.stateTable` - Prints the state table generated from the grammar.

	   • `.archive*` - Saves output of program *. Includes: `.archiveTest`,
	   `.archiveTestSmall`, `.archiveTestQuiet`, `.archiveGrammar`,
	   `.archiveAmbigCheck`, `.archiveStateTable`, `.archiveAll`.

	   • `.restoreGrammar` - Copies the last output of `.archiveGrammar` to the
	   `.buildGrammar` output path.

	   • `.diff*` - Compares last archived output of program * to current output of
	   the same program. Includes: `.diffTest`, `.diffTestSmall, `.diffTestQuiet`,
	   `.diffGrammar`, `.diffAmbigCheck`, `.diffStateTable`.

	  Enables configuration of CLI environment variables which are passed as options
	  when executing the above programs.

	  Each program is spawn as a child process. This automatically enables any
	  changes to modules outside the CLI, allows the user to kill any process (with
	  `^C`) without exiting the CLI, and improves benchmark result consistency by
	  mitigating the impact of process caches.

	Options
	  -h, --help  Display this screen.                                     [boolean]