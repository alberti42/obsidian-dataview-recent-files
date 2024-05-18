import { App, Notice, Plugin, PluginSettingTab, Setting, TextAreaComponent, Platform} from 'obsidian';

import { RecentFileFuzzyModal } from 'RecentFileFuzzyModal';

import { RecentFile } from 'types/RecentFiles';

import { Result } from 'dataview_types';
import { QueryResult, TableResult } from 'dataview_types/api/plugin-api';
import DataviewPlugin from 'dataview_types/main';

enum MetaKeyBehavior {
	WINDOW = 'window',
	SPLIT = 'split',
	TAB = 'tab',
}

interface RecentFilesPluginSettings {
	recentlyModifiedQuery: string;
	recentlyCreatedQuery: string;
	metaKeyBehavior: MetaKeyBehavior;
	widthRecentList: number | null;
}

export const DEFAULT_SETTINGS: RecentFilesPluginSettings = {
	recentlyModifiedQuery: `TABLE WITHOUT ID file.path as "Path",
file.name as "Name",
dateformat(date(modified,"yyyy-MM-dd, hh:mm:ss"),"dd.MM.yyyy HH:mm") AS "Date",
tags as "Tags"
FROM "/" 
WHERE modified AND !startswith(file.path, "00 Meta")
SORT date(modified,"yyyy-MM-dd, hh:mm:ss") DESC 
LIMIT 25`,
	recentlyCreatedQuery: `TABLE WITHOUT ID file.path as "Path",
file.name as "Name",
dateformat(date(created,"yyyy-MM-dd, hh:mm:ss"),"dd.MM.yyyy HH:mm") AS "Date",
tags as "Tags"
FROM "/" 
WHERE created AND !startswith(file.path, "00 Meta")
SORT date(created,"yyyy-MM-dd, hh:mm:ss") DESC 
LIMIT 25`,
	metaKeyBehavior: MetaKeyBehavior.TAB,
	widthRecentList: null,
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

		const fields: Record<string, number | undefined> = {
			'Path': undefined,
			'Name': undefined,
			'Tags': undefined,
			'Date': undefined,
		};

		table.headers.forEach((label: string, index: number) => {
			if(label in fields){
				fields[label] = index;	
			} else {
				console.error(`The field '${label}' chosen by the user in the Dataview query will be ignored.`);	
			}
			
		});

		if(fields.Name === undefined) {
			console.error("Wrong Dataview query: you must return a column 'Name' with the file name.");
			return [];
		}

		return table.values.map((row: Array<unknown>): RecentFile | null => {
			if(fields.Tags !== undefined) 	{
				if(row[fields.Tags]==null){
					row[fields.Tags] = [];
				}
			}
			if(fields.Name === undefined || fields.Path === undefined) { return null; }
			return {
				Name: row[fields.Name] as string,  // mandatory field
				Path: row[fields.Path] as string,   // mandatory field
				Date: fields.Date === undefined ? undefined : row[fields.Date] as string,
				Tags: fields.Tags === undefined ? undefined : row[fields.Tags] as Array<string>,
			}}).filter((item: RecentFile | null): item is RecentFile => item !== null);
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
		
		const dataviewAPI = (this.dataviewPlugin as DataviewPlugin).api;
		
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
		this.loadSettings();

		this.dataviewPlugin = (this.app.plugins.getPlugin('dataview')) as DataviewPlugin;
		
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
			return
		}

		new Setting(containerEl).setName('Opening behavior').setHeading();

		let key = 'META';

		if (Platform.isMacOS) {
			key = '⌘';
		} else { // Default to Windows/Linux bindings
			key = 'Ctrl';
		}
		new Setting(containerEl)
			.setName(`Modifier key ${key}:`)
			.setDesc(`Choose how notes should be opened when the modifier key ${key} is pressed.`)
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

		new Setting(containerEl).setName('Dataview queries').setHeading();

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

		new Setting(containerEl).setName('Display').setHeading();

		const widthEl = new Setting(containerEl)
			.setName('Width of recent file list:')
			.setDesc('Choose the width in pixels.')
			.addText(text => {
				text.setPlaceholder('If empty, the default width is assumed.');
				text.setValue(this.plugin.settings.widthRecentList ? this.plugin.settings.widthRecentList.toString() : "");
				text.onChange(async (value: string) => {
					const isValidInteger = (value: string): boolean => {
						return /^\s*\d+\s*$/.test(value);
					};

					if (isValidInteger(value)) {
						this.plugin.settings.widthRecentList = parseInt(value, 10);
					} else {
						console.error('Invalid width: Please enter a valid integer.');
						this.plugin.settings.widthRecentList = null;
					}

					await this.plugin.saveSettings();
				});

				// Set styles for full width
				text.inputEl.style.width = '95%'; // Sets the width to 100% of the settings container
				text.inputEl.style.boxSizing = 'border-box'; // Ensures padding does not affect the width
				text.inputEl.style.flex = '0 0 auto';
			});
		widthEl.infoEl.style.width = '40%';
		widthEl.infoEl.style.flex = '0 0 auto';
		widthEl.settingEl.style.alignItems = 'start';
	}
}
