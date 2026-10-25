# NeorMenuCustomizer

[![Latest Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](CHANGELOG.md)
[![Matomo Version](https://img.shields.io/badge/matomo-5.x-orange.svg)](https://matomo.org)
[![PHP Version](https://img.shields.io/badge/php-%3E%3D%208.1-777bb4.svg)](https://php.net)
[![License: GPL v3+](https://img.shields.io/badge/license-GPL--3.0--or--later-green.svg)](LICENSE)

A Matomo 5 plugin that lets SuperUsers reorder and hide categories and reports in the Reporting Menu (left sidebar) through **Administration → System → Reporting Menu**.

## Features

- **Visual Drag-and-Drop Manager**: Reorder categories and reports within each category.
- **Visibility Controls**: Hide individual reports or entire categories.
- **Global Settings**: Apply the same menu configuration to all users.
- **Search**: Find categories and reports by name.
- **Expand and Collapse**: Open or close all category cards.
- **Quick Reset**: Restore Matomo's default menu order and visibility.
- **New Reports**: Keep newly discovered categories and reports available without resetting the saved configuration.
- **Unsaved Changes Warning**: Warn before leaving the page with unsaved edits.
- **Translations**: English (`en`) and Russian (`ru`).

Menu visibility is a navigation preference. Hiding an item does not revoke access to its report or API.

## Requirements

- **Matomo**: `>= 5.0.0, < 6.0.0`
- **PHP**: `>= 8.1.0`
- **Administration**: SuperUser access to manage the menu configuration.

## Installation

### Via Git

Clone the repository into your Matomo `plugins/` directory:

```bash
cd /path/to/matomo/plugins
git clone https://github.com/neor/Matomo-NeorMenuCustomizer.git NeorMenuCustomizer
```

### Manual Download

1. Download the release archive from [GitHub Releases](https://github.com/neor/Matomo-NeorMenuCustomizer/releases) when a release is available.
2. Extract the plugin into your Matomo installation as `plugins/NeorMenuCustomizer`. The `plugin.json` file must be directly inside that directory.
3. Ensure the web server can read the plugin files.

### Activation

Activate **NeorMenuCustomizer** under **Administration → Plugins**, or run this command from the Matomo root directory:

```bash
php console plugin:activate NeorMenuCustomizer
```

## Usage

1. Sign in as a SuperUser and open **Administration → System → Reporting Menu**.
2. Drag a category by its handle to change its position.
3. Expand a category and drag its reports to reorder them within that category.
4. Use **Visible** / **Hidden** to toggle a category or report.
5. Click **Save Changes** to apply the configuration to all users.
6. Use **Reset to Defaults** to remove the saved configuration.

## Technical Details

- **Hook**: `API.API.getReportPagesMetadata.end` filters hidden pages and adjusts category and subcategory order metadata.
- **Frontend**: Uses Matomo's bundled Vue 3 and native HTML5 Drag and Drop; no separate frontend build is required.
- **Storage**: Saves JSON in the Matomo option `NeorMenuCustomizer.menuConfig`, with autoload enabled. No plugin-specific tables are created.

## Testing

The repository includes a standalone smoke test at `tests/MenuCustomizerTest.php`. From the root of a configured Matomo installation with this plugin activated, run:

```bash
php plugins/NeorMenuCustomizer/tests/MenuCustomizerTest.php
```

Run this test only on a disposable development installation. It boots Matomo with SuperUser privileges and writes to the configured database while exercising menu discovery, category filtering, and controller save/reset operations. It attempts to restore the previous configuration in a `finally` block, but explicit `exit()` calls on failed assertions can bypass that restoration.

This script is not a PHPUnit suite or a complete security test suite.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

Released under the [GNU General Public License v3 or later](LICENSE).

## Author

Developed by **Nikolay Lisienko** | [Neor Digital](https://neor.digital/)
