import { ItemView, WorkspaceLeaf, TFolder, TFile, Menu, Notice, Modal, App, setIcon } from 'obsidian';
import { DualPaneFileManagerSettings } from './DualPaneFileManagerSettings';

export class DualPaneFileManagerView extends ItemView {
    private folderPane: HTMLElement;
    private filePane: HTMLElement;
    private resizer: HTMLElement;
    private expandedFolders: Set<string>;
    private isResizing: boolean = false;
    private settings: DualPaneFileManagerSettings;

    constructor(leaf: WorkspaceLeaf, settings: DualPaneFileManagerSettings) {
        super(leaf);
        this.expandedFolders = new Set<string>();
        this.settings = settings;
    }

    getViewType(): string {
        return 'dual-pane-file-manager';
    }

    getDisplayText(): string {
        return 'File Manager Dua Pane';
    }

    async onOpen() {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        this.setupLayout(container);
        
        // Register event listeners untuk perubahan di vault
        this.registerVaultEvents();
    }

    async onClose() {
        // Unregister event listeners saat view ditutup
        this.unregisterVaultEvents();
    }

    private registerVaultEvents() {
        // Event untuk rename file/folder
        this.registerEvent(
            this.app.vault.on('rename', (file, oldPath) => {
                const currentFolder = this.getCurrentFolder();
                if (!currentFolder) return;

                // Refresh folder list jika yang direname adalah folder
                if (file instanceof TFolder) {
                    this.refreshFolderList();
                }
                
                // Refresh file pane jika file direname di folder yang aktif
                if (currentFolder.path === '/') {
                    // Jika root folder aktif, refresh jika file ada di root
                    if (!file.parent || file.parent.path === '/') {
                        this.displayFolderContents(currentFolder);
                    }
                } else if (file.parent?.path === currentFolder.path) {
                    // Untuk folder lain, refresh jika file ada di folder tersebut
                    this.displayFolderContents(currentFolder);
                }
            })
        );

        // Event untuk create file/folder
        this.registerEvent(
            this.app.vault.on('create', (file) => {
                const currentFolder = this.getCurrentFolder();
                if (!currentFolder) return;

                // Refresh folder list jika yang dibuat adalah folder
                if (file instanceof TFolder) {
                    this.refreshFolderList();
                }
                
                // Refresh file pane jika file dibuat di folder yang aktif
                if (currentFolder.path === '/') {
                    // Jika root folder aktif, refresh jika file dibuat di root
                    if (!file.parent || file.parent.path === '/') {
                        this.displayFolderContents(currentFolder);
                    }
                } else if (file.parent?.path === currentFolder.path) {
                    // Untuk folder lain, refresh jika file dibuat di folder tersebut
                    this.displayFolderContents(currentFolder);
                }
            })
        );

        // Event untuk delete file/folder
        this.registerEvent(
            this.app.vault.on('delete', (file) => {
                const currentFolder = this.getCurrentFolder();
                if (!currentFolder) return;

                // Refresh folder list jika yang dihapus adalah folder
                if (file instanceof TFolder) {
                    this.refreshFolderList();
                }
                
                // Refresh file pane jika file dihapus dari folder yang aktif
                if (currentFolder.path === '/') {
                    // Jika root folder aktif, refresh jika file dihapus dari root
                    if (!file.parent || file.parent.path === '/') {
                        this.displayFolderContents(currentFolder);
                    }
                } else if (file.parent?.path === currentFolder.path) {
                    // Untuk folder lain, refresh jika file dihapus dari folder tersebut
                    this.displayFolderContents(currentFolder);
                }
            })
        );

        // Event untuk modify file
        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (!(file instanceof TFile)) return;
                
                const currentFolder = this.getCurrentFolder();
                if (!currentFolder) return;

                // Refresh file pane jika file dimodifikasi di folder yang aktif
                if (currentFolder.path === '/') {
                    // Jika root folder aktif, refresh jika file dimodifikasi di root
                    if (!file.parent || file.parent.path === '/') {
                        this.displayFolderContents(currentFolder);
                    }
                } else if (file.parent?.path === currentFolder.path) {
                    // Untuk folder lain, refresh jika file dimodifikasi di folder tersebut
                    this.displayFolderContents(currentFolder);
                }
            })
        );
    }

    private unregisterVaultEvents() {
        // Event handlers akan dibersihkan secara otomatis oleh Obsidian
        // karena kita menggunakan this.registerEvent
    }

    private setupLayout(container: HTMLElement) {
        container.empty();
        const isVertical = this.settings.layout === 'vertical';
        
        // Tambahkan class sesuai mode tampilan nama
        container.toggleClass('wrap-names', this.settings.nameDisplay === 'wrap');
        container.toggleClass('truncate-names', this.settings.nameDisplay === 'truncate');
        
        container.style.display = 'flex';
        container.style.flexDirection = isVertical ? 'row' : 'column';

        // Membuat pane folder
        this.folderPane = container.createDiv('folder-pane');
        if (isVertical) {
            this.folderPane.style.width = '50%';
            this.folderPane.style.minWidth = '100px';
            this.folderPane.style.maxWidth = '80%';
            this.folderPane.style.height = '100%';
        } else {
            this.folderPane.style.width = '100%';
            this.folderPane.style.height = '50%';
            this.folderPane.style.minHeight = '100px';
            this.folderPane.style.maxHeight = '80%';
        }

        // Membuat resizer
        this.resizer = container.createDiv('pane-resizer');
        if (!isVertical) {
            this.resizer.addClass('horizontal');
        }
        
        // Membuat pane file
        this.filePane = container.createDiv('file-pane');
        if (isVertical) {
            this.filePane.style.flex = '1';
            this.filePane.style.minWidth = '100px';
            this.filePane.style.height = '100%';
        } else {
            this.filePane.style.width = '100%';
            this.filePane.style.flex = '1';
            this.filePane.style.minHeight = '100px';
        }

        this.setupResizer();
        this.refreshFolderList();
    }

    updateLayout(layout: 'vertical' | 'horizontal') {
        this.settings.layout = layout;
        this.setupLayout(this.containerEl.children[1] as HTMLElement);
    }

    updateNameDisplay() {
        const container = this.containerEl.children[1] as HTMLElement;
        container.toggleClass('wrap-names', this.settings.nameDisplay === 'wrap');
        container.toggleClass('truncate-names', this.settings.nameDisplay === 'truncate');
    }

    private setupResizer() {
        const isVertical = this.settings.layout === 'vertical';

        const startResize = (e: MouseEvent) => {
            this.isResizing = true;
            document.addEventListener('mousemove', resize);
            document.addEventListener('mouseup', stopResize);
        };

        const resize = (e: MouseEvent) => {
            if (!this.isResizing) return;

            const containerRect = this.containerEl.getBoundingClientRect();
            
            if (isVertical) {
                const newWidth = e.clientX - containerRect.left;
                const minWidth = 100;
                const maxWidth = containerRect.width * 0.8;
                
                if (newWidth >= minWidth && newWidth <= maxWidth) {
                    this.folderPane.style.width = newWidth + 'px';
                }
            } else {
                const newHeight = e.clientY - containerRect.top;
                const minHeight = 100;
                const maxHeight = containerRect.height * 0.8;
                
                if (newHeight >= minHeight && newHeight <= maxHeight) {
                    this.folderPane.style.height = newHeight + 'px';
                }
            }
        };

        const stopResize = () => {
            this.isResizing = false;
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);
        };

        this.resizer.addEventListener('mousedown', startResize);
    }

    private refreshFolderList() {
        this.folderPane.empty();
        const rootFolder = this.app.vault.getRoot();
        
        // Buat root node dengan nama vault
        const rootEl = this.folderPane.createDiv('folder-item root-folder');
        const rootHeader = rootEl.createDiv('folder-header');
        
        // Tambahkan toggle icon untuk root
        const toggleIcon = rootHeader.createDiv('folder-toggle');
        const isExpanded = this.expandedFolders.has('/');
        toggleIcon.addClass(isExpanded ? 'expanded' : 'collapsed');
        
        const folderContent = rootHeader.createDiv('folder-content');
        const nameSpan = folderContent.createSpan();
        nameSpan.setText(this.app.vault.getName());
        
        // Container untuk subfolder root
        const rootSubFoldersContainer = rootEl.createDiv('subfolder-container');
        if (!isExpanded) {
            rootSubFoldersContainer.style.display = 'none';
        }
        
        // Event listener untuk klik kiri (expand/collapse)
        rootHeader.addEventListener('click', (e: MouseEvent) => {
            e.stopPropagation();
            
            // Hapus highlight dari semua folder
            this.folderPane.querySelectorAll('.folder-header').forEach(el => {
                el.removeClass('selected');
            });
            
            // Tambahkan highlight ke root folder
            rootHeader.addClass('selected');
            
            const isNowExpanded = !this.expandedFolders.has('/');
            if (isNowExpanded) {
                this.expandedFolders.add('/');
                toggleIcon.removeClass('collapsed');
                toggleIcon.addClass('expanded');
                rootSubFoldersContainer.style.display = 'block';
            } else {
                this.expandedFolders.delete('/');
                toggleIcon.removeClass('expanded');
                toggleIcon.addClass('collapsed');
                rootSubFoldersContainer.style.display = 'none';
            }
            
            this.displayFolderContents(rootFolder);
        });

        // Event listener untuk klik kanan pada root
        rootHeader.addEventListener('contextmenu', (e: MouseEvent) => {
            e.preventDefault();
            const menu = new Menu();

            // Opsi untuk membuat folder baru di root
            menu.addItem((item) => {
                item
                    .setTitle("Folder Baru")
                    .setIcon("folder-plus")
                    .onClick(async () => {
                        const name = await this.promptForName("Masukkan nama folder baru:");
                        if (name) {
                            try {
                                await this.app.vault.createFolder(name);
                                this.refreshFolderList();
                                new Notice(`Folder "${name}" berhasil dibuat`);
                            } catch (error) {
                                new Notice(`Gagal membuat folder: ${error.message}`);
                            }
                        }
                    });
            });

            menu.showAtMouseEvent(e);
        });

        // Tampilkan folder-folder di root
        rootFolder.children.forEach((child: TFolder | TFile) => {
            if (child instanceof TFolder) {
                this.displayFolder(child, rootSubFoldersContainer, 1);
            }
        });

        // Expand root node secara default
        if (!this.expandedFolders.has('/')) {
            rootHeader.click();
        }
    }

    private displayFolder(folder: TFolder, container: HTMLElement, level: number) {
        const folderEl = container.createDiv('folder-item');
        folderEl.style.paddingLeft = `${level *4}px`;
        // Tambahkan data-path untuk tracking folder yang aktif
        folderEl.setAttribute('data-path', folder.path);
        
        const folderHeader = folderEl.createDiv('folder-header');
        
        // Tambahkan toggle icon
        const toggleIcon = folderHeader.createDiv('folder-toggle');
        const isExpanded = this.expandedFolders.has(folder.path);
        toggleIcon.addClass(isExpanded ? 'expanded' : 'collapsed');
        
        const folderContent = folderHeader.createDiv('folder-content');
        const nameSpan = folderContent.createSpan();
        nameSpan.setText(folder.name);
        
        // Container untuk subfolder
        const subFoldersContainer = folderEl.createDiv('subfolder-container');
        if (!isExpanded) {
            subFoldersContainer.style.display = 'none';
        }
        
        // Event listener untuk klik kiri (expand/collapse)
        folderHeader.addEventListener('click', (e: MouseEvent) => {
            e.stopPropagation();
            
            // Hapus highlight dari semua folder
            this.folderPane.querySelectorAll('.folder-header').forEach(el => {
                el.removeClass('selected');
            });
            
            // Tambahkan highlight ke folder yang dipilih
            folderHeader.addClass('selected');
            
            const isNowExpanded = !this.expandedFolders.has(folder.path);
            if (isNowExpanded) {
                this.expandedFolders.add(folder.path);
                toggleIcon.removeClass('collapsed');
                toggleIcon.addClass('expanded');
                subFoldersContainer.style.display = 'block';
            } else {
                this.expandedFolders.delete(folder.path);
                toggleIcon.removeClass('expanded');
                toggleIcon.addClass('collapsed');
                subFoldersContainer.style.display = 'none';
            }
            
            this.displayFolderContents(folder);
        });

        // Event listener untuk klik kanan (context menu)
        folderHeader.addEventListener('contextmenu', (e: MouseEvent) => {
            this.showFolderContextMenu(e, folder);
        });

        // Menampilkan subfolder secara rekursif
        folder.children.forEach((child: TFolder | TFile) => {
            if (child instanceof TFolder) {
                this.displayFolder(child, subFoldersContainer, level + 1);
            }
        });
    }

    private displayFolderContents(folder: TFolder) {
        this.filePane.empty();
        
        // Tambahkan header untuk menampilkan nama folder saat ini
        const header = this.filePane.createDiv('file-pane-header');
        const headerSpan = header.createSpan();
        headerSpan.setText(folder.path === '/' ? 'Root' : folder.name);
        
        // Tambahkan tombol untuk membuat file baru
        const newFileButton = header.createEl('button', {
            cls: 'clickable-icon new-file-button',
            attr: { 'aria-label': 'Note Baru' }
        });
        setIcon(newFileButton, 'file-plus');
        
        newFileButton.addEventListener('click', async () => {
            try {
                // Buat nama file otomatis dengan format: YYYYMMDD-HHmmss
                const now = new Date();
                const fileName = [
                    now.getFullYear(),
                    String(now.getMonth() + 1).padStart(2, '0'),
                    String(now.getDate()).padStart(2, '0'),
                    '-',
                    String(now.getHours()).padStart(2, '0'),
                    String(now.getMinutes()).padStart(2, '0'),
                    String(now.getSeconds()).padStart(2, '0'),
                    '.md'
                ].join('');
                
                const filePath = folder.path === '/' ? fileName : `${folder.path}/${fileName}`;
                
                // Buat note baru tanpa template
                const newFile = await this.app.vault.create(filePath, '');
                
                // Buka note baru di editor
                const leaf = this.app.workspace.getLeaf(true);
                await leaf.openFile(newFile);
                this.app.workspace.setActiveLeaf(leaf, true);
                
                this.displayFolderContents(folder);
                new Notice(`Note baru dibuat`);
            } catch (error) {
                new Notice(`Gagal membuat note: ${error.message}`);
            }
        });
        
        // Container untuk file-file
        const fileContainer = this.filePane.createDiv('file-container');
        
        folder.children.forEach((child: TFolder | TFile) => {
            if (child instanceof TFile) {
                const fileEl = fileContainer.createDiv('file-item');
                const nameSpan = fileEl.createSpan();
                nameSpan.setText(child.name);
                
                // Event listener untuk klik kiri (buka file)
                fileEl.addEventListener('click', async () => {
                    const leaf = this.app.workspace.getMostRecentLeaf();
                    if (leaf && !leaf.getViewState().pinned) {
                        await leaf.openFile(child);
                    } else {
                        const newLeaf = this.app.workspace.getLeaf(true);
                        await newLeaf.openFile(child);
                        this.app.workspace.setActiveLeaf(newLeaf, true);
                    }
                });
                
                // Event listener untuk klik kanan (context menu)
                fileEl.addEventListener('contextmenu', (e: MouseEvent) => {
                    e.preventDefault();
                    const menu = new Menu();
                    
                    // Opsi untuk rename file
                    menu.addItem((item) => {
                        item
                            .setTitle("Rename File")
                            .setIcon("pencil")
                            .onClick(async () => {
                                const newName = await this.promptForName(
                                    "Masukkan nama baru:",
                                    child.name
                                );
                                if (newName && newName !== child.name) {
                                    try {
                                        const newPath = folder.path === '/' 
                                            ? newName 
                                            : `${folder.path}/${newName}`;
                                        await this.app.vault.rename(child, newPath);
                                        this.displayFolderContents(folder);
                                        new Notice(`File berhasil direname ke "${newName}"`);
                                    } catch (error) {
                                        new Notice(`Gagal merename file: ${error.message}`);
                                    }
                                }
                            });
                    });
                    
                    // Opsi untuk menghapus file
                    menu.addItem((item) => {
                        item
                            .setTitle("Hapus File")
                            .setIcon("trash")
                            .onClick(async () => {
                                const confirmed = await this.confirmDialog(
                                    `Apakah Anda yakin ingin menghapus file "${child.name}"?`
                                );
                                if (confirmed) {
                                    try {
                                        await this.app.vault.delete(child);
                                        this.displayFolderContents(folder);
                                        new Notice(`File "${child.name}" berhasil dihapus`);
                                    } catch (error) {
                                        new Notice(`Gagal menghapus file: ${error.message}`);
                                    }
                                }
                            });
                    });
                    
                    menu.showAtMouseEvent(e);
                });
            }
        });
    }

    private async showFolderContextMenu(e: MouseEvent, folder: TFolder) {
        e.preventDefault();
        const menu = new Menu();

        // Opsi untuk membuat note baru
        menu.addItem((item) => {
            item
                .setTitle("Note Baru")
                .setIcon("file-plus")
                .onClick(async () => {
                    try {
                        // Buat nama file otomatis dengan format: YYYYMMDD-HHmmss
                        const now = new Date();
                        const fileName = [
                            now.getFullYear(),
                            String(now.getMonth() + 1).padStart(2, '0'),
                            String(now.getDate()).padStart(2, '0'),
                            '-',
                            String(now.getHours()).padStart(2, '0'),
                            String(now.getMinutes()).padStart(2, '0'),
                            String(now.getSeconds()).padStart(2, '0'),
                            '.md'
                        ].join('');
                        
                        const filePath = folder.path === '/' ? fileName : `${folder.path}/${fileName}`;
                        
                        // Buat note baru tanpa template
                        const newFile = await this.app.vault.create(filePath, '');
                        
                        // Buka note baru di editor
                        const leaf = this.app.workspace.getLeaf(true);
                        await leaf.openFile(newFile);
                        this.app.workspace.setActiveLeaf(leaf, true);
                        
                        this.displayFolderContents(folder);
                        new Notice(`Note baru dibuat`);
                    } catch (error) {
                        new Notice(`Gagal membuat note: ${error.message}`);
                    }
                });
        });

        // Opsi untuk membuat folder baru
        menu.addItem((item) => {
            item
                .setTitle("Folder Baru")
                .setIcon("folder-plus")
                .onClick(async () => {
                    const name = await this.promptForName("Masukkan nama folder baru:");
                    if (name) {
                        try {
                            await this.app.vault.createFolder(folder.path + '/' + name);
                            this.refreshFolderList();
                            new Notice(`Folder "${name}" berhasil dibuat`);
                        } catch (error) {
                            new Notice(`Gagal membuat folder: ${error.message}`);
                        }
                    }
                });
        });

        // Opsi untuk menghapus folder (kecuali root)
        if (folder.path !== '/') {
            menu.addItem((item) => {
                item
                    .setTitle("Hapus Folder")
                    .setIcon("trash")
                    .onClick(async () => {
                        const confirmed = await this.confirmDialog(
                            `Apakah Anda yakin ingin menghapus folder "${folder.name}"?`
                        );
                        if (confirmed) {
                            try {
                                await this.app.vault.delete(folder);
                                this.refreshFolderList();
                                new Notice(`Folder "${folder.name}" berhasil dihapus`);
                            } catch (error) {
                                new Notice(`Gagal menghapus folder: ${error.message}`);
                            }
                        }
                    });
            });

            // Opsi untuk rename folder
            menu.addItem((item) => {
                item
                    .setTitle("Rename Folder")
                    .setIcon("pencil")
                    .onClick(async () => {
                        const newName = await this.promptForName(
                            "Masukkan nama baru:",
                            folder.name
                        );
                        if (newName && newName !== folder.name) {
                            try {
                                const newPath = folder.parent
                                    ? `${folder.parent.path}/${newName}`
                                    : newName;
                                await this.app.vault.rename(folder, newPath);
                                this.refreshFolderList();
                                new Notice(`Folder berhasil direname ke "${newName}"`);
                            } catch (error) {
                                new Notice(`Gagal merename folder: ${error.message}`);
                            }
                        }
                    });
            });
        }

        menu.showAtMouseEvent(e);
    }

    private async promptForName(message: string, defaultValue: string = ""): Promise<string | null> {
        return new Promise((resolve) => {
            const modal = new NamePromptModal(this.app, message, defaultValue, (result) => {
                resolve(result);
            });
            modal.open();
        });
    }

    private async confirmDialog(message: string): Promise<boolean> {
        return new Promise((resolve) => {
            const modal = new ConfirmModal(this.app, message, (result) => {
                resolve(result);
            });
            modal.open();
        });
    }

    private getCurrentFolder(): TFolder | null {
        const selectedHeader = this.folderPane.querySelector('.folder-header.selected');
        if (!selectedHeader) return null;

        // Cek apakah ini root folder
        if (selectedHeader.closest('.root-folder')) {
            return this.app.vault.getRoot();
        }

        // Untuk folder lain
        const folderPath = selectedHeader.closest('.folder-item')?.getAttribute('data-path');
        if (folderPath) {
            const folder = this.app.vault.getAbstractFileByPath(folderPath);
            if (folder instanceof TFolder) {
                return folder;
            }
        }
        return null;
    }

    private refreshCurrentFolderContents() {
        const currentFolder = this.getCurrentFolder();
        if (currentFolder) {
            this.displayFolderContents(currentFolder);
        }
    }
}

