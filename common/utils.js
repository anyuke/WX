var sha1 = require('sha1');
var request = require('request');
var redis = require("redis");
var config = require('./config');
var client = redis.createClient(config.redis.port, config.redis.ip, {detect_buffers: true});
client.auth(config.redis.password);
client.selected_db = config.redis.DB;

client.on("error", function (err) {
  console.log("Error :" , err);
});

client.on('connect', function(){
  console.log('Redis连接成功.');
})
var utils = {};

utils.sign = function (config) {
    return function (req, res, next) {
        var token = config.weixin.token;
        var signature = req.query.signature;
        var timestamp = req.query.timestamp;
        var nonce = req.query.nonce;
        var echostr = req.query.echostr;

        var sortStr = [token, timestamp, nonce].sort().join('');
        shaStr = sha1(sortStr);
        if (req.method === 'GET') {
            if (shaStr === signature) {
                res.send(echostr);
            }
            next();
        } else if (req.method === 'POST') {
            console.log('req.weixin: ', req.weixin);
            if (shaStr != signature) {
                return;
            }
            next();
        }
    }
}

/**
 * 添加string类型的数据
 * @param key 键
 * @params value 值
 * @params expire (过期时间,单位秒;可为空，为空表示不过期)
 */
utils.set = function(key, value, expire){

    return new Promise(function(resolve, reject){

    client.set(key, value, function(err, result){

      if (err) {
        console.log(err);
        reject(err);
        return;
      }

      if (!isNaN(expire) && expire > 0) {
        client.expire(key, parseInt(expire));
      }

      resolve(result);
    })
  })
};

/**
 * 查询string类型的数据
 * @param key 键
 */
utils.get = function(key){
    return new Promise(function(resolve, reject){
      client.get(key, function(err, result){
        if (err) {
          console.log(err);
          reject(err);
          return;
        }

        resolve(result);
      });
    })
};

//Promise化request
utils.request = function(opts){
    return new Promise(function(resolve, reject){
        request(opts,function(error, response, body){
            if (error) {
                return reject(error);
            }
            resolve(body);
        })
    })

};

module.exports = utils;