# Important — do not forward Firebase Admin SDK keys

This handover intentionally excludes the service-account JSON uploaded into the chat. The private key is a credential and must not be placed in source, committed to GitHub, included in an APK, or circulated by WhatsApp.

To finish the setup, the Firebase project owner must **rotate that uploaded key** and enter the replacement credential directly into the backend host's private environment-variable/secret settings (or use workload identity if supported). The project ID is not secret and is included in the guidance. The code supports `FIREBASE_SERVICE_ACCOUNT_BASE64` for the private host configuration.

After confirming the replacement works, disable and delete the previous key through Google Cloud IAM. Remove local copies that are no longer required. Neither the new key nor the old one should be added to this ZIP.

Official Google guidance: https://cloud.google.com/docs/iam/docs/keys-create-delete
