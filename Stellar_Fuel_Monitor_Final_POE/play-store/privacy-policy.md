# Stellar Fuel Monitor Privacy Policy — Publication Draft

**Effective date:** 15 October 2026  
**Contact:** `<replace-with-real-support-email-before-publication>`

Stellar Fuel Monitor is a fleet-fuel monitoring and investigation application. This policy describes the information the application may process when connected to its configured cloud environment.

## Information processed

The application may process a user's Firebase account identifier, display name and email address for authentication. It may register a device identifier and Firebase Cloud Messaging token to deliver notifications. Users can submit fleet-investigation notes, alert-review information, watchlist priorities and user-selected images or PDF evidence. The application also displays operational fleet, trip and fuel information supplied by the configured backend.

## How information is used

Information is used to authenticate users, provide fleet-monitoring functionality, synchronise supported offline actions, deliver operational notifications, persist investigation workflows and store evidence associated with fleet records.

## Cloud service providers

Depending on deployment configuration, the application uses Firebase Authentication / Cloud Messaging, a hosted custom REST API, MongoDB-compatible database services and Microsoft Azure Blob Storage. These providers process information as necessary to deliver their configured services and are subject to their own terms and privacy practices.

## Offline storage

The Android application stores selected response snapshots and pending supported actions in a local SQLite database so that parts of the app remain useful when connectivity is interrupted. Pending actions are synchronised with the configured API when network connectivity returns.

## Security

The release build is intended to communicate with the custom API over HTTPS. Authentication and cloud-service secrets are not intentionally embedded in the public source repository. Reasonable technical controls are used, but no software system can guarantee absolute security.

## Retention and deletion

Retention and deletion periods depend on the organisation operating the deployed backend. Before public publication, the operator must define the retention schedule and provide a real contact or deletion-request mechanism. Push registrations can be unregistered from the application when notifications are disabled, but backend retention policies must still be administered by the deployment owner.

## Children's privacy

The application is designed for an operational/academic fleet-management context and is not intended for children.

## Changes

This policy may be updated when the deployed services or data practices change. The effective date should be updated whenever a material change is published.

> **Publication blocker:** replace the contact placeholder, host this policy at a public HTTPS URL, and verify that this draft matches the final deployed system before using it in Play Console.
