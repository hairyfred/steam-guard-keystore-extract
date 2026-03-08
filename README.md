# Steam Guard Secret Extraction Guide (Android, Rooted)

A complete guide to extracting your Steam Guard shared secret from a rooted Android device and importing it into Bitwarden (or any TOTP app that supports the `steam://` format).

>  **Who is this for?** Anyone who wants to use a third-party authenticator app for Steam 2FA instead of (or as a backup to) the official Steam app. Requires a rooted Android phone.

---

> **Your Steam account is now in your hands.** I am not responsible for locked accounts, lost items, thermonuclear war, or you getting fired because you missed a trade confirmation. Please do some research if you have any concerns about extracting your Steam Guard secret before proceeding. YOU are choosing to make these modifications, and if you point the finger at me for messing up your account, I will laugh at you.

---

> 🤖 Yes, this is AI slop. The entire process was figured out with Claude, diagnosing each failure as it happened until it actually worked.

---

## Prerequisites

- A rooted Android phone with Steam Guard already set up (You have to be rooted, if you are not, this is not for you)
- A Windows PC
- USB cable
- Python 3 installed on your PC
- Bitwarden Premium (required for TOTP code generation) or the Bitwarden Authenticator App

---

## Part 1 — Set Up ADB

### 1.1 Enable Developer Options and USB Debugging

1. Go to **Settings → About Phone**
2. Tap **Build Number** 7 times to unlock Developer Options
3. Go to **Settings → Developer Options**
4. Enable **USB Debugging**
5. Connect your phone to your PC via USB
6. When prompted on your phone, tap **Allow** to authorise the connection

### 1.2 Download Platform Tools (ADB)

Run this in PowerShell to download ADB automatically:

```powershell
$u = "https://raw.githubusercontent.com/downthecrop/Steam-OTP-Extractor/main/steam-guard-extractor-windows.ps1"
$p = "$env:TEMP\steam-guard-extractor-windows.ps1"
Invoke-WebRequest $u -OutFile $p -UseBasicParsing
```

