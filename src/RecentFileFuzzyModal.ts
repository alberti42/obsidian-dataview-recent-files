/* eslint-disable @typescript-eslint/no-inferrable-types */
import { App, FuzzyMatch, FuzzySuggestModal, TFile, Notice } from 'obsidian';

import { RecentFile } from "types/RecentFiles";

import RecentFilesPlugin from 'main';

enum MetaKeyBehavior {
	WINDOW = 'window',
	SPLIT = 'split',
	TAB = 'tab',
}

import { DEFAULT_SETTINGS } from 'main';

export class RecentFileFuzzyModal extends FuzzySuggestModal < RecentFile > {
	constructor(app: App, private plugin: RecentFilesPlugin, private hint: string, private files: Array < RecentFile > ) {
		super(app);
		this.setPlaceholder(`Search recently ${hint} files...`);
		this.setInstructions(this.getInstructionsBasedOnOS());
	}

	getInstructionsBasedOnOS(): { command: string, purpose: string } [] {
		const os = navigator.platform.toUpperCase();
		if (os.includes('MAC')) {
			return [
				{ command: '↑↓', purpose: 'to navigate' },
				{ command: "↵", purpose: "to open the selected file" },
				{ command: '⌘+↵', purpose: 'to open in a new tab' },
				{ command: 'esc', purpose: 'to dismiss' },
			];
		} else { // Default to Windows/Linux bindings
			return [
				{ command: '↑↓', purpose: 'to navigate' },
				{ command: "↵", purpose: "to open the selected file" },
				{ command: 'Ctrl+↵', purpose: 'to open in a new tab' },
				{ command: 'esc', purpose: 'to dismiss' },
			];
		}
	}

	openNote(filePath: string, shouldCreateNewLeaf: boolean = true) {
		const fileToOpen: TFile = this.app.vault.getAbstractFileByPath(filePath) as TFile;
		if (!(fileToOpen instanceof TFile)) {
			// Handle the error if the file is not found
			const msg = 'File not found';
			new Notice(msg + '.');
			console.error(msg + ':', filePath);
		}
		let leaf = this.app.workspace.getMostRecentLeaf();
		if (shouldCreateNewLeaf || (leaf && leaf.getViewState().pinned)) {
			let default_behavior = DEFAULT_SETTINGS.metaKeyBehavior;
			switch(this.plugin.settings.metaKeyBehavior){
			case MetaKeyBehavior.SPLIT:
				default_behavior = MetaKeyBehavior.SPLIT;
				break;
			case MetaKeyBehavior.TAB:
				default_behavior = MetaKeyBehavior.TAB;
				break;
			case MetaKeyBehavior.WINDOW:
				default_behavior = MetaKeyBehavior.WINDOW;
				break;
			}
			leaf = this.app.workspace.getLeaf(default_behavior);
		}
		if (leaf) {
			leaf.openFile(fileToOpen);
		} else {
			console.error("Error in creating a leaf for the file to be opened:", filePath);
		}
	}

	onOpen() {
		super.onOpen();
		this.inputEl.focus();
		this.containerEl.addEventListener('keydown', this.handleKeyDown);
	}

	onClose() {
		this.containerEl.removeEventListener('keydown', this.handleKeyDown);
		super.onClose();
		this.contentEl.empty();
	}

	private handleKeyDown = (evt: KeyboardEvent) => {
		// evt.isComposing determines whether the event is part of a key composition
		if (evt.key === 'Enter' && !evt.isComposing && evt.metaKey) {
			this.chooser.useSelectedItem(evt);
		}
	}

	getItemText(item: RecentFile): string {
		return item.Name;
	}

	renderSuggestion(item: FuzzyMatch < RecentFile > , el: HTMLElement) {
		super.renderSuggestion(item, el);
		// el.innerHTML = `Open ` + el.innerHTML;
	}

	getItems(): Array < RecentFile > {
		return this.files;
	}

	onChooseItem(item: RecentFile, evt: MouseEvent | KeyboardEvent): void {
		const metaKeyPressed = evt.metaKey;
		this.openNote(item.Path, metaKeyPressed);
	}
}