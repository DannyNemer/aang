var g = require('../grammar')

// (people) I (follow); (people followed by) me
this.plain = new g.Symbol(1, 'sg')
this.plain.addRule({ terminal: true, RHS: 'I' })
this.plain.addRule({ terminal: true, RHS: 'me' })