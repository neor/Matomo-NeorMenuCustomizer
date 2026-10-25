# NeorMenuCustomizer Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.0] - 2026-10-22

### Added

- Initial release of **NeorMenuCustomizer** for Matomo 5 and PHP 8.1 or later.
- SuperUser administration page under **Administration → System → Reporting Menu**.
- Vue 3 interface with native drag and drop to reorder categories and reports within categories.
- Visibility controls for individual reports and entire categories, applied globally to all users.
- Search, expand/collapse controls, and a warning when leaving with unsaved edits.
- Save and reset actions with POST enforcement, SuperUser checks, and token or nonce validation.
- Configuration stored in the autoloaded Matomo option `NeorMenuCustomizer.menuConfig`.
- Metadata filtering and ordering through `API.API.getReportPagesMetadata.end`, preserving newly discovered reports and categories.
- English (`en`) and Russian (`ru`) translations.
- Standalone smoke test for menu discovery, category filtering, and controller save/reset actions.
- Installation, usage, and testing instructions, plus the GPL v3 license text.