class NamePromptModal extends Modal {
    private result: string;
    private onSubmit: (result: string | null) => void;
    private inputEl: HTMLInputElement;

    constructor(app: App, private message: string, private defaultValue: string, onSubmit: (result: string | null) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl("h2", { text: this.message });

        this.inputEl = contentEl.createEl("input", {
            type: "text",
            value: this.defaultValue
        });
        this.inputEl.style.width = "100%";
        this.inputEl.style.marginBottom = "10px";

        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.display = "flex";
        buttonContainer.style.justifyContent = "flex-end";
        buttonContainer.style.gap = "10px";

        // Tombol Batal
        const cancelButton = buttonContainer.createEl("button", { text: "Batal" });
        cancelButton.onclick = () => {
            this.close();
            this.onSubmit(null);
        };

        // Tombol OK
        const submitButton = buttonContainer.createEl("button", { text: "OK" });
        submitButton.onclick = () => {
            this.close();
            this.onSubmit(this.inputEl.value);
        };

        this.inputEl.focus();
        this.inputEl.select();

        // Handle Enter key
        this.inputEl.onkeydown = (e: KeyboardEvent) => {
            if (e.key === "Enter") {
                this.close();
                this.onSubmit(this.inputEl.value);
            }
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class ConfirmModal extends Modal {
    private onSubmit: (result: boolean) => void;

    constructor(app: App, private message: string, onSubmit: (result: boolean) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl("h2", { text: this.message });

        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.display = "flex";
        buttonContainer.style.justifyContent = "flex-end";
        buttonContainer.style.gap = "10px";
        buttonContainer.style.marginTop = "20px";

        // Tombol Batal
        const cancelButton = buttonContainer.createEl("button", { text: "Batal" });
        cancelButton.onclick = () => {
            this.close();
            this.onSubmit(false);
        };

        // Tombol OK
        const submitButton = buttonContainer.createEl("button", { text: "OK" });
        submitButton.onclick = () => {
            this.close();
            this.onSubmit(true);
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
} 