var express = require('express');
var router = express.Router();
var mysql = require('mysql');
var config = require('./config');

var pool = mysql.createPool({
    host: config.mysql.host,
    user: config.mysql.user,
    password: config.mysql.password,
    port: config.mysql.port,
    database: config.mysql.database
});

var getConnection = function(callback) {
    pool.getConnection(function(err, connection) {
        callback(err, connection);
    });
};

module.exports = {
    getConnection: getConnection
};