import { Plugin, TFile } from 'obsidian';

export default class AutoDeleteEmptyUntitledPlugin extends Plugin {
	private openFiles: Map<string, TFile> = new Map();

	async onload() {
		// Register event for when a file is opened
		this.registerEvent(
			this.app.workspace.on('file-open', (file) => {
				if (file) {
					this.openFiles.set(file.path, file);
				}
			})
		);

		// Register event for when a leaf is closed (tab closed)
		this.registerEvent(
			this.app.workspace.on('layout-change', async () => {
				// Get all currently open files
				const currentlyOpenFiles = new Set<string>();
				this.app.workspace.iterateAllLeaves((leaf) => {
					// Check if the leaf has a file property
					if ('file' in leaf.view && leaf.view.file instanceof TFile) {
						currentlyOpenFiles.add(leaf.view.file.path);
					}
				});

				// Check which files were closed
				for (const [path, file] of this.openFiles.entries()) {
					if (!currentlyOpenFiles.has(path)) {
						// File was closed - check if it should be auto-deleted
						await this.handleFileClosed(file);
						this.openFiles.delete(path);
					}
				}

				// Update the open files map
				currentlyOpenFiles.forEach((path) => {
					const file = this.app.vault.getAbstractFileByPath(path);
					if (file instanceof TFile && !this.openFiles.has(path)) {
						this.openFiles.set(path, file);
					}
				});
			})
		);

		// Initialize the open files map
		this.app.workspace.iterateAllLeaves((leaf) => {
			// Check if the leaf has a file property
			if ('file' in leaf.view && leaf.view.file instanceof TFile) {
				this.openFiles.set(leaf.view.file.path, leaf.view.file);
			}
		});
	}

	/**
	 * Check if a file name matches the default "Untitled" pattern
	 * Matches: "Untitled", "Untitled 1", "Untitled 2", etc.
	 */
	private isUntitledFile(fileName: string): boolean {
		// Remove the .md extension for checking
		const nameWithoutExt = fileName.replace(/\.md$/, '');

		// Check if it matches "Untitled" or "Untitled N" pattern
		const untitledPattern = /^Untitled( \d+)?$/;
		return untitledPattern.test(nameWithoutExt);
	}

	/**
	 * Handle when a file is closed - delete if it's empty and untitled
	 */
	private async handleFileClosed(file: TFile): Promise<void> {
		try {
			// Check if the file still exists (it might have been deleted already)
			const fileExists = !!this.app.vault.getAbstractFileByPath(file.path);
			if (!fileExists) {
				return;
			}

			// Check if it's an untitled file
			if (!this.isUntitledFile(file.name)) {
				return;
			}

			// Read the file content
			const content = await this.app.vault.read(file);
			const hasContent = content.trim().length > 0;

			// If the file is empty, delete it (respecting user's trash preference)
			if (!hasContent) await this.app.fileManager.trashFile(file);				
		} catch (error) {
			console.error('Error handling closed file:', error);
		}
	}
}