Or download [Android Platform Tools](https://developer.android.com/tools/releases/platform-tools) manually and extract it.

Set the ADB variable for use throughout this guide:

```powershell
$ADB = "$env:TEMP\steam_guard_extractor_work\platform-tools\adb.exe"
```

Verify your device is connected:

```powershell
& $ADB devices
```

You should see your device listed as `device`. If it says `unauthorized`, check your phone screen and tap **Allow**.

---

## Part 2 — Find Your Steam Guard Secret

Modern Steam (v3.x) stores your secret encrypted in the Android Keystore, not as plain text. There are two possible situations:

- **Legacy Steam (2.x) or backup file exists** → Secret is in a flat JSON file (easy)
- **Modern Steam (3.x)** → Secret is AES-encrypted in the Keystore (requires Frida)

### 2.1 Check Your Steam Version

```powershell
& $ADB shell dumpsys package com.valvesoftware.android.steam.community | findstr versionName
```

- If version is **2.x** → follow Part 3A
- If version is **3.x** → follow Part 3B

---

## Part 3A — Extract Secret (Steam 2.x / Legacy)

This method works if you have the legacy Steam app installed or a backup of it.

```powershell
& $ADB shell su -c "cat /data/data/com.valvesoftware.android.steam.community/files/Steamguard-*"
```

This prints a JSON blob. Find the `uri` field which looks like:

```
"uri":"otpauth://totp/Steam:yourusername?secret=YOURSECRETHERE&issuer=Steam"
```

Copy the value after `secret=` and before `&issuer`. That is your Base32 secret. Skip to **Part 5**.

---

## Part 3B — Extract Secret (Steam 3.x, Keystore Encrypted)

Modern Steam encrypts the secret using the Android Keystore. You need Frida to hook into the running app and decrypt it.

### 3B.1 Install Frida Tools

```powershell
pip install frida-tools
```

Check the installed version:

```powershell
& "$env:APPDATA\Python\Python312\Scripts\frida.exe" --version
```

### 3B.2 Download Frida Server

Replace `VERSION` with the version number from the previous step:

```powershell
$ver = "17.6.2"  # Replace with your actual version
Invoke-WebRequest "https://github.com/frida/frida/releases/download/$ver/frida-server-$ver-android-arm64.xz" -OutFile "$env:TEMP\frida-server.xz"
```

Extract it using 7-Zip:

```powershell
& "C:\Program Files\7-Zip\7z.exe" e "$env:TEMP\frida-server.xz" -o"$env:TEMP\frida\"
```

Or with Python if you don't have 7-Zip:

```powershell
python -c "import lzma, shutil; shutil.copyfileobj(lzma.open(r'$env:TEMP\frida-server.xz'), open(r'$env:TEMP\frida-server', 'wb'))"
```

### 3B.3 Push and Start Frida Server

```powershell
& $ADB push "$env:TEMP\frida\frida-server" /data/local/tmp/frida-server
& $ADB shell "su -c 'chmod 755 /data/local/tmp/frida-server && /data/local/tmp/frida-server &'"
```

This window will hang — that is normal. **Open a new PowerShell window** for the next steps.

Verify it is running:

```powershell
& "$env:APPDATA\Python\Python312\Scripts\frida-ps.exe" -U | Select-String "Steam"
```
### 3B.4 Download the Decryption Script

Download [steam_decrypt.js](https://raw.githubusercontent.com/hairyfred/steam-guard-keystore-extract/main/steam_decrypt.js) and save it anywhere on your PC. The examples below assume your Downloads folder — update the path in the command if you save it elsewhere.

### 3B.5 Run the Decryption Script

```powershell
& "$env:APPDATA\Python\Python312\Scripts\frida.exe" -U -f com.valvesoftware.android.steam.community -l "$env:USERPROFILE\Downloads\steam_decrypt.js"
```

The output will contain a JSON blob with your secrets, for example:

```json
{"accounts":{"76561198XXXXXXXXX":{"shared_secret":"XXXXXXXXXXXX=","identity_secret":"XXXXXXXXXXXX=", ...}}}
```

Copy the `shared_secret` value (the Base64 string ending in `=`).

---

## Part 4 — Convert the Secret to Base32

Bitwarden requires the secret in Base32 format. Run this in PowerShell, replacing the value with your actual `shared_secret`:

```powershell
python -c "import base64; b=base64.b64decode('YOUR_SHARED_SECRET_HERE='); print('steam://'+base64.b32encode(b).decode())"
```

This will output something like:

```
steam://ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEF
```

That is the value you need for Bitwarden.

---

## Part 5 — Add to Bitwarden

1. Open Bitwarden and find (or create) your Steam login entry
2. Edit the entry and find the **Authenticator Key (TOTP)** field
3. Paste the full `steam://XXXXX` string from Part 4
4. Save the entry

Bitwarden will now generate 5-character alphanumeric Steam codes that rotate every 30 seconds.

> **Verify it works** — compare the code shown in Bitwarden with the code in the Steam app. They should match exactly before you rely on Bitwarden as your authenticator.

---

## Part 6 — Clean Up

Remove sensitive files from your phone:

```powershell
& $ADB shell "su -c 'rm /data/local/tmp/frida-server /data/local/tmp/classes.dex 2>/dev/null'"
& $ADB shell "su -c 'rm /sdcard/SteamLocal.db /sdcard/RKStorage /sdcard/ue3.db 2>/dev/null'"
& $ADB shell "su -c 'pkill frida-server 2>/dev/null'"
```

Also delete `steam_decrypt.js` from your Downloads folder and clear your PowerShell history if you typed any secrets directly into the terminal.

---

## Troubleshooting

### `Split-Path` error when running the extractor script

The script uses `$PSCommandPath` which is null in nested PowerShell sessions. Fix it with:

```powershell
(Get-Content $p) -replace '\$ScriptDir = Split-Path.*', '$ScriptDir = if ($PSCommandPath) { Split-Path $PSCommandPath } elseif ($MyInvocation.MyCommand.Path) { Split-Path $MyInvocation.MyCommand.Path } else { $env:TEMP }' | Set-Content $p
```

### `adb backup` produces a ~47 byte file

`adb backup` is blocked on Android 12 and above. Use the Frida method (Part 3B) instead.

### Frida times out attaching to Steam

Steam may not be running. Use `-f` to spawn it fresh:

```powershell
& "$env:APPDATA\Python\Python312\Scripts\frida.exe" -U -f com.valvesoftware.android.steam.community -l "$env:USERPROFILE\Downloads\steam_decrypt.js"
```

### Bitwarden codes don't match Steam

Make sure you are using the `steam://` prefix followed by the **Base32** version of the secret, not the raw Base64 value from the JSON.

### `run-as: package not debuggable`

This is expected on release builds. Use the `su 10759` method or Frida instead.

---

## Notes

- `shared_secret` is used for login codes (TOTP). This is what you need for Bitwarden.
- `identity_secret` is used for trade and market confirmations. You only need this if you want to confirm trades outside the Steam app.
- `revocation_code` is your recovery code. Store it somewhere safe — it is the only way to recover your account if you lose access to your authenticator.
- These secrets are generated once when you set up Steam Guard. Keep them private and never share them.

---

*Guide based on real extraction from a rooted Google Pixel 9 Pro XL running Android 16 with Steam 3.10.9.*
