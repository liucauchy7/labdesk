import SwiftUI
import WebKit

struct ContentView: View {
    @State private var reloadToken = UUID()
    @State private var showSettings = false
    @AppStorage("labdesk.server") private var server = "https://app.nzjlab.cn/"

    var body: some View {
        NavigationStack {
            WebView(url: URL(string: server) ?? URL(string: "https://app.nzjlab.cn/")!, reloadToken: reloadToken)
                .ignoresSafeArea(edges: .bottom)
                .navigationTitle("宁志军课题组")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            reloadToken = UUID()
                        } label: {
                            Image(systemName: "arrow.clockwise")
                        }
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            showSettings = true
                        } label: {
                            Image(systemName: "gearshape")
                        }
                    }
                }
                .sheet(isPresented: $showSettings) {
                    ServerSettings(server: $server, reloadToken: $reloadToken)
                }
        }
    }
}

struct WebView: UIViewRepresentable {
    let url: URL
    let reloadToken: UUID

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.uiDelegate = context.coordinator
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.96, green: 0.97, blue: 0.96, alpha: 1)
        context.coordinator.webView = webView
        context.coordinator.lastToken = reloadToken
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        guard context.coordinator.lastToken != reloadToken else { return }
        context.coordinator.lastToken = reloadToken
        if webView.url?.host != url.host {
            webView.load(URLRequest(url: url))
        } else {
            webView.reload()
        }
    }

    final class Coordinator: NSObject, WKUIDelegate, WKNavigationDelegate {
        weak var webView: WKWebView?
        var lastToken: UUID?

        private func alert(_ title: String, _ message: String, completion: @escaping () -> Void) {
            let controller = UIAlertController(title: title, message: message, preferredStyle: .alert)
            controller.addAction(UIAlertAction(title: "好", style: .default) { _ in completion() })
            UIApplication.shared.topViewController?.present(controller, animated: true)
        }

        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                     initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            alert("提示", message, completion: completionHandler)
        }

        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                     initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
            let controller = UIAlertController(title: "确认", message: message, preferredStyle: .alert)
            controller.addAction(UIAlertAction(title: "取消", style: .cancel) { _ in completionHandler(false) })
            controller.addAction(UIAlertAction(title: "确定", style: .default) { _ in completionHandler(true) })
            UIApplication.shared.topViewController?.present(controller, animated: true)
        }

        func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                     defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                     completionHandler: @escaping (String?) -> Void) {
            let controller = UIAlertController(title: prompt, message: nil, preferredStyle: .alert)
            controller.addTextField { field in field.text = defaultText }
            controller.addAction(UIAlertAction(title: "取消", style: .cancel) { _ in completionHandler(nil) })
            controller.addAction(UIAlertAction(title: "确定", style: .default) { _ in
                completionHandler(controller.textFields?.first?.text)
            })
            UIApplication.shared.topViewController?.present(controller, animated: true)
        }

        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                     for navigationAction: WKNavigationAction,
                     windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let target = navigationAction.request.url,
               ["http", "https"].contains(target.scheme?.lowercased() ?? "") {
                UIApplication.shared.open(target)
            }
            return nil
        }

        @available(iOS 15.0, *)
        func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                     initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
                     decisionHandler: @escaping (WKPermissionDecision) -> Void) {
            decisionHandler(.grant)
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let target = navigationAction.request.url,
                  let host = target.host,
                  navigationAction.navigationType == .linkActivated else {
                decisionHandler(.allow)
                return
            }
            if host.hasSuffix("nzjlab.cn") {
                decisionHandler(.allow)
            } else {
                UIApplication.shared.open(target)
                decisionHandler(.cancel)
            }
        }
    }
}

extension UIApplication {
    var topViewController: UIViewController? {
        let scenes = connectedScenes.compactMap { $0 as? UIWindowScene }
        let window = scenes.flatMap { $0.windows }.first { $0.isKeyWindow }
        var controller = window?.rootViewController
        while let presented = controller?.presentedViewController { controller = presented }
        return controller
    }
}

struct ServerSettings: View {
    @Binding var server: String
    @Binding var reloadToken: UUID
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("服务器地址") {
                    TextField("https://app.nzjlab.cn/", text: $server)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
                Section {
                    Text("只在域名变更时修改。访问码在连接页面输入，保存在本机。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("设置")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") {
                        reloadToken = UUID()
                        dismiss()
                    }
                }
            }
        }
    }
}
