# AI Usage Write-Up — Final POE

Generative AI was used as a development-support tool during the Final POE, not as a substitute for understanding or assessment evidence. Its use focused on reviewing the assessment requirements, proposing implementation structures, generating and refactoring selected Kotlin/Node.js code, identifying integration risks, improving validation/error handling, drafting automated tests, and preparing technical documentation/checklists.

AI assistance was used for the Final POE additions including the biometric authentication flow, SQLite/WorkManager offline synchronisation architecture, Firebase Cloud Messaging integration, runtime localisation structure, Azure Blob evidence-upload flow, Fleet Watchlist feature, GitHub Actions release workflow and Play Store-readiness documentation. AI was also used to inspect code for syntax/consistency problems and to suggest security improvements such as keeping credentials outside source control and disabling cleartext traffic in release builds.

The group remains responsible for reviewing, understanding and testing every change. AI-generated suggestions were adapted to the existing Stellar Fuel Monitor architecture instead of being copied blindly. Automated syntax checks and unit tests were run where the available environment allowed. Android compilation, Firebase delivery, biometric operation, offline reconnection behaviour and the release APK/AAB must additionally be verified in Android Studio/GitHub Actions and on a physical Android device before submission.

External technical concepts were cross-checked against official Android and Firebase documentation. See `docs/TECHNICAL_REFERENCES.md` for the implementation references used for biometrics, WorkManager/network constraints, Firebase Cloud Messaging and Android/Play signing. No passwords, Firebase service-account private keys, Azure SAS secrets or release keystores were intentionally placed in AI prompts or committed to the repository.

All final screenshots, cloud-console evidence, GitHub history and demonstration footage must reflect the group's real system and real execution rather than generated or fabricated evidence.
