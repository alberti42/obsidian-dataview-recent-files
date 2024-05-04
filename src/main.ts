import { App, Editor, MarkdownFileInfo, MarkdownView, Modal, Notice, Plugin, PluginManager, PluginSettingTab, Setting, TextAreaComponent} from 'obsidian';

import { RecentFileFuzzyModal } from 'RecentFileFuzzyModal';

import { RecentFile } from 'types/RecentFiles';

import { Result, Success } from 'dataview_types';
import { QueryResult, DataviewApi, TableResult } from 'dataview_types/api/plugin-api';
import DataviewPlugin from 'dataview_types/main';

// import styles.css for being deployed with the plugin
import "../styles/styles.css";

enum MetaKeyBehavior {
	WINDOW = 'window',
	SPLIT = 'split',
	TAB = 'tab',
}

interface RecentFilesPluginSettings {
	recentlyModifiedQuery: string;
	recentlyCreatedQuery: string;
	metaKeyBehavior: MetaKeyBehavior;
}

export const DEFAULT_SETTINGS: RecentFilesPluginSettings = {
	recentlyModifiedQuery: `TABLE file.name as "Name",
dateformat(date(modified,"yyyy-MM-dd, hh:mm:ss"),"dd.MM.yyyy HH:mm") AS "Date",
tags as "Tags"
FROM "/" 
WHERE modified
SORT date(modified,"yyyy-MM-dd, hh:mm:ss") DESC 
LIMIT 25`,
	recentlyCreatedQuery: `TABLE file.name as "Name",
dateformat(date(created,"yyyy-MM-dd, hh:mm:ss"),"dd.MM.yyyy HH:mm") AS "Date",
tags as "Tags"
FROM "/" 
WHERE created
SORT date(created,"yyyy-MM-dd, hh:mm:ss") DESC 
LIMIT 25`,
	metaKeyBehavior: MetaKeyBehavior.TAB,
}

export default class RecentFilesPlugin extends Plugin {
	settings: RecentFilesPluginSettings = { ...DEFAULT_SETTINGS};
	private dataviewPlugin: DataviewPlugin | undefined;

	parseQueryResults(results: Result<QueryResult, string>): RecentFile[] {
		if(!(results && results.successful))
		{
			console.error("Query failed to execute successfully.");
	        return [];
		}

		const type = results.value.type;
		if(!(type == "table")) {
			console.error(`Dataview produced a result type '${type}' instead of 'table'.`);
			return [];
		}

		const table = results.value as TableResult;

		var fields: Record<string, number | undefined> = {
			'Path': 0,
			'Name': undefined,
			'Tags': undefined,
			'Date': undefined,
		};

		table.headers.forEach((label:string, index: number) => {
			fields[label] = index;
		});

		if(fields.Name === undefined) {
			console.error("Wrong Dataview query: you must return a column 'Name' with the file name.");
		}

	    return table.values.map((row: Array<any>): RecentFile => {
	    	if(fields.Tags !== undefined) 	{
		    	if(row[fields.Tags]==null){
		    		row[fields.Tags] = [];
		    	}
		    }
			return {
				Path: fields.Path === undefined ? undefined : row[fields.Path].path,
				Tags: fields.Tags === undefined ? undefined : row[fields.Tags].join(', '),
				Name: fields.Name === undefined ? undefined : row[fields.Name],
				Date: fields.Date === undefined ? undefined : row[fields.Date],
			}});
	}

	checkDataviewEnabled() {
		if (!this.dataviewPlugin) {
			// make a new attempt to load Dataview
			this.dataviewPlugin = (this.app.plugins.getPlugin('dataview')) as DataviewPlugin;
			if (!this.dataviewPlugin) {
				throw Error("Dataview plugin is not loaded.");
			}
		}

		if (!this.app.plugins.isEnabled('dataview')) {
			throw Error("Dataview plugin is not enabled.");
		}
	}

	async showRecentFilesModal(query: string, hint: string) {
		try {
			this.checkDataviewEnabled();
		} catch(e: unknown) {
			if(e instanceof Error) {
				new Notice(e.message);
			}
			else {
				console.error("Dataview plugin not found:",e);
			}
			return;
		}
		
		let dataviewAPI = (this.dataviewPlugin as DataviewPlugin).api;
	    
	    let results;
	    try {
	        results = await dataviewAPI.query(query);

	    } catch (error) {
	        console.error("Failed to execute query or show modal:", error);
	    }
	    const parsedFiles = this.parseQueryResults(results);
        const modal = new RecentFileFuzzyModal(this.app, this, hint, parsedFiles);
        modal.open();
	}

