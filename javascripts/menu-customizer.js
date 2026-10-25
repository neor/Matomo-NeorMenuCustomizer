/**
 * NeorMenuCustomizer - Visual Drag-and-Drop Reporting Menu Manager
 */
(function () {
    'use strict';

    function initCustomizer() {
        const rootEl = document.getElementById('neor-menu-customizer-app');
        if (!rootEl) {
            return;
        }

        if (typeof window.Vue === 'undefined' || !window.Vue.createApp) {
            console.error('[NeorMenuCustomizer] Vue 3 is not loaded.');
            return;
        }

        let nonce = rootEl.getAttribute('data-nonce') || '';
        const tokenAuth = rootEl.getAttribute('data-token-auth') ||
            (window.piwik && window.piwik.token_auth ? window.piwik.token_auth : '');
        let initialData = { items: [], hasCustomConfig: false };
        try {
            const raw = rootEl.getAttribute('data-structure') || '{}';
            initialData = JSON.parse(raw);
        } catch (e) {
            console.error('[NeorMenuCustomizer] Failed to parse initial menu structure:', e);
        }

        const { createApp, ref, computed, watch, onMounted, onBeforeUnmount } = window.Vue;

        const App = {
            setup() {
                // Translator wrapper with fallback
                function t(key, replacements) {
                    if (typeof window._pk_translate === 'function') {
                        const val = window._pk_translate(key, replacements);
                        if (val && val !== key) {
                            return val;
                        }
                    }
                    const fallbacks = {
                        'NeorMenuCustomizer_PageTitle': 'Menu Customizer',
                        'NeorMenuCustomizer_PageDescription': "Manage the visibility and order of reporting categories and subcategories in Matomo's left sidebar. Changes apply globally to all users.",
                        'NeorMenuCustomizer_Save': 'Save Changes',
                        'NeorMenuCustomizer_Saving': 'Saving...',
                        'NeorMenuCustomizer_SavedSuccess': 'Menu configuration saved successfully.',
                        'NeorMenuCustomizer_SaveError': 'An error occurred while saving menu configuration.',
                        'NeorMenuCustomizer_Reset': 'Reset to Defaults',
                        'NeorMenuCustomizer_ResetConfirm': 'Are you sure you want to reset the reporting menu order and visibility to defaults?',
                        'NeorMenuCustomizer_ResetSuccess': 'Menu configuration has been reset.',
                        'NeorMenuCustomizer_SearchPlaceholder': 'Search categories and reports...',
                        'NeorMenuCustomizer_AllVisible': 'All visible',
                        'NeorMenuCustomizer_HiddenCount': '%1$s hidden',
                        'NeorMenuCustomizer_DragCategoryHint': 'Drag categories to change their order in the left menu.',
                        'NeorMenuCustomizer_DragSubcategoryHint': 'Drag reports inside a category to reorder them.',
                        'NeorMenuCustomizer_VisibilityToggle': 'Toggle visibility',
                        'NeorMenuCustomizer_Visible': 'Visible',
                        'NeorMenuCustomizer_Hidden': 'Hidden',
                        'NeorMenuCustomizer_NoItemsFound': 'No menu items match your search.',
                        'NeorMenuCustomizer_ExpandAll': 'Expand All',
                        'NeorMenuCustomizer_CollapseAll': 'Collapse All',
                        'NeorMenuCustomizer_UnsavedChangesWarning': 'You have unsaved changes. Are you sure you want to leave this page?',
                        'General_Clear': 'Clear'
                    };
                    let str = fallbacks[key] || key;
                    if (Array.isArray(replacements)) {
                        replacements.forEach((val, idx) => {
                            str = str.replace('%' + (idx + 1) + '$s', val).replace('%s', val);
                        });
                    }
                    return str;
                }

                // Prepare categories state
                const categories = ref((initialData.items || []).map(cat => ({
                    id: cat.id,
                    name: cat.name,
                    icon: cat.icon || '',
                    hidden: !!cat.hidden,
                    expanded: false,
                    subcategories: (cat.subcategories || []).map(sub => ({
                        id: sub.id,
                        name: sub.name,
                        hidden: !!sub.hidden
                    }))
                })));

                const searchQuery = ref('');
                const hasUnsavedChanges = ref(false);
                const isSaving = ref(false);
                const isResetting = ref(false);
                const toast = ref(null); // { type: 'success'|'error', message: '' }
                let toastTimer = null;

                function showToast(type, message) {
                    if (toastTimer) {
                        clearTimeout(toastTimer);
                    }
                    toast.value = { type, message };
                    toastTimer = setTimeout(() => {
                        toast.value = null;
                    }, 4000);
                }

                // Drag state for categories
                const draggedCategoryIndex = ref(null);
                const dragOverCategoryIndex = ref(null);

                // Drag state for subcategories
                const draggedSubcategory = ref(null); // { catId, subIndex }
                const dragOverSubcategory = ref(null); // { catId, subIndex }

                // Category Drag Handlers
                function onCategoryDragStart(event, index) {
                    draggedCategoryIndex.value = index;
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', 'category:' + index);
                }

                function onCategoryDragOver(event, index) {
                    event.preventDefault();
                    if (draggedCategoryIndex.value === null || draggedCategoryIndex.value === index) {
                        return;
                    }
                    dragOverCategoryIndex.value = index;
                }

                function onCategoryDragLeave(event, index) {
                    if (dragOverCategoryIndex.value === index) {
                        dragOverCategoryIndex.value = null;
                    }
                }

                function onCategoryDrop(event, targetIndex) {
                    event.preventDefault();
                    const fromIndex = draggedCategoryIndex.value;
                    if (fromIndex !== null && fromIndex !== targetIndex) {
                        const item = categories.value.splice(fromIndex, 1)[0];
                        categories.value.splice(targetIndex, 0, item);
                        hasUnsavedChanges.value = true;
                    }
                    draggedCategoryIndex.value = null;
                    dragOverCategoryIndex.value = null;
                }

                function onCategoryDragEnd() {
                    draggedCategoryIndex.value = null;
                    dragOverCategoryIndex.value = null;
                }

                // Subcategory Drag Handlers
                function onSubcategoryDragStart(event, catId, subIndex) {
                    event.stopPropagation();
                    draggedSubcategory.value = { catId, subIndex };
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', 'sub:' + catId + ':' + subIndex);
                }

                function onSubcategoryDragOver(event, catId, subIndex) {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!draggedSubcategory.value || draggedSubcategory.value.catId !== catId) {
                        return;
                    }
                    if (draggedSubcategory.value.subIndex === subIndex) {
                        return;
                    }
                    dragOverSubcategory.value = { catId, subIndex };
                }

                function onSubcategoryDragLeave(event, catId, subIndex) {
                    if (dragOverSubcategory.value &&
                        dragOverSubcategory.value.catId === catId &&
                        dragOverSubcategory.value.subIndex === subIndex) {
                        dragOverSubcategory.value = null;
                    }
                }

                function onSubcategoryDrop(event, targetCatId, targetSubIndex) {
                    event.preventDefault();
                    event.stopPropagation();
                    const drag = draggedSubcategory.value;
                    if (drag && drag.catId === targetCatId && drag.subIndex !== targetSubIndex) {
                        const cat = categories.value.find(c => c.id === targetCatId);
                        if (cat && cat.subcategories) {
                            const item = cat.subcategories.splice(drag.subIndex, 1)[0];
                            cat.subcategories.splice(targetSubIndex, 0, item);
                            hasUnsavedChanges.value = true;
                        }
                    }
                    draggedSubcategory.value = null;
                    dragOverSubcategory.value = null;
                }

                function onSubcategoryDragEnd() {
                    draggedSubcategory.value = null;
                    dragOverSubcategory.value = null;
                }

                // Visibility toggles
                function toggleCategoryVisibility(cat) {
                    cat.hidden = !cat.hidden;
                    hasUnsavedChanges.value = true;
                }

                function toggleSubcategoryVisibility(cat, sub) {
                    sub.hidden = !sub.hidden;
                    hasUnsavedChanges.value = true;
                }

                function toggleExpand(cat) {
                    cat.expanded = !cat.expanded;
                }

                function expandAll() {
                    categories.value.forEach(c => c.expanded = true);
                }

                function collapseAll() {
                    categories.value.forEach(c => c.expanded = false);
                }

                // Stats helper
                function getCategoryHiddenCount(cat) {
                    if (!cat.subcategories) {
                        return 0;
                    }
                    return cat.subcategories.filter(s => s.hidden).length;
                }

                // Filtered list
                const filteredCategories = computed(() => {
                    const q = searchQuery.value.trim().toLowerCase();
                    if (!q) {
                        return categories.value;
                    }
                    return categories.value.filter(cat => {
                        const catMatch = (cat.name && cat.name.toLowerCase().includes(q)) ||
                                         (cat.id && cat.id.toLowerCase().includes(q));
                        const subMatch = (cat.subcategories || []).some(sub =>
                            (sub.name && sub.name.toLowerCase().includes(q)) ||
                            (sub.id && sub.id.toLowerCase().includes(q))
                        );
                        return catMatch || subMatch;
                    });
                });

                // Auto-expand when searching
                watch(searchQuery, (newVal) => {
                    if (newVal.trim()) {
                        categories.value.forEach(c => c.expanded = true);
                    }
                });

                // Save action
                async function saveChanges() {
                    if (isSaving.value) {
                        return;
                    }
                    isSaving.value = true;

                    const payloadItems = categories.value.map(cat => ({
                        id: cat.id,
                        hidden: !!cat.hidden,
                        subcategories: (cat.subcategories || []).map(sub => ({
                            id: sub.id,
                            hidden: !!sub.hidden
                        }))
                    }));

                    try {
                        const formData = new URLSearchParams();
                        formData.append('force_api_session', '1');
                        if (tokenAuth) {
                            formData.append('token_auth', tokenAuth);
                        }
                        if (nonce) {
                            formData.append('nonce', nonce);
                        }
                        formData.append('items', JSON.stringify(payloadItems));

                        const resp = await fetch('index.php?module=NeorMenuCustomizer&action=save', {
                            method: 'POST',
                            credentials: 'same-origin',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                                'X-Requested-With': 'XMLHttpRequest'
                            },
                            body: formData.toString()
                        });

                        let res;
                        try {
                            res = await resp.json();
                        } catch (jsonErr) {
                            throw new Error(resp.statusText || 'Server error');
                        }

                        if (res && res.nonce) {
                            nonce = res.nonce;
                        }

                        if (res && res.success) {
                            hasUnsavedChanges.value = false;
                            showToast('success', t('NeorMenuCustomizer_SavedSuccess'));
                        } else {
                            throw new Error((res && res.message) || 'Save failed');
                        }
                    } catch (err) {
                        console.error('[NeorMenuCustomizer] Save error:', err);
                        showToast('error', (err && err.message) || t('NeorMenuCustomizer_SaveError'));
                    } finally {
                        isSaving.value = false;
                    }
                }

                // Reset action
                async function resetDefaults() {
                    if (!window.confirm(t('NeorMenuCustomizer_ResetConfirm'))) {
                        return;
                    }
                    isResetting.value = true;

                    try {
                        const formData = new URLSearchParams();
                        formData.append('force_api_session', '1');
                        if (tokenAuth) {
                            formData.append('token_auth', tokenAuth);
                        }
                        if (nonce) {
                            formData.append('nonce', nonce);
                        }

                        const resp = await fetch('index.php?module=NeorMenuCustomizer&action=reset', {
                            method: 'POST',
                            credentials: 'same-origin',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                                'X-Requested-With': 'XMLHttpRequest'
                            },
                            body: formData.toString()
                        });

                        let res;
                        try {
                            res = await resp.json();
                        } catch (jsonErr) {
                            throw new Error(resp.statusText || 'Server error');
                        }

                        if (res && res.nonce) {
                            nonce = res.nonce;
                        }

                        if (res && res.success) {
                            hasUnsavedChanges.value = false;
                            showToast('success', t('NeorMenuCustomizer_ResetSuccess'));
                            setTimeout(() => {
                                window.location.reload();
                            }, 800);
                        } else {
                            throw new Error((res && res.message) || 'Reset failed');
                        }
                    } catch (err) {
                        console.error('[NeorMenuCustomizer] Reset error:', err);
                        showToast('error', (err && err.message) || t('NeorMenuCustomizer_SaveError'));
                    } finally {
                        isResetting.value = false;
                    }
                }

                // Warn on navigation if changes exist
                function handleBeforeUnload(e) {
                    if (hasUnsavedChanges.value) {
                        e.preventDefault();
                        e.returnValue = t('NeorMenuCustomizer_UnsavedChangesWarning');
                        return e.returnValue;
                    }
                }

                onMounted(() => {
                    window.addEventListener('beforeunload', handleBeforeUnload);
                });

                onBeforeUnmount(() => {
                    window.removeEventListener('beforeunload', handleBeforeUnload);
                });

                return {
                    t,
                    categories,
                    searchQuery,
                    hasUnsavedChanges,
                    isSaving,
                    isResetting,
                    toast,
                    draggedCategoryIndex,
                    dragOverCategoryIndex,
                    draggedSubcategory,
                    dragOverSubcategory,
                    filteredCategories,
                    onCategoryDragStart,
                    onCategoryDragOver,
                    onCategoryDragLeave,
                    onCategoryDrop,
                    onCategoryDragEnd,
                    onSubcategoryDragStart,
                    onSubcategoryDragOver,
                    onSubcategoryDragLeave,
                    onSubcategoryDrop,
                    onSubcategoryDragEnd,
                    toggleCategoryVisibility,
                    toggleSubcategoryVisibility,
                    toggleExpand,
                    expandAll,
                    collapseAll,
                    getCategoryHiddenCount,
                    saveChanges,
                    resetDefaults
                };
            },
            template: `
                <div class="neor-mc-wrapper">
                    <!-- Toast Notification -->
                    <div v-if="toast" class="neor-mc-toast" :class="'toast-' + toast.type">
                        <span :class="toast.type === 'success' ? 'icon-ok' : 'icon-error'"></span>
                        <span>{{ toast.message }}</span>
                    </div>

                    <!-- Header -->
                    <div class="neor-mc-header">
                        <div class="neor-mc-header-info">
                            <h2 class="neor-mc-title">{{ t('NeorMenuCustomizer_PageTitle') }}</h2>
                            <p class="neor-mc-desc">{{ t('NeorMenuCustomizer_PageDescription') }}</p>
                        </div>
                        <div class="neor-mc-header-actions">
                            <button type="button"
                                    class="neor-mc-btn neor-mc-btn-reset"
                                    :disabled="isSaving || isResetting"
                                    @click="resetDefaults">
                                <span class="neor-mc-btn-icon icon-reload"></span>
                                <span class="neor-mc-btn-text">{{ t('NeorMenuCustomizer_Reset') }}</span>
                            </button>
                            <button type="button"
                                    class="neor-mc-btn neor-mc-btn-save"
                                    :class="{ 'has-changes': hasUnsavedChanges }"
                                    :disabled="isSaving || !hasUnsavedChanges"
                                    @click="saveChanges">
                                <span v-if="isSaving" class="neor-mc-btn-icon icon-loading-piwik"></span>
                                <span v-else class="neor-mc-btn-icon icon-save"></span>
                                <span class="neor-mc-btn-text">{{ isSaving ? t('NeorMenuCustomizer_Saving') : t('NeorMenuCustomizer_Save') }}</span>
                            </button>
                        </div>
                    </div>

                    <!-- Toolbar -->
                    <div class="neor-mc-toolbar">
                        <div class="neor-mc-search-box">
                            <span class="icon-search neor-mc-search-icon" aria-hidden="true"></span>
                            <input type="text"
                                   v-model="searchQuery"
                                   class="browser-default neor-mc-search-input"
                                   :placeholder="t('NeorMenuCustomizer_SearchPlaceholder')"
                                   autocomplete="off"
                                   spellcheck="false" />
                            <span v-if="searchQuery"
                                  class="icon-close neor-mc-search-clear"
                                  @click="searchQuery = ''"
                                  role="button"
                                  tabindex="0"
                                  :title="t('General_Clear')"
                                  aria-label="Clear search"
                                  @keydown.enter="searchQuery = ''"></span>
                        </div>
                        <div class="neor-mc-toolbar-buttons">
                            <button type="button" class="neor-mc-link-btn" @click="expandAll">
                                {{ t('NeorMenuCustomizer_ExpandAll') }}
                            </button>
                            <span class="neor-mc-divider">|</span>
                            <button type="button" class="neor-mc-link-btn" @click="collapseAll">
                                {{ t('NeorMenuCustomizer_CollapseAll') }}
                            </button>
                        </div>
                    </div>

                    <!-- Categories Drag and Drop List -->
                    <div class="neor-mc-list" :class="{ 'is-dragging': draggedCategoryIndex !== null }">
                        <div v-if="filteredCategories.length === 0" class="neor-mc-empty">
                            <span class="icon-warning"></span>
                            <span>{{ t('NeorMenuCustomizer_NoItemsFound') }}</span>
                        </div>

                        <div v-for="(cat, cIdx) in filteredCategories"
                             :key="cat.id"
                             class="neor-mc-card"
                             :class="{
                                 'is-hidden': cat.hidden,
                                 'is-dragging-cat': draggedCategoryIndex === cIdx,
                                 'drag-over-top': dragOverCategoryIndex === cIdx && draggedCategoryIndex !== null && draggedCategoryIndex > cIdx,
                                 'drag-over-bottom': dragOverCategoryIndex === cIdx && draggedCategoryIndex !== null && draggedCategoryIndex < cIdx
                             }"
                             draggable="true"
                             @dragstart="onCategoryDragStart($event, cIdx)"
                             @dragover="onCategoryDragOver($event, cIdx)"
                             @dragleave="onCategoryDragLeave($event, cIdx)"
                             @drop="onCategoryDrop($event, cIdx)"
                             @dragend="onCategoryDragEnd">

                            <!-- Category Header -->
                            <div class="neor-mc-card-header">
                                <div class="neor-mc-handle" :title="t('NeorMenuCustomizer_DragCategoryHint')">
                                    <span class="neor-mc-grip">⋮⋮</span>
                                </div>

                                <div class="neor-mc-cat-icon">
                                    <span v-if="cat.icon" :class="cat.icon"></span>
                                    <span v-else class="icon-folder"></span>
                                </div>

                                <div class="neor-mc-cat-info" @click="toggleExpand(cat)">
                                    <span class="neor-mc-cat-name">{{ cat.name }}</span>
                                    <span class="neor-mc-id-tag">{{ cat.id }}</span>
                                </div>

                                <div class="neor-mc-cat-badges">
                                    <span v-if="getCategoryHiddenCount(cat) > 0" class="badge badge-warning">
                                        {{ t('NeorMenuCustomizer_HiddenCount', [getCategoryHiddenCount(cat)]) }}
                                    </span>
                                    <span v-else class="badge badge-success">
                                        {{ t('NeorMenuCustomizer_AllVisible') }}
                                    </span>
                                </div>

                                <div class="neor-mc-actions">
                                    <button type="button"
                                            class="neor-mc-toggle-btn"
                                            :class="{ 'is-active': !cat.hidden }"
                                            :title="t('NeorMenuCustomizer_VisibilityToggle')"
                                            @click.stop="toggleCategoryVisibility(cat)">
                                        <span :class="cat.hidden ? 'icon-hide' : 'icon-show'"></span>
                                        <span class="toggle-text">{{ cat.hidden ? t('NeorMenuCustomizer_Hidden') : t('NeorMenuCustomizer_Visible') }}</span>
                                    </button>

                                    <button type="button"
                                            class="neor-mc-chevron-btn"
                                            :class="{ 'is-collapsed': !cat.expanded }"
                                            @click.stop="toggleExpand(cat)">
                                        <span class="icon-chevron-down"></span>
                                    </button>
                                </div>
                            </div>

                            <!-- Subcategories List -->
                            <div v-show="cat.expanded"
                                 class="neor-mc-sub-list"
                                 :class="{ 'is-cat-hidden': cat.hidden }">
                                <div v-for="(sub, sIdx) in cat.subcategories"
                                     :key="sub.id"
                                     class="neor-mc-sub-row"
                                     :class="{
                                         'is-hidden': sub.hidden || cat.hidden,
                                         'is-dragging-sub': draggedSubcategory && draggedSubcategory.catId === cat.id && draggedSubcategory.subIndex === sIdx,
                                         'sub-drag-over-top': dragOverSubcategory && dragOverSubcategory.catId === cat.id && dragOverSubcategory.subIndex === sIdx && draggedSubcategory && draggedSubcategory.subIndex > sIdx,
                                         'sub-drag-over-bottom': dragOverSubcategory && dragOverSubcategory.catId === cat.id && dragOverSubcategory.subIndex === sIdx && draggedSubcategory && draggedSubcategory.subIndex < sIdx
                                     }"
                                     draggable="true"
                                     @dragstart="onSubcategoryDragStart($event, cat.id, sIdx)"
                                     @dragover="onSubcategoryDragOver($event, cat.id, sIdx)"
                                     @dragleave="onSubcategoryDragLeave($event, cat.id, sIdx)"
                                     @drop="onSubcategoryDrop($event, cat.id, sIdx)"
                                     @dragend="onSubcategoryDragEnd">

                                    <div class="neor-mc-sub-handle" :title="t('NeorMenuCustomizer_DragSubcategoryHint')">
                                        <span class="neor-mc-grip">⋮⋮</span>
                                    </div>

                                    <div class="neor-mc-sub-info">
                                        <span class="neor-mc-sub-name">{{ sub.name }}</span>
                                        <span class="neor-mc-id-tag">{{ sub.id }}</span>
                                    </div>

                                    <div class="neor-mc-sub-actions">
                                        <button type="button"
                                                class="neor-mc-toggle-btn btn-sm"
                                                :class="{ 'is-active': !sub.hidden && !cat.hidden }"
                                                :disabled="cat.hidden"
                                                :title="t('NeorMenuCustomizer_VisibilityToggle')"
                                                @click.stop="toggleSubcategoryVisibility(cat, sub)">
                                            <span :class="(sub.hidden || cat.hidden) ? 'icon-hide' : 'icon-show'"></span>
                                            <span class="toggle-text">{{ (sub.hidden || cat.hidden) ? t('NeorMenuCustomizer_Hidden') : t('NeorMenuCustomizer_Visible') }}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `
        };

        createApp(App).mount('#neor-menu-customizer-app');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCustomizer);
    } else {
        initCustomizer();
    }
})();
