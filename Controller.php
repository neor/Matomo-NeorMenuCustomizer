<?php

/**
 * Matomo - free/libre analytics platform
 *
 * @link    https://matomo.org
 * @license https://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

namespace Piwik\Plugins\NeorMenuCustomizer;

use Exception;
use Piwik\Common;
use Piwik\Nonce;
use Piwik\Piwik;
use Piwik\Plugin\ControllerAdmin;

class Controller extends ControllerAdmin
{
    public const NONCE_KEY = 'NeorMenuCustomizer.save';

    public function index()
    {
        Piwik::checkUserHasSuperUserAccess();

        $api = API::getInstance();
        $menuStructure = $api->getMenuStructure();

        return $this->renderTemplate('index', [
            'nonce'         => Nonce::getNonce(self::NONCE_KEY),
            'token_auth'    => Piwik::getCurrentUserTokenAuth(),
            'menuStructure' => $menuStructure,
        ]);
    }

    private function checkSecurity(): void
    {
        Piwik::checkUserHasSuperUserAccess();

        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
            throw new Exception(Piwik::translate('General_ExceptionSecurityCheckFailed'));
        }

        // 1. Try standard Matomo AJAX token_auth validation
        try {
            $this->checkTokenInUrl();
            return;
        } catch (\Exception $e) {
            // If token_auth check fails or was not passed, fall back to checking nonce
        }

        // 2. Try Nonce validation
        $nonce = $_POST['nonce'] ?? '';
        if (is_string($nonce) && strlen($nonce) === 32) {
            if (Nonce::verifyNonce(self::NONCE_KEY, $nonce)) {
                return;
            }
        }

        throw new Exception(Piwik::translate('General_ExceptionSecurityCheckFailed'));
    }

    public function save()
    {
        try {
            $this->checkSecurity();

            $rawItems = $_POST['items'] ?? '[]';
            $items = is_string($rawItems) ? json_decode($rawItems, true) : (array) $rawItems;
            if (!is_array($items)) {
                $items = [];
            }

            $api = API::getInstance();
            $api->saveMenuConfig($items);

            Common::sendHeader('Content-Type: application/json; charset=utf-8');
            return json_encode([
                'success' => true,
                'nonce'   => Nonce::getNonce(self::NONCE_KEY),
            ]);
        } catch (Exception $e) {
            Common::sendHeader('Content-Type: application/json; charset=utf-8');
            http_response_code(400);
            return json_encode([
                'success' => false,
                'message' => $e->getMessage(),
                'nonce'   => Nonce::getNonce(self::NONCE_KEY),
            ]);
        }
    }

    public function reset()
    {
        try {
            $this->checkSecurity();

            $api = API::getInstance();
            $api->resetMenuConfig();

            Common::sendHeader('Content-Type: application/json; charset=utf-8');
            return json_encode([
                'success' => true,
                'nonce'   => Nonce::getNonce(self::NONCE_KEY),
            ]);
        } catch (Exception $e) {
            Common::sendHeader('Content-Type: application/json; charset=utf-8');
            http_response_code(400);
            return json_encode([
                'success' => false,
                'message' => $e->getMessage(),
                'nonce'   => Nonce::getNonce(self::NONCE_KEY),
            ]);
        }
    }
}
