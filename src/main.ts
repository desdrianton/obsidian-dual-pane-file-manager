import { App, Plugin, WorkspaceLeaf } from 'obsidian';
import { DualPaneFileManagerView } from './DualPaneFileManagerView';
import { 
    DualPaneFileManagerSettings, 
    DEFAULT_SETTINGS,
    DualPaneFileManagerSettingTab 
} from './DualPaneFileManagerSettings';

export default class DualPaneFileManagerPlugin extends Plugin {
    settings: DualPaneFileManagerSettings;
    view: DualPaneFileManagerView | null = null;

    async onload() {
        await this.loadSettings();

        // Mendaftarkan view type baru
        this.registerView(
            'dual-pane-file-manager',
            (leaf) => {
                this.view = new DualPaneFileManagerView(leaf, this.settings);
                return this.view;
            }
        );

        // Menambahkan ribbon icon
        this.addRibbonIcon('folder', 'Buka File Manager Dua Pane', () => {
            this.activateView();
        });

        // Menambahkan settings tab
        this.addSettingTab(new DualPaneFileManagerSettingTab(this.app, this));
    }

    async onunload() {
        // Membersihkan resources saat plugin di-unload
        this.app.workspace.detachLeavesOfType('dual-pane-file-manager');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    refreshLayout() {
        if (this.view) {
            this.view.updateLayout(this.settings.layout);
        }
    }

    async activateView() {
        const { workspace } = this.app;
        
        let leaf = workspace.getLeavesOfType('dual-pane-file-manager')[0];
        if (!leaf) {
            leaf = workspace.getRightLeaf(false);
            await leaf.setViewState({
                type: 'dual-pane-file-manager',
                active: true,
            });
        }
        workspace.revealLeaf(leaf);
    }
} 