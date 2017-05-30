var express = require('express');
var router = express.Router();
var utils = require('../common/utils');
var config = require('../common/config');
var wechatApi = require('../common/wechat_api');
var menu = require('../common/menu');
var mysql = require('../common/mysql');
var async = require('async');

//获取,验证access_token,存入redis中
router.use(function(req, res, next) {
    //根据token从redis中获取access_token
    utils.get(config.weixin.token).then(function(data) {
        //获取到值--往下传递
        if (data) {
            return Promise.resolve(data);
        }
        //没获取到值--从微信服务器端获取,并往下传递
        else {
            return wechatApi.updateAccessToken();
        }
    }).then(function(data) {
        console.log(data);
        //没有expire_in值--此data是redis中获取到的
        if (!data.expires_in) {
            console.log('redis获取到值');
            req.accessToken = data;
            next();
        }
        //有expire_in值--此data是微信端获取到的
        else {
            console.log('redis中无值');
            /**
             * 保存到redis中,由于微信的access_token是7200秒过期,
             * 存到redis中的数据减少20秒,设置为7180秒过期
             */
            utils.set(config.weixin.token, `${data.access_token}`, 7180).then(function(result) {
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
        return;
    })
    return;
});

router.post('/', function(req, res) {

    res.writeHead(200, {
        'Content-Type': 'application/xml'
    });

    var data = req.body.xml;
    console.log('post data: ', data);
    if (data.msgtype == 'text') {
        console.log('普通消息')
        var resMsg = '<xml>' +
            '<ToUserName><![CDATA[' + data.fromusername + ']]></ToUserName>' +
            '<FromUserName><![CDATA[' + data.tousername + ']]></FromUserName>' +
            '<CreateTime>' + parseInt(new Date().valueOf() / 1000) + '</CreateTime>' +
            '<MsgType><![CDATA[text]]></MsgType>' +
            '<Content><![CDATA[' + data.content + ']]></Content>' +
            '</xml>';
        res.end(resMsg);
        return;
    } else if (data.msgtype == 'event' &&
        data.event == 'subscribe') {
        console.log('关注')
        async.auto({
            'get_user_msg': function(callback) {
                // 根据用户的openid获取用户信息，存进数据库中
                wechatApi.getUserMsg(req.accessToken, data.fromusername).then(function(result) {
                    // console.log(result);
                    callback(null, result);
                    return;
                });
                return;
            },
            'judge_user_if_exist': ['get_user_msg', function(result, callback) {
                var row = result['get_user_msg'];
                var sql =
                    " select * " +
                    " from weixin.user " +
                    " where openid = '" + row.openid + "'";
                console.log('============judge_user_if_exist sql:\n', sql);
                mysql.getConnection(function(err, conn) {
                    conn.query(sql, function(err, rows) {
                        conn.release();
                        if (err) {
                            callback(err);
                            return;
                        }
                        callback(null, rows);
                        return;
                    })
                });
                return;
            }],
            'save_user_msg': ['judge_user_if_exist', function(result, callback) {
                var row = result['get_user_msg'];
                var temp = result['judge_user_if_exist'];
                if (temp.length == 0) {
                    var sql =
                        "insert into weixin.user " +
                        "   (user.subscribe, " +
                        "    user.openid, " +
                        "    user.nickname, " +
                        "    user.sex, " +
                        "    user.city, " +
                        "    user.country, " +
                        "    user.province, " +
                        "    user.language, " +
                        "    user.headimgurl, " +
                        "    user.subscribe_time, " +
                        "    user.remark, " +
                        "    user.groupid) values " +
                        "   (" + row.subscribe + ",'" + row.openid + "','" + row.nickname + "'," + row.sex + ",'" + row.city + "','" + row.country + "','" + row.province + "','" + row.language + "','" + row.headimgurl + "'," + row.subscribe_time + ",'" + row.remark + "','" + row.groupid + "');"
                } else {
                    var sql =
                        " update weixin.user set " +
                        "    user.subscribe = " + row.subscribe +
                        "    ,user.nickname = '" + row.nickname + "'" +
                        "    ,user.sex = " + row.sex +
                        "    ,user.city = '" + row.city + "'" +
                        "    ,user.country = '" + row.country + "'" +
                        "    ,user.province = '" + row.province + "'" +
                        "    ,user.language = '" + row.language + "'" +
                        "    ,user.headimgurl = '" + row.headimgurl + "'" +
                        "    ,user.subscribe_time = " + row.subscribe_time +
                        "    ,user.remark = '" + row.remark + "'" +
                        "    ,user.groupid = '" + row.groupid + "'" +
                        " where openid = '" + row.openid + "'";
                }
                console.log('============save_user_msg sql:\n', sql);
                mysql.getConnection(function(err, conn) {
                    conn.query(sql, function(err, rows) {
                        conn.release();
                        if (err) {
                            callback(err);
                            return;
                        }
                        callback();
                        return;
                    })
                });
                return;
            }],
            'send_msg_to_user': ['save_user_msg', function(result, callback) {
                var resMsg = '<xml>' +
                    '<ToUserName><![CDATA[' + data.fromusername + ']]></ToUserName>' +
                    '<FromUserName><![CDATA[' + data.tousername + ']]></FromUserName>' +
                    '<CreateTime>' + parseInt(new Date().valueOf() / 1000) + '</CreateTime>' +
                    '<MsgType><![CDATA[text]]></MsgType>' +
                    '<Content><![CDATA[' + "感谢您的关注~" + ']]></Content>' +
                    '</xml>';
                callback(null, resMsg);
                return;
            }]
        }, function(err, result) {
            if (err) {
                console.log('err: ', err);
            }
            res.end(result['send_msg_to_user']);
            return;
        });
        return;
    } else if (data.msgtype == 'event' &&
        data.event == 'unsubscribe') {
        console.log('取消关注')
        async.auto({
            'delete_user_msg': function(callback) {
                var sql =
                    " update weixin.user " +
                    " set subscribe = 0 " +
                    " where openid = '" + data.fromusername + "'";
                console.log('============delete_user_msg sql:\n', sql);
                mysql.getConnection(function(err, conn) {
                    conn.query(sql, function(err, rows) {
                        conn.release();
                        if (err) {
                            callback(err);
                            return;
                        }
                        callback();
                        return;
                    })
                });
                return;
            },
            'send_msg_to_user': ['delete_user_msg', function(result, callback) {
                var resMsg = '<xml>' +
                    '<ToUserName><![CDATA[' + data.fromusername + ']]></ToUserName>' +
                    '<FromUserName><![CDATA[' + data.tousername + ']]></FromUserName>' +
                    '<CreateTime>' + parseInt(new Date().valueOf() / 1000) + '</CreateTime>' +
                    '<MsgType><![CDATA[text]]></MsgType>' +
                    '<Content><![CDATA[' + "取消关注!" + ']]></Content>' +
                    '</xml>';
                callback(null, resMsg);
                return;
            }]
        }, function(err, result) {
            if (err) {
                console.log('err: ', err);
            }
            res.end(result['send_msg_to_user']);
            return;
        });
    }
});

module.exports = router;