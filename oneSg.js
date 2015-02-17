var g = require('./grammar')

// (people) I (follow)
this.plain = new g.Symbol(1, 'sg')
this.plain.addRule({ RHS: [ 'I' ] })