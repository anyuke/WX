var express = require('express');
var router = express.Router();
var utils = require('../common/utils');
var config = require('../common/config');
var wechatApi = require('../common/wechat_api');
var menu = require('../common/menu');

//获取,验证access_token,存入redis中
router.use(function(req, res, next) {
    //根据token从redis中获取access_token
    utils.get(config.weixin.token).then(function(data){
        //获取到值--往下传递
        if (data) {
            return Promise.resolve(data);
        }
        //没获取到值--从微信服务器端获取,并往下传递
        else{
            return wechatApi.updateAccessToken();
        }
    }).then(function(data){
        console.log(data);
        //没有expire_in值--此data是redis中获取到的
        if (!data.expires_in) {
            console.log('redis获取到值');
            req.accessToken = data;
            next();
        }
        //有expire_in值--此data是微信端获取到的
        else{
            console.log('redis中无值');
            /**
             * 保存到redis中,由于微信的access_token是7200秒过期,
             * 存到redis中的数据减少20秒,设置为7180秒过期
             */
            utils.set(config.weixin.token,`${data.access_token}`,7180).then(function(result){
                if (result == 'OK') {
                    req.accessToken = data.access_token;
                    next();
                }
            })
        }

    })
})

/* GET home page. */
router.get('/', utils.sign(config), function(req, res, next) {
    wechatApi.createMenu(menu, req.accessToken).then(function(result) {
        res.status(200).send(result);
    })
});

router.post('/', function (req, res) {

  res.writeHead(200, {'Content-Type': 'application/xml'});

  var data = req.body.xml;
  console.log('post data: ', data);
  var resMsg = '<xml>' +
    '<ToUserName><![CDATA[' + data.fromusername + ']]></ToUserName>' +
    '<FromUserName><![CDATA[' + data.tousername + ']]></FromUserName>' +
    '<CreateTime>' + parseInt(new Date().valueOf() / 1000) + '</CreateTime>' +
    '<MsgType><![CDATA[text]]></MsgType>' +
    '<Content><![CDATA['+data.content+']]></Content>' +
    '</xml>';
  res.end(resMsg);
});

module.exports = router;
