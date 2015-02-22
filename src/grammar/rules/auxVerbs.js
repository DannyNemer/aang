var g = require('../grammar')

// (people who) are (followed by me)
this.beNon1Sg = new g.Symbol('be', 'non', '1sg')
this.beNon1Sg.addRule({ RHS: [ 'are' ] })
this.beNon1Sg.addRule({ RHS: [ 'is|are|be being' ] }) // rejected