import axios from 'axios'
import { Album, Singer, PlayList, Music } from './commonObject'
import { getuser, db, getFavorite } from '../renderer/db/index'
const querystring = require('querystring')
const store = require('../renderer/store/index').default

axios.defaults.withCredentials = true
const config = {
  headers: {
    'Referer': 'http://y.qq.com/portal/player.html',
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Safari/537.36'
  }
}

// 用来删除歌曲的数据索引
const songids = {}
let dirid = ''

// 我特么真的不会js异步= =
// async 和await是什么鬼…… 简直是在挫败小萌新的信心
async function _config () {
  var cookie = await getuser()
  if (cookie) {
    config['headers']['Cookie'] = cookie.cookieString
  }
  return config
}

async function _postconfig (data) {
  var cookie = await getuser()
  if (cookie) {
    config['headers']['Cookie'] = cookie.cookieString
  }
  config['headers']['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8'
  config['data'] = data
  config['method'] = 'post'
  return config
}

async function _cookie () {
  return (await getuser()) ? (await getuser()).cookie : {}
}

async function _gtk () {
  return (await getuser()) ? (await getuser()).g_tk : 0
}

async function _user () {
  return (await _cookie()) ? (await _cookie())['luin'].slice(1) : ''
}

// 都返回数组，数组的内容既是可以存储在数据库的对象
// 请求收藏的所有专辑
export async function AlbumFromRemote () {
  var url = `https://c.y.qq.com/fav/fcgi-bin/fcg_get_profile_order_asset.fcg?g_tk=${await _gtk()}&loginUin=${await _user()}&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0&ct=20&cid=205360956&userid=${await _user()}.&reqtype=2&ein=`
  let num = (await axios.get(url, await _config())).data.data.totalalbum
  url += `${num}`
  let albumlist = (await axios.get(url, await _config())).data.data.albumlist
  return (albumlist.map(({albumname, albummid}) => new Album(albumname, albummid)).slice(0, num))
}

// 获取关注的歌手
export async function SingerFromRemote () {
  var url = `https://c.y.qq.com/rsc/fcgi-bin/fcg_order_singer_getlist.fcg?utf8=1&uin=${await _user()}&rnd=0.08377282764938476&g_tk=${await _gtk()}&loginUin=${await _user()}&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0`
  let list = (await axios.get(url, await _config())).data.list
  return list.map(({name, mid}) => new Singer(name, mid))
}

// 喜欢的歌曲
// 现在的网页版已经不能显示所有喜欢的歌曲了（最多显示10条）
// linux用户表示我草泥马呢。
export async function SongFromRemote () {
  var url = `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&utf8=1&onlysong=1&nosign=1&song_begin=0&ctx=1&disstid=3149743307&_=1554447405264&g_tk=${await _gtk()}&loginUin=${await _user()}&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0&song_num=`
  let data = (await axios.get(url, await _config())).data
  dirid = data[dirid]
  return data['songlist'].map(({albummid, albumname, songmid, songname, singer, songid}) => {
    songids[songmid] = songid
    var ablum = new Album(albumname, albummid)
    var singerList = singer.map(({mid, name}) => new Singer(name, mid))
    return new Music(songname, songmid, songmid, ablum, singerList, 0)
  })
}

// 喜欢的歌单
// 啊……草泥马草泥马草泥马……Aaaaaaa
export async function PlayListToRemote () {
  var url = `https://c.y.qq.com/fav/fcgi-bin/fcg_get_profile_order_asset.fcg?g_tk=${await _gtk()}&loginUin=${await _user()}&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0&ct=20&cid=205360956&userid=${await _user()}&reqtype=3&sin=0&ein=`
  let num = (await axios(url, (await _config()))).data.data.totaldiss
  url += num
  let list = (await axios(url, (await _config()))).data.data.cdlist
  return list.map(({dissname, dissid, logo}) => new PlayList(dissid, dissname, logo))
}

// 获取头像以及昵称
export async function Info () {
  try {
    var url = `https://c.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg?g_tk=${await _gtk()}&loginUin=${await _user()}& hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0&cid=205360838&ct=20&userid=0& reqfrom=1&reqtype=0`
    let data = (await axios(url, (await _config()))).data.data
    let {headpic, nick} = data.creator
    console.log(data)
    return {pic: headpic, nickname: nick}
  } catch (e) {
    console.log(e)
    return undefined
  }
}

/**
 * 收藏 / 取消收藏歌单
 * @param {*} playListMid
 * @param {Number} flag flag为1, 收藏; flag为2, 取消收藏
 */
export async function FavoritePlayList (playListMid, flag) {
  var url = `https://c.y.qq.com/folder/fcgi-bin/fcg_qm_order_diss.fcg?g_tk=${await _gtk()}`
  var data = {
    loginUin: `${await _user()}`,
    hostUin: '0',
    format: 'fs',
    inCharset: 'GB2312',
    outCharset: 'utf8',
    notice: '0',
    platform: 'yqq',
    needNewCode: '0',
    g_tk: `${await _gtk()}`,
    uin: `${await _user()}`,
    dissid: `${playListMid}`,
    from: '1',
    optype: `${flag}`,
    utf8: '1'
  }
  axios(url, (await _postconfig(querystring.stringify(data))))
}

/**
 * 取消收藏歌曲
 * @param {*} songmid
 */
export async function DeleteFavoriteSong (songmid) {
  let data = {
    oginUin: `${await _user()}`,
    hostUin: '0',
    format: 'json',
    inCharset: 'utf8',
    outCharset: 'utf-8',
    notice: '0',
    platform: 'yqq.post',
    needNewCode: '0',
    uin: `${await _user()}`,
    dirid: '201',
    ids: `${songids[songmid]}`,
    source: '103',
    types: '3',
    formsender: '4',
    flag: '2',
    from: '3',
    utf8: '1',
    g_tk: `${await _gtk()}`
  }
  let url = `https://c.y.qq.com/qzone/fcg-bin/fcg_music_delbatchsong.fcg?g_tk=${await _gtk()}`
  axios(url, await _postconfig(querystring.stringify(data)))
}
export async function AddFavorateSong (songmid) {
  let data = {
    loginUin: `${await _user()}`,
    hostUin: '0',
    format: 'json',
    inCharset: 'utf8',
    outCharset: 'utf-8',
    notice: '0',
    platform: 'yqq.post',
    needNewCode: '0',
    uin: `${await _user()}`,
    midlist: `${songmid}`,
    typelist: '13',
    dirid: '201',
    addtype: '',
    formsender: '4',
    source: '153',
    r2: '0',
    r3: '1',
    utf8: '1',
    g_tk: `${await _gtk()}`
  }
  let url = `https://c.y.qq.com/splcloud/fcgi-bin/fcg_music_add2songdir.fcg?g_tk=${await _gtk()}`
  axios(url, await _postconfig(querystring.stringify(data)))
}

// flag = 2, 取消收藏 flag = 1, 收藏
export async function FavoriteAlbum (albummid, flag) {
  let albumid = (await axios(`https://c.y.qq.com/v8/fcg-bin/fcg_v8_album_info_cp.fcg?ct=24&albummid=${albummid}&g_tk=${await _gtk()}&loginUin=${await _user()}&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0`, await _config())).data.data.id
  let url = `https://c.y.qq.com/folder/fcgi-bin/fcg_qm_order_diss.fcg?g_tk=${await _gtk()}`
  let data = {
    loginUin: `${await _user()}`,
    hostUin: `0`,
    format: `fs`,
    inCharset: `GB2312`,
    outCharset: `utf8`,
    notice: `0`,
    platform: `yqq`,
    needNewCode: `0`,
    g_tk: `${await _gtk()}`,
    uin: `1165316728`,
    ordertype: `1`,
    albumid: `${albumid}`,
    albummid: `${albummid}`,
    from: `1`,
    optype: `${flag}`,
    utf8: `1`
  }
  axios(url, await _postconfig(querystring.stringify(data)))
}

// 关注/取消关注
export async function DeleteSinger (singermid) {
  let url = `https://c.y.qq.com/rsc/fcgi-bin/fcg_order_singer_del.fcg?g_tk=${await _gtk()}&loginUin=${await _user()}&hostUin=0&format=json&inCharset=utf8&outCharset=gb2312&notice=0&platform=yqq.json&needNewCode=0&singermid=${singermid}`
  axios(url, await _config())
}
export async function AddSinger (singermid) {
  let url = `https://c.y.qq.com/rsc/fcgi-bin/fcg_order_singer_add.fcg?g_tk=${await _gtk()}&loginUin=${await _user()}&hostUin=0&format=json&inCharset=utf8&outCharset=gb2312&notice=0&platform=yqq.json&needNewCode=0&singermid=${singermid}`
  axios(url, await _config())
}

// 从Coco音乐的服务器同步收藏信息
export async function StoreRemote () {
  let songs = await SongFromRemote()
  let singers = await SingerFromRemote()
  let albums = await AlbumFromRemote()
  let playLists = await PlayListToRemote()
  songs.forEach(item => db.song.put(item))
  singers.forEach(item => db.singer.put(item))
  albums.forEach(item => db.album.put(item))
  playLists.forEach(item => db.playList.put(item))
}

export async function RemoteToLocal () {
  await StoreRemote()
  store.commit('setFavorite', await getFavorite())
}
