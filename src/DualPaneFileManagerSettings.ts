import { App, PluginSettingTab, Setting } from 'obsidian';
import DualPaneFileManagerPlugin from './main';

export interface DualPaneFileManagerSettings {
    layout: 'vertical' | 'horizontal';
    nameDisplay: 'truncate' | 'wrap';
}

export const DEFAULT_SETTINGS: DualPaneFileManagerSettings = {
    layout: 'horizontal',
    nameDisplay: 'truncate'
};

export class DualPaneFileManagerSettingTab extends PluginSettingTab {
    plugin: DualPaneFileManagerPlugin;

    constructor(app: App, plugin: DualPaneFileManagerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Layout')
            .setDesc('Pilih layout untuk file manager')
            .addDropdown(dropdown => dropdown
                .addOption('vertical', 'Vertikal (File di Kanan)')
                .addOption('horizontal', 'Horizontal (File di Bawah)')
                .setValue(this.plugin.settings.layout)
                .onChange(async (value: 'vertical' | 'horizontal') => {
                    this.plugin.settings.layout = value;
                    await this.plugin.saveSettings();
                    this.plugin.view?.updateLayout(value);
                }));

        new Setting(containerEl)
            .setName('Tampilan Nama')
            .setDesc('Pilih cara menampilkan nama file/folder yang panjang')
            .addDropdown(dropdown => dropdown
                .addOption('truncate', 'Potong dengan ...')
                .addOption('wrap', 'Pindah Baris')
                .setValue(this.plugin.settings.nameDisplay)
                .onChange(async (value: 'truncate' | 'wrap') => {
                    this.plugin.settings.nameDisplay = value;
                    await this.plugin.saveSettings();
                    this.plugin.view?.updateNameDisplay();
                }));
    }
} 