<?php

/**
 * Matomo - free/libre analytics platform
 *
 * @link    https://matomo.org
 * @license https://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

namespace Piwik\Plugins\NeorMenuCustomizer;

use Piwik\Plugin;

class NeorMenuCustomizer extends Plugin
{
    public function registerEvents(): array
    {
        return [
            'API.API.getReportPagesMetadata.end'    => 'filterAndReorderPages',
            'AssetManager.getJavaScriptFiles'       => 'getJsFiles',
            'AssetManager.getStylesheetFiles'       => 'getCssFiles',
            'Translate.getClientSideTranslationKeys' => 'getClientSideTranslationKeys',
        ];
    }

    /**
     * Intercepts API.getReportPagesMetadata to filter out hidden items
     * and apply custom user-defined sorting for categories and subcategories.
     *
     * @param array<int, array<string, mixed>> &$returnedValue
     * @param array<string, mixed> $extraInfo
     */
    public function filterAndReorderPages(&$returnedValue, array $extraInfo): void
    {
        if (!is_array($returnedValue) || empty($returnedValue)) {
            return;
        }

        $api = API::getInstance();
        $savedConfig = $api->getSavedConfig();
        if (empty($savedConfig) || empty($savedConfig['items']) || !is_array($savedConfig['items'])) {
            return;
        }

        $catRules = [];
        $subRules = [];

        foreach ($savedConfig['items'] as $catIdx => $cat) {
            $catId = (string) ($cat['id'] ?? '');
            if (!$catId) {
                continue;
            }

            $catRules[$catId] = [
                'hidden' => !empty($cat['hidden']),
                'order'  => ($catIdx + 1) * 10,
            ];

            if (!empty($cat['subcategories']) && is_array($cat['subcategories'])) {
                foreach ($cat['subcategories'] as $subIdx => $sub) {
                    $subId = (string) ($sub['id'] ?? '');
                    if (!$subId) {
                        continue;
                    }
                    $key = $catId . '.' . $subId;
                    $subRules[$key] = [
                        'hidden' => !empty($sub['hidden']),
                        'order'  => ($subIdx + 1) * 10,
                    ];
                }
            }
        }

        $filtered = [];
        foreach ($returnedValue as $page) {
            $catId = (string) ($page['category']['id'] ?? '');
            $subId = (string) ($page['subcategory']['id'] ?? '');
            $pageKey = $catId . '.' . $subId;

            // Skip if category is marked as hidden
            if (!empty($catRules[$catId]['hidden'])) {
                continue;
            }

            // Skip if subcategory is marked as hidden
            if (!empty($subRules[$pageKey]['hidden'])) {
                continue;
            }

            // Apply custom category ordering
            if (isset($catRules[$catId]['order'])) {
                $page['category']['order'] = $catRules[$catId]['order'];
            }

            // Apply custom subcategory ordering
            if (isset($subRules[$pageKey]['order'])) {
                $page['subcategory']['order'] = $subRules[$pageKey]['order'];
            }

            $filtered[] = $page;
        }

        $returnedValue = $filtered;
    }

    public function getJsFiles(array &$jsFiles): void
    {
        $jsFiles[] = 'plugins/NeorMenuCustomizer/javascripts/menu-customizer.js';
    }

    public function getCssFiles(array &$stylesheets): void
    {
        $stylesheets[] = 'plugins/NeorMenuCustomizer/stylesheets/menu-customizer.css';
    }

    public function getClientSideTranslationKeys(array &$translationKeys): void
    {
        $translationKeys[] = 'NeorMenuCustomizer_MenuReportingCustomizer';
        $translationKeys[] = 'NeorMenuCustomizer_PageTitle';
        $translationKeys[] = 'NeorMenuCustomizer_PageDescription';
        $translationKeys[] = 'NeorMenuCustomizer_Save';
        $translationKeys[] = 'NeorMenuCustomizer_Saving';
        $translationKeys[] = 'NeorMenuCustomizer_SavedSuccess';
        $translationKeys[] = 'NeorMenuCustomizer_SaveError';
        $translationKeys[] = 'NeorMenuCustomizer_Reset';
        $translationKeys[] = 'NeorMenuCustomizer_ResetConfirm';
        $translationKeys[] = 'NeorMenuCustomizer_ResetSuccess';
        $translationKeys[] = 'NeorMenuCustomizer_SearchPlaceholder';
        $translationKeys[] = 'NeorMenuCustomizer_AllVisible';
        $translationKeys[] = 'NeorMenuCustomizer_HiddenCount';
        $translationKeys[] = 'NeorMenuCustomizer_DragCategoryHint';
        $translationKeys[] = 'NeorMenuCustomizer_DragSubcategoryHint';
        $translationKeys[] = 'NeorMenuCustomizer_VisibilityToggle';
        $translationKeys[] = 'NeorMenuCustomizer_Visible';
        $translationKeys[] = 'NeorMenuCustomizer_Hidden';
        $translationKeys[] = 'NeorMenuCustomizer_NoItemsFound';
        $translationKeys[] = 'NeorMenuCustomizer_ExpandAll';
        $translationKeys[] = 'NeorMenuCustomizer_CollapseAll';
        $translationKeys[] = 'NeorMenuCustomizer_UnsavedChangesWarning';
    }
}
