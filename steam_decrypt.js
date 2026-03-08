Java.perform(function() {
    var KeyStore = Java.use("java.security.KeyStore");
    var Cipher = Java.use("javax.crypto.Cipher");
    var GCMParameterSpec = Java.use("javax.crypto.spec.GCMParameterSpec");
    var Base64 = Java.use("android.util.Base64");
    var JavaString = Java.use("java.lang.String");

    try {
        var ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);

        var aliases = ks.aliases();
        console.log("=== KEYSTORE ALIASES ===");
        while (aliases.hasMoreElements()) {
            var alias = aliases.nextElement().toString();
            console.log("Alias: " + alias);
            try {
                var rawKey = ks.getKey(alias, null);
                if (rawKey !== null) {
                    // Read encrypted data from SecureStore
                    var prefs = Java.use("android.app.ActivityThread")
                        .currentApplication()
                        .getSharedPreferences("SecureStore", 0);
                    var json = prefs.getString("key_v1-SteamGuard_1", null);
                    if (json !== null) {
                        var obj = JSON.parse(json.toString());
                        var ct = obj.ct;
                        var iv = obj.iv;
                        var ivBytes = Base64.decode(iv, 0);
                        var ctBytes = Base64.decode(ct, 0);
                        var cipher = Cipher.getInstance("AES/GCM/NoPadding");
                        var spec = GCMParameterSpec.$new(128, ivBytes);
                        cipher.init(2, rawKey, spec);
                        var plain = cipher.doFinal(ctBytes);
                        var result = JavaString.$new(plain, "UTF-8");
                        console.log("=== DECRYPTED STEAM SECRET ===");
                        console.log(result.toString());
                        console.log("==============================");
                    }
                }
            } catch(e2) {
                console.log("  -> failed: " + e2.message);
            }
        }
    } catch(e) {
        console.log("Error: " + e);
    }
});
