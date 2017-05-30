/*
 *微信相关操作api
 */
var wechatApi = {};
var config = require('./config');
var appID = config.weixin.appId;
var appSecret = config.weixin.appSecret;
var utils = require('./utils');
var api = {
    accessToken : `${config.weixin.prefix}token?grant_type=client_credential`,
    upload : `${config.weixin.prefix}media/upload?`,
    createMenu: `${config.weixin.prefix}menu/create?access_token=`,
    getUserMsg: `${config.weixin.prefix}user/info?`
}

//获取access_token
wechatApi.updateAccessToken = function(){
    var url = `${api.accessToken}&appid=${appID}&secret=${appSecret}`;
    console.log('updateAccessToken url: ', url);
    var option = {
        url : url,
        json : true
    };
    return utils.request(option).then(function(data){
        console.log('updateAccessToken data: ', data);
        return Promise.resolve(data);
    })
}

wechatApi.createMenu = function(menu, access_token){
  return new Promise(function(resolve,reject){
      var url = `${api.createMenu}${access_token}`;
      console.log('createMenu url:', url);
      utils.request({url:url,method:'POST',body:menu,json:true}).then(function(body){
        console.log('body:', body);
        if(body.errcode === 0){
            resolve(body.errmsg);
        }else{
            reject(body.errmsg);
        }
      });
  });
}

//根据accessToken获取用户的基本信息
wechatApi.getUserMsg = function(accessToken, openid){
    var url = `${api.getUserMsg}access_token=${accessToken}&openid=${openid}&lang=zh_CN`;
    console.log('getUserMsg url: ', url);
    var option = {
        url : url,
        json : true
    };
    return utils.request(option).then(function(data){
        console.log('getUserMsg data: ', data);
        return Promise.resolve(data);
    })
}

module.exports = wechatApi;