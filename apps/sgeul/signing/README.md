# Sgeul upload signing

`upload-certificate.pem` is the **public upload certificate**, safe to keep in Git.
It is not a private key and is not Google Play's app-signing certificate.

The actual upload keystore and passwords are stored separately from this repository.
The owner must retain a secure private backup. Never publish a keystore or passwords
in `downloads/`, source files, release notes or screenshots. Use environment variables
for release signing:

- `SGEUL_UPLOAD_KEYSTORE`: absolute local path to the owner's `.p12` keystore
- `SGEUL_UPLOAD_STORE_PASSWORD`
- `SGEUL_UPLOAD_KEY_ALIAS`
- `SGEUL_UPLOAD_KEY_PASSWORD`

`npm run android:bundle` builds a release bundle and refuses unsigned release builds
when those variables are absent. Google Play App Signing manages the separate key
that signs installations distributed by Play. Keep its default Google-managed signing
option for this new app, unless the owner deliberately chooses another arrangement.

The first Play-signed installation cannot normally update the earlier debug-signed
APK. Back up any local reader notes before removing the old debug build; install
from the Play tester opt-in link once the internal release is available. Do not
uninstall the debug build merely to upload an AAB. Website accounts and entitlements
remain server-side; saved files must be saved again inside the new installation.
