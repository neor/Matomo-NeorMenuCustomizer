<?php

/**
 * Matomo - free/libre analytics platform
 *
 * @link    https://matomo.org
 * @license https://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

namespace Piwik\Plugins\NeorMenuCustomizer;

use Exception;
use Piwik\Category\CategoryList;
use Piwik\Option;
use Piwik\Piwik;
use Piwik\Plugins\API\WidgetMetadata;
use Piwik\Widget\WidgetsList;

/**
 * API for NeorMenuCustomizer plugin.
 *
 * @method static \Piwik\Plugins\NeorMenuCustomizer\API getInstance()
 */
class API extends \Piwik\Plugin\API
{
    public const OPTION_KEY = 'NeorMenuCustomizer.menuConfig';

    /**
     * Returns full menu structure with saved visibility and order applied.
     *
     * @return array<string, mixed>
     */
    public function getMenuStructure(): array
    {
        Piwik::checkUserHasSuperUserAccess();

        $widgetsList  = WidgetsList::get();
        $categoryList = CategoryList::get();
        $metadata     = new WidgetMetadata();
        $pages        = $metadata->getPagesMetadata($categoryList, $widgetsList);

        // Group raw pages by category
        $rawCategories = [];
        foreach ($pages as $page) {
            $cat = $page['category'] ?? null;
            $sub = $page['subcategory'] ?? null;

            if (!$cat || empty($cat['id']) || !$sub || empty($sub['id'])) {
                continue;
            }

            $catId = (string) $cat['id'];
            $subId = (string) $sub['id'];

            if (!isset($rawCategories[$catId])) {
                $rawCategories[$catId] = [
                    'id'            => $catId,
                    'name'          => $cat['name'] ?? $catId,
                    'order'         => (int) ($cat['order'] ?? 50),
                    'icon'          => $cat['icon'] ?? '',
                    'hidden'        => false,
                    'subcategories' => [],
                ];
            }

            if (!isset($rawCategories[$catId]['subcategories'][$subId])) {
                $rawCategories[$catId]['subcategories'][$subId] = [
                    'id'     => $subId,
                    'name'   => $sub['name'] ?? $subId,
                    'order'  => (int) ($sub['order'] ?? 50),
                    'hidden' => false,
                ];
            }
        }

        // Load saved configuration
        $savedConfig = $this->getSavedConfig();

        if (empty($savedConfig) || empty($savedConfig['items'])) {
            // Sort by default orders
            $items = array_values($rawCategories);
            usort($items, fn($a, $b) => $a['order'] <=> $b['order']);
            foreach ($items as &$cat) {
                $subs = array_values($cat['subcategories']);
                usort($subs, fn($a, $b) => $a['order'] <=> $b['order']);
                $cat['subcategories'] = $subs;
            }
            unset($cat);

            return [
                'hasCustomConfig' => false,
                'items'           => $items,
            ];
        }

        // Apply saved order and hidden state
        $orderedItems = [];
        $handledCategories = [];

        foreach ($savedConfig['items'] as $savedCat) {
            $catId = (string) ($savedCat['id'] ?? '');
            if (!$catId || !isset($rawCategories[$catId])) {
                continue;
            }

            $handledCategories[$catId] = true;
            $cat = $rawCategories[$catId];
            $cat['hidden'] = !empty($savedCat['hidden']);

            $orderedSubs = [];
            $handledSubs = [];

            if (!empty($savedCat['subcategories']) && is_array($savedCat['subcategories'])) {
                foreach ($savedCat['subcategories'] as $savedSub) {
                    $subId = (string) ($savedSub['id'] ?? '');
                    if (!$subId || !isset($cat['subcategories'][$subId])) {
                        continue;
                    }
                    $handledSubs[$subId] = true;
                    $sub = $cat['subcategories'][$subId];
                    $sub['hidden'] = !empty($savedSub['hidden']);
                    $orderedSubs[] = $sub;
                }
            }

            // Append any new subcategories that weren't in saved config
            foreach ($cat['subcategories'] as $subId => $sub) {
                if (!isset($handledSubs[$subId])) {
                    $orderedSubs[] = $sub;
                }
            }

            $cat['subcategories'] = $orderedSubs;
            $orderedItems[] = $cat;
        }

        // Append any new categories that weren't in saved config
        foreach ($rawCategories as $catId => $cat) {
            if (!isset($handledCategories[$catId])) {
                $subs = array_values($cat['subcategories']);
                usort($subs, fn($a, $b) => $a['order'] <=> $b['order']);
                $cat['subcategories'] = $subs;
                $orderedItems[] = $cat;
            }
        }

        return [
            'hasCustomConfig' => true,
            'items'           => $orderedItems,
        ];
    }

    /**
     * Saves user-configured menu ordering and visibility.
     *
     * @param array<int, array<string, mixed>> $items
     * @return array<string, bool>
     * @throws Exception
     */
    public function saveMenuConfig(array $items): array
    {
        Piwik::checkUserHasSuperUserAccess();

        $cleanItems = [];
        foreach ($items as $cat) {
            if (!is_array($cat) || empty($cat['id'])) {
                continue;
            }

            $cleanCat = [
                'id'            => (string) $cat['id'],
                'hidden'        => !empty($cat['hidden']),
                'subcategories' => [],
            ];

            if (!empty($cat['subcategories']) && is_array($cat['subcategories'])) {
                foreach ($cat['subcategories'] as $sub) {
                    if (!is_array($sub) || empty($sub['id'])) {
                        continue;
                    }
                    $cleanCat['subcategories'][] = [
                        'id'     => (string) $sub['id'],
                        'hidden' => !empty($sub['hidden']),
                    ];
                }
            }

            $cleanItems[] = $cleanCat;
        }

        $payload = [
            'version'    => 1,
            'updated_at' => time(),
            'items'      => $cleanItems,
        ];

        Option::set(self::OPTION_KEY, json_encode($payload), 1);

        return ['success' => true];
    }

    /**
     * Resets menu customization to defaults.
     *
     * @return array<string, bool>
     */
    public function resetMenuConfig(): array
    {
        Piwik::checkUserHasSuperUserAccess();

        Option::delete(self::OPTION_KEY);

        return ['success' => true];
    }

    /**
     * Helper to retrieve saved config from Option storage.
     *
     * @return array<string, mixed>|null
     */
    public function getSavedConfig(): ?array
    {
        $raw = Option::get(self::OPTION_KEY);
        if (!$raw || !is_string($raw)) {
            return null;
        }

        $data = json_decode($raw, true);
        if (!is_array($data) || empty($data['items']) || !is_array($data['items'])) {
            return null;
        }

        return $data;
    }
}
