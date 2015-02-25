var g = require('../grammar')

// (people who) are (followed by me)
this.beNon1Sg = new g.Symbol('be', 'non', '1sg')
this.beNon1Sg.addRule({ terminal: true, RHS: 'are', insertionCost: 1 })
this.beNon1Sg.addRule({ terminal: true, RHS: 'is|are|be being' }) // rejected
this.beNon1Sg.addRule({ terminal: true, RHS: 'being|been' }) // rejected

// (people who have) been (followed by me)
this.bePast = new g.Symbol('be', 'past')
this.bePast.addRule({ terminal: true, RHS: 'been' })

// (people who) have (been followed by me)
this.have = new g.Symbol('have')
this.have.addRule({ terminal: true, RHS: 'have' })