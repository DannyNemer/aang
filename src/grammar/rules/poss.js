var g = require('../grammar')
var oneSg = require('./oneSg')

this.determinerOmissible = new g.Symbol('poss', 'determiner', 'omissible')
// my (followers)
this.determinerOmissible.addRule({ RHS: [ oneSg.possOmissible ]})