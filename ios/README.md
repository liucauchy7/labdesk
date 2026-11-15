# iOS 版（可选原生壳）

网页版本身已经可以在 iPhone 上「添加到主屏幕」当 App 用（推荐，见 `https://app.nzjlab.cn/install.html`）。
这里是一个等价的原生 WKWebView 壳，用于需要 TestFlight / App Store 或想要独立图标与设置入口的场景。

## 结构

```
ios/
  project.yml            # XcodeGen 描述文件
  LabDeskIOS/
    LabDeskApp.swift     # App 入口
    ContentView.swift    # WKWebView 壳：麦克风/相机授权、JS 弹窗、外链处理、下拉刷新按钮
    Info.plist           # 麦克风、相机、相册用途说明
    Assets.xcassets/     # AppIcon（1024）
```

## 方式一：XcodeGen（推荐）

```sh
brew install xcodegen
cd ios
xcodegen generate
open LabDeskIOS.xcodeproj
```

在 Xcode 里选择自己的 Team（免费 Apple ID 也行），连上 iPhone 运行即可。

## 方式二：手动新建工程

1. Xcode → File → New → Project → iOS App，名称 `LabDeskIOS`，Interface 选 SwiftUI；
2. 删除模板生成的 `ContentView.swift`，把本目录 `LabDeskIOS/LabDeskApp.swift`、`ContentView.swift` 拖进工程；
3. 用本目录的 `Info.plist` 覆盖工程的 Info（或在 Target → Info 里补上 `NSMicrophoneUsageDescription`、`NSCameraUsageDescription`、`NSPhotoLibraryUsageDescription`）；
4. Target → General → App Icons 选择 `Assets.xcassets` 里的 AppIcon。

## 说明

- Bundle ID 默认 `cn.ninglab.labdesk.ios`，可自行修改；
- 免费 Apple ID 侧载的应用 7 天后需要重新安装；TestFlight/App Store 需要付费开发者账号（$99/年）；
- 网页错误、麦克风、文件选择都在 WebView 里处理；修改服务端功能不需要重新发版；
- 服务器地址默认 `https://app.nzjlab.cn/`，右上角设置里可以改（域名变更时用）。

## 与安卓壳的差异

- 安卓壳自带原生录音兜底（`AudioRecord`），iOS 壳直接用 WKWebView 的 `getUserMedia`，由 Mac Mini 上的 whisper 转写；
- iOS 需要 `requestMediaCapturePermissionFor` 授权，已在 `ContentView.swift` 中实现。
