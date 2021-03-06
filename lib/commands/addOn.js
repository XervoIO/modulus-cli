var xervo = require('../xervo')
var addOnController = require('../controllers/addOn')
var projectController = require('../controllers/project')
var projectCommands = require('../commands/project')
var async = require('async')
var userConfig = require('../common/api').userConfig
var error = require('../common/error')
var util = require('util')

var addOn = {}

// -----------------------------------------------------------------------------
// Gets a project via project name param or project prompt
// -----------------------------------------------------------------------------
addOn.getProject = function (projectName, callback) {
  projectController.find({
    userId: userConfig.data.userId
  },
  function (err, projects) {
    if (err) {
      err = error.handleApiError(err, 'GET_PROJECTS', callback)

      if (err.length > 0) {
        return callback(err)
      }
    }

    if (projects.length === 0) {
      return callback('You currently have no projects. One can be created using the create command.')
    }

    projectCommands.chooseProjectPrompt(projects, projectName, function (err, result) {
      if (err) {
        return callback(err)
      }

      if (!result) {
        return callback('You must select a project.')
      }

      callback(null, result)
    })
  })
}

// -----------------------------------------------------------------------------
// Prompts to choose an addon from a list
// -----------------------------------------------------------------------------
addOn.chooseAddOnPrompt = function (addons, callback) {
  if (addons.length === 0) {
    callback('This project has no provisioned add-ons.')
  }

  xervo.io.print('Please choose an add-on:'.input)

  for (var a = 0; a < addons.length; a++) {
    xervo.io.print(('  ' + (a + 1) + ') ' + addons[a].addon_name).input)
  }

  xervo.io.prompt.get([{
    name: 'addon',
    description: 'Addon?',
    type: 'number',
    warning: 'Add-On choice has to be between 1 and ' + addons.length,
    minimum: 1,
    maximum: addons.length
  }], function (err, result) {
    if (err) {
      return error.handlePromptError(err, callback)
    }

    xervo.io.print(util.format('Selecting %s\n', addons[result.addon - 1].addon_name.data))
    callback(null, addons[result.addon - 1])
  })
}

// -----------------------------------------------------------------------------
// Prompts to choose an add-on region from a list
// -----------------------------------------------------------------------------
addOn.chooseRegionPrompt = function (addon, callback) {
  if (!addon.regions || addon.regions.length === 0) {
    return callback(null, '')
  }

  if (addon.regions.length === 1) {
    return callback(null, addon.regions[0])
  }

  xervo.io.print('Please choose a region:'.input)

  for (var i = 0; i < addon.regions.length; i++) {
    xervo.io.print(('  ' + (i + 1) + ') ' + addon.regions[i]).input)
  }

  xervo.io.prompt.get([
    {
      name: 'region',
      description: 'Region?',
      type: 'number',
      warning: 'Region choice has to be between 1 and ' + addon.regions.length,
      minimum: 1,
      maximum: addon.regions.length
    }
  ], function (err, result) {
    if (err) {
      return error.handlePromptError(err, callback)
    }

    xervo.io.print(util.format('Select %s\n', addon.regions[result.region - 1].data))
    callback(null, addon.regions[result.region - 1])
  })
}

// -----------------------------------------------------------------------------
// Prints a list of Add-Ons
// -----------------------------------------------------------------------------
addOn.printList = function (projectName, addons) {
  xervo.io.print('Add-Ons provisioned for ' + projectName.verbose)

  if (addons instanceof Array === false || addons.length === 0) {
    xervo.io.print('No Add-Ons provisioned.')
  } else {
    for (var a = 0; a < addons.length; a++) {
      xervo.io.print('--------------------------------------'.grey)

      // Capitalized name.
      xervo.io.print(addons[a].addon_name.yellow)

      // Id
      xervo.io.print(('Id: ' + addons[a].addon_id).grey)

      // Plan
      xervo.io.print(('Plan: ' + addons[a].plan).grey)

      // Config
      for (var k in addons[a].config) {
        xervo.io.print((k + ' = ' + addons[a].config[k]).grey)
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Gets the Add-Ons provided to a project.
// -----------------------------------------------------------------------------
addOn.getForProject = function (projectName, callback) {
  var project = null

  async.waterfall([
    function (cb) {
      addOn.getProject(projectName, cb)
    },

    function (pro, cb) {
      project = pro
      addOnController.getForProject(project.id, cb)
    },

    function (addons, cb) {
      // Newline
      console.log()

      addOn.printList(project.name, addons)
      cb(null)
    }
  ],
  function (err) {
    callback(err)
  })
}

// -----------------------------------------------------------------------------
// Provisions the specified add-on for the specified project.
// -----------------------------------------------------------------------------
addOn.provision = function (projectName, addon, callback) {
  if (typeof addon !== 'string' || addon.length === 1) {
    return callback('Please provide an add-on and plan. Use --help for the command format.')
  }

  addon = addon.split(':')

  if (addon.length === 1) {
    return callback('A plan is required to provision an add-on.')
  }

  var project
  async.waterfall([
    function (cb) {
      addOn.getProject(projectName, cb)
    },

    function (pro, cb) {
      project = pro
      addOnController.getById(addon[0], cb)
    },

    function (addonData, cb) {
      addOn.chooseRegionPrompt(addonData, cb)
    },

    function (region, cb) {
      addOnController.provision(project.creator, project.id, addon[0], addon[1], region, cb)
    },

    function (add, cb) { // `add` is ignored
      addOnController.getForProject(project.id, cb)
    },

    function (addons) {
      // Newline
      console.log()

      addOn.printList(project.name, addons)

      console.log()
      xervo.io.success('Add-On \'' + addon[0] + '\' provisioned.')
    }
  ],
  function (err) {
    if (err) {
      err = error.handleApiError(err, 'PROVISION_ADDON', callback)
    }

    if (err.length > 0) {
      callback(err)
    }
  })
}

addOn.deprovision = function (projectName, addOnId, callback) {
  var project, addon
  async.waterfall([
    function (cb) {
      addOn.getProject(projectName, cb)
    },

    function (pro, cb) {
      project = pro
      addOnController.getForProject(project.id, cb)
    },

    function (addons, cb) {
      if (addOnId) {
        for (var a = 0; a < addons.length; a++) {
          if (addons[a].addon_id === addOnId) {
            return cb(null, addons[a])
          }
        }
      }

      addOn.chooseAddOnPrompt(addons, cb)
    },

    function (add, cb) {
      addon = add
      addOnController.deprovision(project.id, addon.modulus_id, cb)
    }
  ],
  function (err) {
    if (!err) {
      xervo.io.print('Add-On ' + addon.addon_name.data + ' has been deprovisioned.')
    }

    callback(err)
  })
}

module.exports = addOn
