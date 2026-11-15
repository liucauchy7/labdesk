# `app.nzjlab.cn` deployment notes

The public hostname is `https://app.nzjlab.cn`. The local origin must remain bound to `127.0.0.1:8767`; do not configure router port forwarding for 8767.

The configured tunnel is named `ninglab-app` with ID `ffb04d12-7095-4469-8f42-787df5aa0f6c`. Its credentials remain outside this repository under `/Users/cauchyliu/.cloudflared/`.

## One-time Cloudflare setup

1. Add `nzjlab.cn` to a Cloudflare account and choose the Free plan.
2. Replace the Tencent Cloud/DNSPod authoritative nameservers with the two nameservers assigned by Cloudflare.
3. Wait until Cloudflare reports the zone as **Active**.
4. On the Mac mini, authorize `cloudflared` for that Cloudflare account:

   ```sh
   /Users/cauchyliu/.local/bin/cloudflared tunnel login
   ```

5. Create the named tunnel and DNS route:

   ```sh
   /Users/cauchyliu/.local/bin/cloudflared tunnel create ninglab-app
   /Users/cauchyliu/.local/bin/cloudflared tunnel route dns ninglab-app app.nzjlab.cn
   ```

6. The active `/Users/cauchyliu/.cloudflared/config.yml` is:

   ```yaml
   tunnel: ffb04d12-7095-4469-8f42-787df5aa0f6c
   credentials-file: /Users/cauchyliu/.cloudflared/ffb04d12-7095-4469-8f42-787df5aa0f6c.json

   ingress:
     - hostname: app.nzjlab.cn
       service: http://127.0.0.1:8767
     - service: http_status:404
   ```

Do not store `cert.pem`, the tunnel JSON credential, the application access code, or Cloudflare recovery codes in this repository or in the APK.

## Verification

Run the app server with a stable access code supplied through its environment or a private file, then start the tunnel in the foreground:

```sh
LAB_APP_TOKEN='<private-random-value>' python3 app/server.py
/Users/cauchyliu/.local/bin/cloudflared --config /Users/cauchyliu/.cloudflared/config.yml tunnel run ninglab-app
```

For the installed macOS LaunchAgent, the access code is stored outside the repository in a mode-`600` file and passed through `LAB_APP_TOKEN_FILE`. The server never prints a file-backed access code to its logs.

The background runtime and persistent data live outside the macOS-protected Documents folder:

- Runtime: `/Users/cauchyliu/Library/Application Support/NingLab/LabDesk/runtime`
- Data/photos: `/Users/cauchyliu/Library/Application Support/NingLab/LabDesk/data`
- Private access-code file: `/Users/cauchyliu/Library/Application Support/NingLab/LabDesk/secrets/access-code`

After changing the app source or building a newer APK, deploy the updated runtime with:

```sh
app/deploy-macos.sh
```

Verify both endpoints:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8767/
curl -sS -o /dev/null -w '%{http_code}\n' https://app.nzjlab.cn/
```

Finally test login, camera upload, and photo viewing from a phone using mobile data. Configure both the Python server and `cloudflared` as macOS services only after foreground verification succeeds.
