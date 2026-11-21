# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.1.0] - 2026-11-21

### Added

- Gladys notifications as Pushsafer pushes on iOS, Android, Windows and browsers: each user chooses their device or device group in the "My account" block, the administrator enters the private key of the account once.
- Camera snapshots and other images attached by Gladys go with the push.
- Default title, icon, sound, vibration, priority (up to critical alerts) and time to live of the notifications in the configuration.
- Scene triggers: push not sent (once per failure, never looping), API calls low.
- Scene action: send a push to any device or group, with its own title, priority, sound, icon, color, link, time to live and repetition until read.
- Dashboard widgets: the account (API calls left, pushes of the month, key, devices, last failure) and the last pushes of Gladys.
- Configuration screen buttons: test the connection (lists the devices and groups with their IDs), send a test push.
- Cloud transport only; English, French, German and Spanish everywhere.

[0.1.0]: https://github.com/William-De71/gladys-pushsafer/releases/tag/v0.1.0
