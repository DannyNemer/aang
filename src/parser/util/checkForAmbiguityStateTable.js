// A failed attempt at finding ambgiuity in a state table.
// This alogorithm will likely need to be top-down

var util = require('../util')
var grammar = require('../aang.json').grammar
var st = new (require('../parser/StateTable'))(grammar, '[start]')


console.time('test')
var states = st.shifts
// Attempt at not beginning with statetable to limit search scope
for (var s = 2, statesLen = states.length; s < statesLen; ++s) {
	var paths = []
	shiftForward({ syms: [], prevStateIdxes: [ s ], stateIdxes: [] }, s)
}
console.timeEnd('test')

function shiftForward(path, stateIdx) {
	var state = states[stateIdx]

	// Attempts to limit search scope
	if (state.isFinal || paths.length > 3e5 || path.stateIdxes.length > 3) {
		// for (var p = 0, pathsLen = paths.length; p < pathsLen; ++p) {
		// 	var otherPath = paths[p]
		// 	if (util.arraysMatch(path.stateIdxes, otherPath.stateIdxes)) {
		// 		util.log(path, otherPath)
		// 	}
		// }

		// paths.push(path)
		return
	}

	var pathSyms = path.syms

	// Shift
	// Limit complexity of trees
	if (path.prevStateIdxes.length <= 2) {
		var shifts = state.shifts
		for (var s = 0, shiftsLen = shifts.length; s < shiftsLen; ++s) {
			var shift = shifts[s]

			var newPath = {
				syms: pathSyms.slice(),
				// Previous states to return to after reducing
				prevStateIdxes: path.prevStateIdxes.slice(),
				// Match identical right-most symbols by their shifts
				stateIdxes: path.stateIdxes.slice(),
			}
			newPath.syms.push({ symbol: shift.sym.name })
			newPath.prevStateIdxes.push(shift.stateIdx)
			newPath.stateIdxes.push(shift.stateIdx)

			shiftForward(newPath, shift.stateIdx)
		}
	}

	// Reduce
	var reds = state.reds
	for (var r = 0, redsLen = reds.length; r < redsLen; ++r) {
		var red = reds[r]

		if (red.binary) {
			var newPath = {
				syms: pathSyms.slice(0, -2),
				prevStateIdxes: path.prevStateIdxes.slice(0, -2),
				stateIdxes: path.stateIdxes,
			}
			// Replace previous two node with new parent node
			newPath.syms.push({ symbol: red.LHS.name, children: pathSyms.slice(-2) })
		}

		else {
			var newPath = {
				syms: pathSyms.slice(0, -1),
				prevStateIdxes: path.prevStateIdxes.slice(0, -1),
				stateIdxes: path.stateIdxes,
			}
			// Replace previous node with new parent node
			newPath.syms.push({ symbol: red.LHS.name, children: pathSyms.slice(-1) })
		}

		if (newPath.prevStateIdxes.length) {
			// Use state index of previous shift
			var nextStateIdx = next(red.LHS.name, newPath.prevStateIdxes[newPath.prevStateIdxes.length - 1])
			newPath.prevStateIdxes.push(nextStateIdx)
			shiftForward(newPath, nextStateIdx)
		} else {
			// Look for paths with identical right-most symbols
			for (var p = 0, pathsLen = paths.length; p < pathsLen; ++p) {
				var otherPath = paths[p]
				// Match identical right-most symbols by their shifts
				if (util.arraysMatch(newPath.stateIdxes, otherPath.stateIdxes)) {
					util.log(path, otherPath)
				}
			}

			paths.push(newPath)
		}
	}
}

function next(lastSym, stateIdx) {
	var shifts = states[stateIdx].shifts
	for (var s = 0, shiftsLen = shifts.length; s < shiftsLen; ++s) {
		var shift = shifts[s]
		if (shift.sym.name === lastSym) {
			return shift.stateIdx
		}
	}
}