	async onload() {
		this.dataviewPlugin = (this.app.plugins.getPlugin('dataview')) as DataviewPlugin;
		
		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		this.addCommand({
			id: 'show-recently-modified-files',
			name: 'Show recently modified files',
			callback: () => {
				this.showRecentFilesModal(this.settings.recentlyModifiedQuery, 'modified');
			}
		});

		this.addCommand({
			id: 'show-recently-created-files',
			name: 'Show recently created files',
			callback: () => {
				this.showRecentFilesModal(this.settings.recentlyCreatedQuery, 'created');
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new RecentFilesTab(this.app, this));
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class RecentFilesTab extends PluginSettingTab {
	plugin: RecentFilesPlugin;

	constructor(app: App, plugin: RecentFilesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Settings for Dataview Recent Files Plugin' });

		try{
			this.plugin.checkDataviewEnabled();
		}
		catch(e: unknown) {
			if(e instanceof Error) {
				containerEl.createEl('p', { text: e.message });
			}
			else {
				console.error("Dataview plugin not found:",e);
			}
		}

		let key = 'META';
		const os = navigator.platform.toUpperCase();
		if (os.includes('MAC')) {
			key = '⌘';
		} else { // Default to Windows/Linux bindings
			key = 'Ctrl';
		}
		new Setting(containerEl)
            .setName(`Behavior of modifierrrr ${key} key:`)
            .setDesc(`Choose how notes should be opened when the modifier ${key} key is pressed.`)
            .addDropdown(dropdown => {
                dropdown.addOption(MetaKeyBehavior.TAB, 'In a new tab');
                dropdown.addOption(MetaKeyBehavior.SPLIT, 'In a split pane');
                dropdown.addOption(MetaKeyBehavior.WINDOW, 'In a new window');
                dropdown.setValue(this.plugin.settings.metaKeyBehavior)
                .onChange(async (value: string) => {
                	if (Object.values(MetaKeyBehavior).includes(value as MetaKeyBehavior)) {
            		this.plugin.settings.metaKeyBehavior = value as MetaKeyBehavior;
                    	await this.plugin.saveSettings();
					} else {
                    	console.error('Invalid option selection:', value);
                    }
            })});

		const createQuery = ((label:string,queryInput:string,queryDefault:string,callback:((queryOutput:string)=>void)) => {
		const modQuery = new Setting(containerEl)
			.setName(`Dataview query for recently ${label} files:`)
			.setDesc(createFragment((frag) => {
            	frag.appendText('Supported fields returned from the Dataview query:');
            	frag.createEl('ul')
            	.createEl('li',{text: '"Name" → name of the original file displayed in the list (mandatory)'})
				.createEl('li',{text: '"Tags" → tags containing a list of tags (optional) '})
            	.createEl('li',{text: '"Date" → date field (optional)'})
            	.createEl('li',{text: '"Custom" → custom field (optional)'});
            }))
			.addTextArea((textArea: TextAreaComponent) => {
				textArea.setPlaceholder(queryDefault)
					.setValue(queryInput)
					.onChange(async (value) => {
						if(value == "") {
							callback(queryDefault);
						} else {
							callback(value);	
						}
						await this.plugin.saveSettings();
					});

				// Set styles for full width
				textArea.inputEl.style.width = '95%'; // Sets the width to 100% of the settings container
				textArea.inputEl.style.boxSizing = 'border-box'; // Ensures padding does not affect the width
				textArea.inputEl.style.minHeight = '300px';
				textArea.inputEl.style.flex = '0 0 auto';
			});
			modQuery.infoEl.style.width = '40%';
			modQuery.infoEl.style.flex = '0 0 auto';
			modQuery.settingEl.style.alignItems = 'start';
		});

		createQuery('created',this.plugin.settings.recentlyCreatedQuery,DEFAULT_SETTINGS.recentlyCreatedQuery,(query:string)=>{this.plugin.settings.recentlyCreatedQuery = query;});
		createQuery('modified',this.plugin.settings.recentlyModifiedQuery,DEFAULT_SETTINGS.recentlyModifiedQuery,(query:string)=>{this.plugin.settings.recentlyModifiedQuery = query;});
	}
}
