<?php

/**
 * Matomo - free/libre analytics platform
 *
 * @link    https://matomo.org
 * @license https://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

namespace Piwik\Plugins\NeorMenuCustomizer\tests;

if (!defined('PIWIK_DOCUMENT_ROOT')) {
    define('PIWIK_DOCUMENT_ROOT', realpath(__DIR__ . '/../../..'));
}
if (!defined('PIWIK_INCLUDE_PATH')) {
    define('PIWIK_INCLUDE_PATH', PIWIK_DOCUMENT_ROOT);
}
require_once PIWIK_INCLUDE_PATH . '/core/bootstrap.php';

use Piwik\Access;
use Piwik\Application\Environment;
use Piwik\Option;
use Piwik\Plugin\Manager as PluginManager;
use Piwik\Plugins\NeorMenuCustomizer\API;
use Piwik\Plugins\NeorMenuCustomizer\NeorMenuCustomizer;

if (\Piwik\Common::isPhpCliMode()) {
    $environment = new Environment('cli');
    $environment->init();
    PluginManager::getInstance()->loadActivatedPlugins();
    PluginManager::getInstance()->loadPluginTranslations();

    Access::doAsSuperUser(function () {
        // Backup existing live user configuration before running tests
        $backupConfig = Option::get(API::OPTION_KEY);

        try {
            $api = API::getInstance();
            $initial = $api->getMenuStructure();

            if (empty($initial['items'])) {
                echo "FAIL: No categories found in getMenuStructure\n";
                exit(1);
            }

            // Test save & filter
            $items = $initial['items'];
            $firstCatId = $items[0]['id'];
            $items[0]['hidden'] = true;

            $api->saveMenuConfig($items);

            $plugin = new NeorMenuCustomizer();
            $mockPages = [
                [
                    'category'    => ['id' => $firstCatId, 'name' => 'Cat1', 'order' => 10],
                    'subcategory' => ['id' => 'Sub1', 'name' => 'Sub1', 'order' => 5],
                ],
                [
                    'category'    => ['id' => 'OtherCat', 'name' => 'Cat2', 'order' => 20],
                    'subcategory' => ['id' => 'Sub2', 'name' => 'Sub2', 'order' => 5],
                ],
            ];

            $plugin->filterAndReorderPages($mockPages, []);

            if (count($mockPages) !== 1 || $mockPages[0]['category']['id'] !== 'OtherCat') {
                echo "FAIL: filterAndReorderPages did not properly hide category\n";
                exit(1);
            }

            $api->resetMenuConfig();

            // Test Controller save & reset with superuser
            $controller = new \Piwik\Plugins\NeorMenuCustomizer\Controller();
            $_SERVER['REQUEST_METHOD'] = 'POST';
            $_POST['items'] = json_encode($items);
            $_POST['token_auth'] = \Piwik\Piwik::getCurrentUserTokenAuth();

            $saveJson = $controller->save();
            $saveResult = json_decode($saveJson, true);
            if (empty($saveResult['success'])) {
                echo "FAIL: Controller save failed: " . ($saveResult['message'] ?? 'unknown error') . "\n";
                exit(1);
            }

            $resetJson = $controller->reset();
            $resetResult = json_decode($resetJson, true);
            if (empty($resetResult['success'])) {
                echo "FAIL: Controller reset failed: " . ($resetResult['message'] ?? 'unknown error') . "\n";
                exit(1);
            }

            echo "PASS: NeorMenuCustomizer tests completed successfully.\n";
        } finally {
            // Restore original live configuration so running tests never wipes user settings
            if ($backupConfig !== false && $backupConfig !== null) {
                Option::set(API::OPTION_KEY, $backupConfig, 1);
            } else {
                Option::delete(API::OPTION_KEY);
            }
        }
    });
}
