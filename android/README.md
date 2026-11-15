# 宁志军课题组 Android 测试版

这是一个 Android WebView 壳，实际页面由 Mac Mini 提供。卫生照片经 Android 相机/照片选择器选取、前端压缩后，通过访问码上传并保存在 Mac Mini 的 `app/storage/uploads/`。

## 安装与连接

测试 APK：`dist/ninglab-labdesk-debug.apk`

首次打开会自动连接固定 HTTPS 地址 `https://app.nzjlab.cn`，手机无需安装 Tailscale，也无需填写 Mac Mini 的 IP 地址。Cloudflare Tunnel 必须在 Mac Mini 上保持运行，且本地 Python 服务仅监听 `127.0.0.1:8767`。不要把 `8767` 端口映射到公网。

旧测试版保存过的 Tailscale 或实验室局域网地址会自动迁移到新 HTTPS 地址。顶部“服务器”按钮仅用于管理员通知域名变更时手动调整，并只接受 `https://` 地址。

## 语音输入

1.3.6 起，App 允许网页直接使用麦克风（`onPermissionRequest` 授予 `RESOURCE_AUDIO_CAPTURE`）。网页录音后把音频发给 Mac Mini 转写，因此不依赖手机自带的语音识别服务；旧版 App 会因为没有这个授权而只能退回系统识别或手动输入，需要覆盖安装新版。

## 更新

工作台页面、相机后的上传流程和内容由 Mac Mini 服务提供。更新服务端 `app/public/` 后，已安装客户端会检查 `version.json` 并更新页面缓存。Android 壳有新版时，应用会在打开时显示下载提示；安装仍需用户确认。关闭应用后的系统推送需要另行配置 FCM，目前尚未启用。

测试 APK 使用 debug 签名。后续 APK 必须保持相同签名并提高 `versionCode` 才能覆盖安装；若切换到正式签名，现有测试版需要卸载一次，但不会删除 Mac Mini 上的照片。

## 重新构建

需要 JDK 17 与 Android SDK Platform 35。安装好 Android Studio/SDK 后：

```sh
cd app/android
./build-apk.sh
```

产物位于 `app/android/dist/ninglab-labdesk-debug.apk`。首版是 debug 签名，适合安装测试，不用于公开商店发布。
