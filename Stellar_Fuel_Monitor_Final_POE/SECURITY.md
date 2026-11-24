# Security Notes

This academic repository intentionally keeps operational secrets outside source control.

Do not commit:

- `server/.env`
- MongoDB credentials
- Firebase service-account JSON/private keys
- Azure Blob SAS URLs
- OAuth client secrets
- FCM tokens
- Android `local.properties`
- release `.jks` / `.keystore` files or passwords

Release builds disable cleartext HTTP. Rotate any assessment credentials that are accidentally exposed and remove them from Git history before continuing. Use GitHub Secrets / deployment environment secrets for CI and hosting.
