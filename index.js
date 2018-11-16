const ALIOSS = require("ali-oss");
const fs = require("fs");
const pathUtil = require("path");
const md5File = require("md5-file");
const color = require("ansi-colors");
const loaderUtils = require('loader-utils');

/**
 *
 * @param {Object} options
 * @param {String} options.accessKeyId
 * @param {String} options.accessKeySecret
 * @param {String} options.endpoint
 * @param {String} options.region
 * @param {String} options.bucket
 * @param {String} options.path
 * @param {Array} options.formats 可选，默认['png', 'jpg', 'jpeg', 'svg', 'bmp', 'gif', 'webp', 'tiff']
 * @param {String} options.prefix 可选，默认为@oss
 */
module.exports = function(source, map, meta) {
  var callback = this.async();

  if (typeof source !== "string") {
    return callback(
      new Error("alioss upload loader cannot resolve the content not string")
    );
  }

  const options = loaderUtils.getOptions(this);

  const {
    accessKeyId,
    accessKeySecret,
    endpoint,
    region,
    bucket,
    path = '/',
    formats = ['png', 'jpg', 'jpeg', 'svg', 'bmp', 'gif', 'webp', 'tiff'],
    prefix = '@oss'
  } = options;
  const ossClient = new ALIOSS({
    accessKeyId,
    accessKeySecret,
    endpoint,
    region,
    bucket
  });

  const uploadCache = {};
  let count = 0;

  const formatStr = formats.reduce((result, format) => {
    if (result) return `${result}|.${format}`

    return `.${format}`
  }, '')
  const reg = new RegExp(`@oss/\\S+(${formatStr})`, 'gi')
  let content = source;

  const matches = content.match(reg);
  const checkTask = () => {
    if (matches.length <= 0 && count <= 0) {
      callback(null, content, map, meta)
    }
  };
  if (matches) {
    do {
      const match = matches.pop();
      const realPath = pathUtil.resolve(path, match.replace(`${prefix}/`, ''))
      const showPath = pathUtil.join(path, match.replace(`${prefix}/`, ''))
      if (!fs.existsSync(realPath)) {
        console.log(
          color.red("上传CND失败"),
          " ",
          "图片资源",
          " ",
          showPath,
          " ",
          "文件不存在"
        );
        checkTask();
        continue;
      }

      const fileKey = md5File.sync(realPath);
      if (uploadCache[fileKey]) {
        checkTask();
        continue;
      }

      uploadCache[fileKey] = true;
      count += 1;
      ossClient
        .put(fileKey, realPath)
        .then(result => {
          console.log(
            color.yellow("上传CDN成功"),
            " ",
            "图片资源",
            " ",
            showPath,
            " ",
            result.url
          );
          content = content.replace(new RegExp(match, "g"), result.url);
          count -= 1;
          checkTask();
        })
        .catch(error => {
          console.log(
            color.red("上传CND失败"),
            " ",
            "图片资源",
            " ",
            showPath,
            " ",
            error.message
          );
          uploadCache[fileKey] = false;
          count -= 1;
          checkTask();
        });
    } while (matches.length > 0);
  } else {
    callback(null, content, map, meta)
  }
};
