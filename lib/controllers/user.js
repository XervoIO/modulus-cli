var librarian = require('../common/api').librarian
var userConfig = require('../common/api').userConfig
var util = require('util')
var request = require('request')

var User = function () {

}

/**
 * If the XERVO_TOKEN environment variable is set this
 * will log the user in using that info.
 */
User.prototype.initAuthToken = function (callback) {
  if (process.env.XERVO_TOKEN) {
    this.getForToken(process.env.XERVO_TOKEN, function (err, result) {
      if (err) {
        return callback(err)
      } else {
        userConfig.data = {}
        userConfig.data.apiKey = process.env.XERVO_TOKEN
        userConfig.data.userId = result.id
        userConfig.data.username = result.username
        callback(null, userConfig)
      }
    })
  } else {
    callback()
  }
}

User.prototype.get = function (userId, callback) {
  librarian.user.get(userId, userConfig.data.apiKey, callback)
}

User.prototype.getForToken = function (token, callback) {
  librarian.user.getForToken(token, callback)
}

User.prototype.create = function (username, email, jobTitle, company, password, callback) {
  var hashPass = librarian.util.createHash(password)
  librarian.user.create({
    username: username,
    firstName: '',
    lastName: '',
    email: email,
    jobTitle: jobTitle,
    company: company,
    password: hashPass
  }, callback)
}

User.prototype.authenticate = function (login, password, callback) {
  var hashPass = librarian.util.createHash(password)
  librarian.user.authenticate(login, hashPass, callback)
}

User.prototype.authenticateGithub = function (login, password, callback) {
  var token = null
  var user = new Buffer(util.format('%s:%s', login, password), 'ascii').toString('base64')

  var opts = {
    url: 'https://api.github.com/authorizations',
    headers: {
      'User-Agent': 'https://xervo.io/',
      authorization: util.format('basic %s', user)
    }
  }

  request.get(opts, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      var authorizations = JSON.parse(body)
      for (var i = 0; i < authorizations.length; i++) {
        // Find the authorization for the Xervo GitHub application in order
        // to get the user's OAuth token.
        if (authorizations[i].app.name === 'Xervo') {
          token = authorizations[i].hashed_token
          break
        }
      }

      if (token) {
        librarian.user.authenticateOAuth('github', token, callback)
      } else {
        callback({ code: 'OAUTH_TOKEN_NOT_FOUND' }, null)
      }
    } else {
      if (response.statusCode === 403) {
        callback({ code: 'LOGIN' }, null)
      } else {
        callback(error || { code: 'LOGIN' }, null)
      }
    }
  })
}

User.prototype.resetPassword = function (email, callback) {
  librarian.user.resetPassword(email, callback)
}

User.prototype.createToken = function (callback) {
  librarian.user.createToken(userConfig.data.userId, userConfig.data.apiKey, function (err, result) {
    var key = null
    if (result) {
      key = result.key
    }

    callback(err, key)
  })
}

User.prototype.getTokens = function (callback) {
  librarian.user.getTokens(userConfig.data.userId, userConfig.data.apiKey, callback)
}

User.prototype.removeToken = function (token, callback) {
  librarian.user.removeToken(token, userConfig.data.userId, userConfig.data.apiKey, callback)
}

User.prototype.getOrganizations = function (userId, callback) {
  librarian.user.getOrganizations(userId, userConfig.data.apiKey, callback)
}

module.exports = new User()
