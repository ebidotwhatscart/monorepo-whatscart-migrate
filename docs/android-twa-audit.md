# Android TWA handoff audit

The manually modified Bubblewrap source is preserved under `bubblewrap/` and
now targets `https://app.whatscart.in`. Generated Gradle caches, build output,
APK/AAB files, local SDK paths, and signing keys are excluded.

## Confirmed

- Manual `Application`, `DelegationService`, and `LauncherActivity` Java source
  is present for both legacy package trees.
- The web manifest URL, full scope, host, and Android asset statement now use
  `app.whatscart.in` rather than the old Netlify hostname.
- The copied signed APK certificate has SHA-256 fingerprint
  `C7:B1:91:26:73:01:6C:47:60:A7:53:86:76:32:1C:BD:B8:3F:EA:2E:49:7F:3F:36:F4:80:DE:80:A1:69:2A:2C`.
- The signing keystore was deliberately removed from this target workspace and
  remains recoverable from the untouched source repository.

## Identity conflict requiring owner confirmation

The inherited Android artifacts disagree:

- Gradle currently declares `app.netlify.whatscart.twa`.
- `bubblewrap/assetlinks.json` declares
  `app.netlify.whats_cart_dev.twa` with the copied APK fingerprint.
- the web-served `public/well-known/assetlinks.json` declares
  `in.whatscart.twa` with fingerprint
  `CF:44:BC:10:1B:FC:A5:E0:7E:F1:F8:CF:27:ED:E0:AF:E5:5F:1E:BD:6B:52:58:80:87:0F:5E:62:3F:18:4A:84`.

Do not change the Android `applicationId`, replace the served asset link, or
publish an APK until the actual Play Console application ID and release-key
fingerprint are confirmed. Changing an application ID would create a different
Android app instead of upgrading the existing one.
