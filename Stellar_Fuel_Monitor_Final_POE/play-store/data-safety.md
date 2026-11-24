# Play Console Data Safety — Working Draft

This is a **review worksheet**, not a substitute for answering the live Play Console form. Reconfirm the final deployed behaviour before publication.

## Data types used by the current code

| Data | Why used | Typical handling |
|---|---|---|
| Email address / Firebase user ID | Authentication/session identity and push-token association | Processed through Firebase; user ID/email may be sent to the custom API with push registration |
| Device/app identifier | Stable hashed Android identifier for push registration management | Sent to custom API; used to register/unregister the phone |
| FCM registration token | Deliver notifications to the device | Stored by custom API/MongoDB; should be treated as sensitive operational data |
| User-selected image/PDF evidence | Fleet investigation evidence | Sent to custom API and stored in Azure Blob Storage; metadata stored in MongoDB |
| Investigation notes / alert comments / watchlist priorities | Operational workflow | Sent to custom API and persisted in MongoDB |
| Fleet/vehicle/trip/fuel data | Core business functionality | Read/written through custom API; backend storage depends on deployment |

## Security characteristics to verify

- Release Android build blocks cleartext HTTP and should use HTTPS only.
- Secrets are not stored in the repository.
- Firebase Authentication handles SSO credentials; the app does not collect user passwords for Google/Microsoft SSO.
- Evidence uploads are intentionally limited to supported file types and 5 MB.
- Cloud host/database/storage access controls are the deployment team's responsibility.

## Items that require a final policy decision

- Data retention periods for evidence, alert reviews, watchlist records and push tokens.
- User/account deletion process and any required public deletion URL.
- Whether data is shared with any third party beyond service processors such as Firebase, Azure and the database host.
- Whether analytics/crash reporting is enabled in the final Firebase project (the current source does not add an analytics SDK explicitly).
- Whether the app is actually distributed publicly or only used for academic/private demonstration.

Answer Play Console declarations according to the **real production deployment**, not this draft alone.
