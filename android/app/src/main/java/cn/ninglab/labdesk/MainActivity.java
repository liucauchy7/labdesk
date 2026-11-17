package cn.ninglab.labdesk;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.util.Base64;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.FrameLayout;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 4101;
    private static final int CAMERA_PERMISSION_REQUEST = 4102;
    private static final int SPEECH_REQUEST = 4103;
    private static final int SPEECH_PERMISSION_REQUEST = 4104;
    private static final String PREFS = "labdesk-settings";
    private static final String SERVER_KEY = "server-url";
    private static final String DEFAULT_SERVER_URL = "https://app.nzjlab.cn";

    private WebView webView;
    private View connectionError;
    private SharedPreferences preferences;
    private String serverUrl = "";
    private String activeServerUrl = "";
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;
    private SpeechRecognizer speechRecognizer;
    private PermissionRequest pendingPermissionRequest;
    private AudioRecord audioRecord;
    private Thread recordThread;
    private volatile boolean recording;
    private ByteArrayOutputStream recordBuffer;
    private boolean pendingRecorderStart;
    private boolean pendingImageChooser;
    private boolean pendingCameraCapture;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        preferences = getSharedPreferences(PREFS, MODE_PRIVATE);
        serverUrl = normalizeUrl(preferences.getString(SERVER_KEY, ""));
        if (serverUrl == null || isLegacyServer(serverUrl)) {
            serverUrl = DEFAULT_SERVER_URL;
            preferences.edit().putString(SERVER_KEY, serverUrl).apply();
        }
        buildShell();
        loadWorkspace();
        checkForNativeUpdate();
    }

    private void buildShell() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(245, 247, 244));

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(16), dp(8), dp(12), dp(8));
        toolbar.setBackgroundColor(Color.WHITE);

        TextView title = new TextView(this);
        title.setText("宁志军课题组");
        title.setTextColor(Color.rgb(32, 43, 41));
        title.setTextSize(16);
        title.setTypeface(null, 1);
        toolbar.addView(title, new LinearLayout.LayoutParams(0, dp(42), 1));

        Button settings = new Button(this);
        settings.setText("服务器");
        settings.setTextSize(12);
        settings.setOnClickListener(view -> showServerDialog());
        toolbar.addView(settings, new LinearLayout.LayoutParams(dp(88), dp(42)));
        root.addView(toolbar, new LinearLayout.LayoutParams(-1, dp(58)));

        FrameLayout workspace = new FrameLayout(this);
        root.addView(workspace, new LinearLayout.LayoutParams(-1, 0, 1));

        webView = new WebView(this);
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setAllowFileAccess(false);
        webSettings.setAllowContentAccess(true);
        webSettings.setMediaPlaybackRequiresUserGesture(true);
        webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptCookie(true);
        webSettings.setUserAgentString(webSettings.getUserAgentString() + " LabDeskApp/1.0");
        webView.addJavascriptInterface(new SpeechBridge(), "LabDeskSpeech");
        webView.addJavascriptInterface(new VaultBridge(), "LabDeskVault");
        webView.setBackgroundColor(Color.rgb(245, 247, 244));
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                webView.setVisibility(View.VISIBLE);
                connectionError.setVisibility(View.GONE);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri target = request.getUrl();
                if (sameOrigin(target)) return false;
                String scheme = target.getScheme();
                if ("http".equals(scheme) || "https".equals(scheme)) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, target));
                    } catch (Exception error) {
                        Toast.makeText(MainActivity.this, "无法打开链接，请复制到浏览器打开", Toast.LENGTH_SHORT).show();
                    }
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (!request.isForMainFrame() || !sameOrigin(request.getUrl())) return;
                webView.setVisibility(View.GONE);
                connectionError.setVisibility(View.VISIBLE);
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                boolean wantsAudio = false;
                for (String resource : request.getResources()) {
                    if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) wantsAudio = true;
                }
                if (!wantsAudio) {
                    request.deny();
                    return;
                }
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                    return;
                }
                pendingPermissionRequest = request;
                requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, SPEECH_PERMISSION_REQUEST);
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                pendingImageChooser = acceptsImages(params.getAcceptTypes());
                pendingCameraCapture = pendingImageChooser && params.isCaptureEnabled();
                if (pendingCameraCapture && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST);
                    return true;
                }
                launchFileChooser(pendingImageChooser, pendingCameraCapture);
                return true;
            }
        });
        workspace.addView(webView, new FrameLayout.LayoutParams(-1, -1));

        LinearLayout errorPanel = new LinearLayout(this);
        errorPanel.setOrientation(LinearLayout.VERTICAL);
        errorPanel.setGravity(Gravity.CENTER);
        errorPanel.setPadding(dp(28), dp(24), dp(28), dp(24));
        errorPanel.setBackgroundColor(Color.rgb(245, 247, 244));

        TextView errorTitle = new TextView(this);
        errorTitle.setText("暂时连接不到课题组服务器");
        errorTitle.setTextColor(Color.rgb(32, 43, 41));
        errorTitle.setTextSize(19);
        errorTitle.setTypeface(null, 1);
        errorTitle.setGravity(Gravity.CENTER);
        errorPanel.addView(errorTitle, new LinearLayout.LayoutParams(-1, -2));

        TextView errorHelp = new TextView(this);
        errorHelp.setText("请检查手机网络，或确认实验室 Mac Mini 与安全连接服务正在运行。默认地址无需手动填写。");
        errorHelp.setTextColor(Color.rgb(91, 105, 98));
        errorHelp.setTextSize(15);
        errorHelp.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams helpParams = new LinearLayout.LayoutParams(-1, -2);
        helpParams.setMargins(0, dp(12), 0, dp(20));
        errorPanel.addView(errorHelp, helpParams);

        LinearLayout errorActions = new LinearLayout(this);
        errorActions.setGravity(Gravity.CENTER);
        Button retry = new Button(this);
        retry.setText("重试连接");
        retry.setOnClickListener(view -> loadWorkspace());
        errorActions.addView(retry);
        Button editServer = new Button(this);
        editServer.setText("修改地址");
        editServer.setOnClickListener(view -> showServerDialog());
        errorActions.addView(editServer);
        errorPanel.addView(errorActions, new LinearLayout.LayoutParams(-1, -2));
        connectionError = errorPanel;
        connectionError.setVisibility(View.GONE);
        workspace.addView(connectionError, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
    }

    private boolean acceptsImages(String[] types) {
        if (types == null || types.length == 0) return true;
        for (String type : types) {
            if (type != null && (type.startsWith("image/") || "*/*".equals(type))) return true;
        }
        return false;
    }

    private void launchFileChooser(boolean images, boolean includeCamera) {
        if (fileCallback == null) return;
        Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        picker.addCategory(Intent.CATEGORY_OPENABLE);
        picker.setType(images ? "image/*" : "*/*");
        if (!images) picker.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/pdf"});

        Intent chooser = Intent.createChooser(picker, images ? "拍照或选择照片" : "选择文件");
        if (images && includeCamera) {
            Intent camera = createCameraIntent();
            if (camera != null) chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
        }
        try {
            startActivityForResult(chooser, FILE_CHOOSER_REQUEST);
        } catch (Exception exception) {
            finishFileChooser(null);
            Toast.makeText(this, "无法打开相机或文件选择器", Toast.LENGTH_LONG).show();
        }
    }

    private Intent createCameraIntent() {
        Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (camera.resolveActivity(getPackageManager()) == null) return null;
        try {
            File directory = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
            if (directory == null) return null;
            File photo = File.createTempFile("labdesk-", ".jpg", directory);
            cameraUri = FileProvider.getUriForFile(this, getPackageName() + ".files", photo);
            camera.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
            camera.setClipData(ClipData.newUri(getContentResolver(), "Lab photo", cameraUri));
            camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            return camera;
        } catch (IOException exception) {
            cameraUri = null;
            return null;
        }
    }

    private void finishFileChooser(Uri[] result) {
        if (fileCallback != null) {
            fileCallback.onReceiveValue(result);
            fileCallback = null;
        }
        cameraUri = null;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == SPEECH_REQUEST) {
            String spoken = "";
            if (resultCode == RESULT_OK && data != null) {
                ArrayList<String> matches = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
                if (matches != null && !matches.isEmpty()) spoken = matches.get(0);
            }
            final String text = spoken;
            webView.post(() -> webView.evaluateJavascript(
                    "window.onNativeSpeech&&window.onNativeSpeech(" + JSONObject.quote(text) + ")", null));
            return;
        }
        if (requestCode != FILE_CHOOSER_REQUEST) return;
        Uri result = null;
        if (resultCode == RESULT_OK) {
            if (data != null && data.getData() != null) result = data.getData();
            else result = cameraUri;
        }
        finishFileChooser(result == null ? null : new Uri[]{result});
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == SPEECH_PERMISSION_REQUEST) {
            boolean speechGranted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            PermissionRequest waiting = pendingPermissionRequest;
            pendingPermissionRequest = null;
            if (waiting != null) {
                if (speechGranted) waiting.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                else waiting.deny();
                return;
            }
            if (pendingRecorderStart) {
                pendingRecorderStart = false;
                if (speechGranted) startRecordingNow();
                else emitSpeech("onNativeAudioError", "permission-denied");
                return;
            }
            if (speechGranted) startStreamingNow();
            else Toast.makeText(this, "未授予麦克风权限，可改用键盘语音或直接输入文字", Toast.LENGTH_LONG).show();
            return;
        }
        if (requestCode != CAMERA_PERMISSION_REQUEST) return;
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (!granted) Toast.makeText(this, "未授予相机权限，可从文件中选择已有照片", Toast.LENGTH_LONG).show();
        launchFileChooser(pendingImageChooser, granted && pendingCameraCapture);
    }

    /** Persists the workspace access code in SharedPreferences so killing the
     *  app (or a WebView storage wipe) never forces a re-login. */
    public class VaultBridge {
        @android.webkit.JavascriptInterface
        public String loadCode() {
            return preferences.getString("savedAccessCode", "");
        }

        @android.webkit.JavascriptInterface
        public void saveCode(String code) {
            preferences.edit().putString("savedAccessCode", code == null ? "" : code).apply();
        }

        @android.webkit.JavascriptInterface
        public void clearCode() {
            preferences.edit().remove("savedAccessCode").apply();
        }
    }

    public class SpeechBridge {
        @android.webkit.JavascriptInterface
        public void recordStart() {
            runOnUiThread(() -> {
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    pendingRecorderStart = true;
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, SPEECH_PERMISSION_REQUEST);
                    return;
                }
                startRecordingNow();
            });
        }

        @android.webkit.JavascriptInterface
        public void recordStop() {
            runOnUiThread(MainActivity.this::stopRecordingNow);
        }

        @android.webkit.JavascriptInterface
        public void recordCancel() {
            runOnUiThread(() -> {
                recording = false;
                recordBuffer = null;
            });
        }

        @android.webkit.JavascriptInterface
        public void startSpeech() {
            runOnUiThread(() -> {
                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "zh-CN");
                intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "请说出本次测试条件");
                if (intent.resolveActivity(getPackageManager()) != null) {
                    try {
                        startActivityForResult(intent, SPEECH_REQUEST);
                        return;
                    } catch (Exception ignored) { /* fall through to service */ }
                }
                if (SpeechRecognizer.isRecognitionAvailable(MainActivity.this)) {
                    startStreamingSpeech();
                    return;
                }
                Toast.makeText(MainActivity.this, "系统没有可用的语音识别服务，请在设置中启用语音助手/语音服务；也可直接输入文字", Toast.LENGTH_LONG).show();
            });
        }
    }

    private void startRecordingNow() {
        if (recording) return;
        int bufferSize = Math.max(AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT), 16000);
        try {
            audioRecord = new AudioRecord(MediaRecorder.AudioSource.MIC, 16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, bufferSize);
        } catch (Exception error) {
            emitSpeech("onNativeAudioError", "recorder-unavailable");
            return;
        }
        if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
            audioRecord.release();
            audioRecord = null;
            emitSpeech("onNativeAudioError", "recorder-unavailable");
            return;
        }
        recordBuffer = new ByteArrayOutputStream();
        recording = true;
        emitSpeech("onNativeRecordingStart", "");
        try {
            audioRecord.startRecording();
        } catch (Exception error) {
            recording = false;
            emitSpeech("onNativeAudioError", "recorder-unavailable");
            return;
        }
        recordThread = new Thread(() -> {
            byte[] chunk = new byte[3200];
            long deadline = System.currentTimeMillis() + 30000;
            while (recording && System.currentTimeMillis() < deadline) {
                int read;
                try {
                    read = audioRecord.read(chunk, 0, chunk.length);
                } catch (Exception error) {
                    break;
                }
                if (read > 0 && recordBuffer != null) recordBuffer.write(chunk, 0, read);
            }
            runOnUiThread(MainActivity.this::stopRecordingNow);
        });
        recordThread.start();
    }

    private void stopRecordingNow() {
        if (!recording && audioRecord == null) return;
        recording = false;
        AudioRecord recorder = audioRecord;
        audioRecord = null;
        if (recorder != null) {
            try {
                recorder.stop();
            } catch (Exception ignored) { }
            try {
                recorder.release();
            } catch (Exception ignored) { }
        }
        byte[] pcm = recordBuffer == null ? new byte[0] : recordBuffer.toByteArray();
        recordBuffer = null;
        if (pcm.length < 3200) {
            emitSpeech("onNativeAudioError", "too-short");
            return;
        }
        byte[] wav = wavBytes(pcm, 16000);
        String encoded = Base64.encodeToString(wav, Base64.NO_WRAP);
        webView.post(() -> webView.evaluateJavascript(
                "window.onNativeAudio&&window.onNativeAudio('" + encoded + "')", null));
    }

    private byte[] wavBytes(byte[] pcm, int sampleRate) {
        int dataSize = pcm.length;
        byte[] header = new byte[44];
        header[0] = 'R'; header[1] = 'I'; header[2] = 'F'; header[3] = 'F';
        writeIntLE(header, 4, 36 + dataSize);
        header[8] = 'W'; header[9] = 'A'; header[10] = 'V'; header[11] = 'E';
        header[12] = 'f'; header[13] = 'm'; header[14] = 't'; header[15] = ' ';
        writeIntLE(header, 16, 16);
        writeShortLE(header, 20, 1);
        writeShortLE(header, 22, 1);
        writeIntLE(header, 24, sampleRate);
        writeIntLE(header, 28, sampleRate * 2);
        writeShortLE(header, 32, 2);
        writeShortLE(header, 34, 16);
        header[36] = 'd'; header[37] = 'a'; header[38] = 't'; header[39] = 'a';
        writeIntLE(header, 40, dataSize);
        byte[] wav = new byte[44 + dataSize];
        System.arraycopy(header, 0, wav, 0, 44);
        System.arraycopy(pcm, 0, wav, 44, dataSize);
        return wav;
    }

    private void writeIntLE(byte[] target, int offset, int value) {
        target[offset] = (byte) (value & 0xFF);
        target[offset + 1] = (byte) ((value >> 8) & 0xFF);
        target[offset + 2] = (byte) ((value >> 16) & 0xFF);
        target[offset + 3] = (byte) ((value >> 24) & 0xFF);
    }

    private void writeShortLE(byte[] target, int offset, int value) {
        target[offset] = (byte) (value & 0xFF);
        target[offset + 1] = (byte) ((value >> 8) & 0xFF);
    }

    private void startStreamingSpeech() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, SPEECH_PERMISSION_REQUEST);
            return;
        }
        startStreamingNow();
    }

    private void startStreamingNow() {
        if (speechRecognizer != null) {
            speechRecognizer.destroy();
            speechRecognizer = null;
        }
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle params) {}
            @Override public void onBeginningOfSpeech() {}
            @Override public void onRmsChanged(float rmsdB) {}
            @Override public void onBufferReceived(byte[] buffer) {}
            @Override public void onEndOfSpeech() {}
            @Override public void onEvent(int eventType, Bundle params) {}
            @Override public void onPartialResults(Bundle partialResults) {
                emitSpeech("onNativeSpeechPartial", firstResult(partialResults));
            }
            @Override public void onResults(Bundle results) {
                emitSpeech("onNativeSpeech", firstResult(results));
            }
            @Override public void onError(int error) {
                emitSpeech("onNativeSpeechError", String.valueOf(error));
            }
        });
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "zh-CN");
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        speechRecognizer.startListening(intent);
    }

    private String firstResult(Bundle bundle) {
        ArrayList<String> matches = bundle == null ? null : bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        return matches != null && !matches.isEmpty() ? matches.get(0) : "";
    }

    private void emitSpeech(String functionName, String text) {
        webView.post(() -> webView.evaluateJavascript(
                "window." + functionName + "&&window." + functionName + "(" + JSONObject.quote(text) + ")", null));
    }

    @Override
    protected void onDestroy() {
        recording = false;
        if (audioRecord != null) {
            try {
                audioRecord.stop();
                audioRecord.release();
            } catch (Exception ignored) { }
            audioRecord = null;
        }
        if (speechRecognizer != null) {
            speechRecognizer.destroy();
            speechRecognizer = null;
        }
        super.onDestroy();
    }

    private void showServerDialog() {
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setHint(DEFAULT_SERVER_URL);
        input.setText(serverUrl);
        input.setSelection(input.getText().length());
        input.setPadding(dp(12), dp(10), dp(12), dp(10));

        TextView help = new TextView(this);
        help.setText("课题组安全地址已自动填写，通常不需要修改。照片和资料仍保存在实验室 Mac Mini；只有管理员通知更换域名时才修改这里。");
        help.setTextColor(Color.rgb(91, 105, 98));
        help.setTextSize(13);
        help.setPadding(0, 0, 0, dp(12));

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(22), dp(8), dp(22), dp(4));
        content.addView(help);
        content.addView(input, new LinearLayout.LayoutParams(-1, dp(48)));

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle("连接宁志军课题组服务器")
                .setView(content)
                .setPositiveButton("连接", null)
                .setNegativeButton("取消", null)
                .create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view -> {
            String normalized = normalizeUrl(input.getText().toString());
            if (normalized == null) {
                input.setError("请输入完整的 https:// 服务器地址");
                return;
            }
            serverUrl = normalized;
            preferences.edit().putString(SERVER_KEY, serverUrl).apply();
            dialog.dismiss();
            loadWorkspace();
        }));
        dialog.show();
    }

    private String normalizeUrl(String value) {
        String candidate = value == null ? "" : value.trim();
        Uri uri = Uri.parse(candidate);
        String scheme = uri.getScheme();
        if (uri.getHost() == null || !"https".equalsIgnoreCase(scheme)) return null;
        if (uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null) return null;
        while (candidate.endsWith("/")) candidate = candidate.substring(0, candidate.length() - 1);
        return candidate;
    }

    private boolean isLegacyServer(String value) {
        return "http://Mac-Mini地址:8767".equalsIgnoreCase(value)
                || "http://100.72.137.2:8767".equalsIgnoreCase(value)
                || "http://10.20.183.11:8767".equalsIgnoreCase(value);
    }

    private void checkForNativeUpdate() {
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                URL metadataUrl = new URL(DEFAULT_SERVER_URL + "/version.json?android=" + System.currentTimeMillis());
                connection = (HttpURLConnection) metadataUrl.openConnection();
                connection.setConnectTimeout(8000);
                connection.setReadTimeout(8000);
                connection.setUseCaches(false);
                connection.setRequestProperty("Accept", "application/json");
                if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) return;
                StringBuilder payload = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) payload.append(line);
                }
                JSONObject android = new JSONObject(payload.toString()).optJSONObject("android");
                if (android == null) return;
                int remoteCode = android.optInt("versionCode", 0);
                String remoteName = android.optString("versionName", "新版");
                String download = android.optString("apkUrl", "");
                if (remoteCode <= BuildConfig.VERSION_CODE || download.isEmpty()) return;
                URL resolved = new URL(metadataUrl, download);
                runOnUiThread(() -> showUpdateDialog(remoteName, resolved.toString()));
            } catch (Exception ignored) {
                // An unavailable update service must not prevent the workspace from opening.
            } finally {
                if (connection != null) connection.disconnect();
            }
        }).start();
    }

    private void showUpdateDialog(String versionName, String downloadUrl) {
        if (isFinishing()) return;
        new AlertDialog.Builder(this)
                .setTitle("发现应用更新")
                .setMessage("宁志军课题组工作台 " + versionName + " 已发布。下载后，Android 会请你确认安装。")
                .setPositiveButton("下载更新", (dialog, which) -> {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(downloadUrl)));
                    } catch (Exception exception) {
                        Toast.makeText(this, "无法打开下载地址，请稍后重试", Toast.LENGTH_LONG).show();
                    }
                })
                .setNegativeButton("稍后", null)
                .show();
    }

    private boolean sameOrigin(Uri target) {
        Uri base = Uri.parse(activeServerUrl);
        if (target.getHost() == null || base.getHost() == null) return false;
        int targetPort = target.getPort() == -1 ? ("https".equals(target.getScheme()) ? 443 : 80) : target.getPort();
        int basePort = base.getPort() == -1 ? ("https".equals(base.getScheme()) ? 443 : 80) : base.getPort();
        return target.getHost().equalsIgnoreCase(base.getHost())
                && targetPort == basePort
                && target.getScheme().equalsIgnoreCase(base.getScheme());
    }

    private void loadWorkspace() {
        if (webView != null && !serverUrl.isEmpty()) {
            activeServerUrl = serverUrl;
            webView.setVisibility(View.VISIBLE);
            if (connectionError != null) connectionError.setVisibility(View.GONE);
            webView.loadUrl(activeServerUrl + "/");
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
