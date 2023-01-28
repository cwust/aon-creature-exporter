(function () {
    if (window.hasRunAonExporter) {
        return;
    }
    window.hasRunAonExporter = true;
    addListeners();

    function addListeners() {
        addListener("exportCreature", exportCreature);
        addListener("importCreature", importCreature);
    }

    function addListener(command, callback) {
        try {
            browser.runtime.onMessage.addListener((message) => {
                if (message.command === command) {
                    try {
                        return callback();
                    } catch (err) {
                        console.error('Error processing command ' + command, err);
                    }
                }
            });
        } catch (err) {
            console.error('Error processing command ' + command, err);
        }
    }

    function exportCreature() {
        const AonCreaturePageParser = {
            creatureData: {
                //these fields are parsed with parseEasyFields
                url: null,
                character_name: null,
                npc_type: null,
                level: null,
                alignment: null,
                size: null,
                traits: [],

                //the next fields are more complicated to parse, and will be set in the processLines function
                source: null,
                perception: null,
                senses: [],
                languages: [],
                skills: [],
                strength_modifier: null,
                dexterity_modifier: null,
                constitution_modifier: null,
                intelligence_modifier: null,
                wisdom_modifier: null,
                charisma_modifier: null,
                items: [],
                interaction_abilities: [],
                armor_class: null,
                saving_throws_fortitude: null,
                saving_throws_reflex: null,
                saving_throws_will: null,
                saving_throws_notes: null,
                hit_points: null,
                immunities: [],
                resistances: [],
                weaknesses: [],
                free_actions_reactions: [],
                speeds: [],
                melee_strikes: [],
                ranged_strikes: [],
                actions_activities: []
            },

            parseEasyFields: function () {
                this.creatureData.url = window.location.href;
                this.creatureData.character_name = this.creature_name();
                this.creatureData.npc_type = this.npc_type();
                this.creatureData.image_url = this.image_url();
                this.creatureData.level = this.level();
                this.creatureData.alignment = this.alignment();
                this.creatureData.size = this.size();
                this.creatureData.traits = this.traits();

            },

            getTitleNode: function () {
                let container = $('#ctl00_RadDrawer1_Content_MainContent_DetailedOutput');
                return $($('h1.title', container)[1]);
            },
            image_url: function () {
                return $('#ctl00_RadDrawer1_Content_MainContent_DetailedOutput img.thumbnail').prop('src');
            },
            creature_name: function () {
                return $('a', this.getTitleNode()).text();
            },
            npc_type: function () {
                return $('span', this.getTitleNode()).text().split(' ')[0];
            },
            level: function () {
                return $('span', this.getTitleNode()).text().split(' ')[1];
            },
            alignment: function () {
                return $('.traitalignment').text();
            },
            size: function () {
                return $('.traitsize').text();
            },
            traits: function () {
                return $.map($('.trait'), trait => $(trait).text());
            },

            //now for the more complicated parse part
            currentNode: $('b:contains(Source)')[0], //starts here
            currentSectionIndex: 0,
            getLines: function () {
                //this returns all the relevant lines in the creature page in a more useful format for processing up ahead
                const lines = [];
                while (this.currentNode && this.currentNode.nodeName != 'H2' && this.currentNode.nodeName != 'H3') {
                    if (this.currentNode.nodeName == 'HR') {
                        this.currentSectionIndex++;
                        this.currentNode = this.currentNode.nextSibling;
                        continue;
                    }
                    let line = getNextLine(this.currentNode);
                    line.sectionIndex = this.currentSectionIndex;

                    lines.push(line);

                    this.currentNode = line.nextNode;
                }

                processSuccessFailuresCriticals(lines);

                return lines;

                function getNextLine(node) {
                    let res = {
                        title: null,
                        text: '',
                        nextNode: null
                    }

                    if (node.nodeName == 'SPAN') {
                        res = getNextLine(node.childNodes[0]);
                        node = node.nextSibling;
                    } else {
                        if (node.nodeName != 'B') {
                            console.error("Found a line not starting with a <b> element: ", node);
                            throw 'Parse error!';
                        }

                        res.title = node.innerText;

                        let bChildren = $(node).children();
                        if (bChildren) {
                            for (let bChild of bChildren) {
                                res.text += getNodeText(bChild);
                            }
                        }

                        node = node.nextSibling;
                        while (node && node.nodeName != 'BR' & node.nodeName != 'HR' & node.nodeName != 'H3') {
                            res.text += getNodeText(node);
                            node = node.nextSibling;
                        }
                    }

                    res.text = res.text.trim();
                    const indexAction = res.text.indexOf('@action-');
                    if (indexAction >= 0) {
                        res.action = res.text.substring(indexAction + 1, indexAction + 9);
                        res.text = res.text.replace(/@action-\d/, '');
                    }

                    if (node) {
                        if (node.nodeName == 'BR') {
                            res.nextNode = node.nextSibling;
                        } else {
                            res.nextNode = node;
                        }
                    }

                    while (res.nextNode && res.nextNode.nodeName == '#text' && res.nextNode.nodeValue.trim() == '') {
                        res.nextNode = res.nextNode.nextSibling;
                    }

                    return res;
                }

                function getNodeText(node) {
                    if (node.nodeName == '#text') {
                        return node.nodeValue;
                    } else if (node.nodeName == 'SPAN') {
                        const actions = ['action-1', 'action-2', 'action-3', 'action-4'];

                        for (let action of actions) {
                            if ($(node).hasClass(action)) {
                                return '@' + action;
                            }
                        }
                    }

                    return node.innerText;
                }

                function processSuccessFailuresCriticals(lines) {
                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].title == 'Critical Success') {
                            lines[i - 1].criticalSuccessLine = lines[i];
                            lines.splice(i, 1);
                            i--;
                        } else if (lines[i].title == 'Success') {
                            lines[i - 1].successLine = lines[i];
                            lines.splice(i, 1);
                            i--;
                        } else if (lines[i].title == 'Failure') {
                            lines[i - 1].failureLine = lines[i];
                            lines.splice(i, 1);
                            i--;
                        } else if (lines[i].title == 'Critical Failure') {
                            lines[i - 1].criticalFailureLine = lines[i];
                            lines.splice(i, 1);
                            i--;
                        }
                    }
                }
            },
            processLines: function () {
                const lines = this.getLines()
                for (let line of lines) {
                    this.processLine(line);
                }
            },
            processLine: function (line) {
                switch (line.sectionIndex) {
                    case 0:
                        return this.processLineSection0(line);
                    case 1:
                        return this.processLineSection1(line);
                    case 2:
                        return this.processLineSection2(line);
                }
            },
            processLineSection0: function (line) {
                if (line.title == 'Source') {
                    this.creatureData.source = line.text;
                } else if (line.title == 'Perception') {
                    const matcher = /(?<perception>\+\d+)(?:;?\s*(?<senses>.*))$/.exec(line.text);
                    this.creatureData.perception = matcher.groups.perception;
                    if (matcher.groups.senses) {
                        this.creatureData.senses = matcher.groups.senses.split(',').map(s => s.trim());
                    }
                } else if (line.title == 'Languages') {
                    this.creatureData.languages = line.text.split(',').map(s => s.trim());
                } else if (line.title == 'Skills') {
                    let skills = line.text.split(',').map(s => s.trim());
                    this.creatureData.skills = skills.map(skill => /(?<skill>.*)\s+(?<mod>\+\d+)/.exec(skill).groups);
                } else if (line.title == 'Str') {
                    let attribs = line.text.split(',').map(s => s.trim());
                    this.creatureData.strength_modifier = attribs[0];
                    this.creatureData.dexterity_modifier = attribs[1].substring(4);
                    this.creatureData.constitution_modifier = attribs[2].substring(4);
                    this.creatureData.intelligence_modifier = attribs[3].substring(4);
                    this.creatureData.wisdom_modifier = attribs[4].substring(4);
                    this.creatureData.charisma_modifier = attribs[5].substring(4);
                } else if (line.title == 'Items') {
                    this.creatureData.items = line.text.split(',').map(s => s.trim());
                } else {
                    this.creatureData.interaction_abilities.push(this.parseAbility(line));
                }
            },

            processLineSection1: function (line) {
                if (line.title == 'AC') {
                    const lineParts = line.text.split(';').map(s => s.trim());
                    this.creatureData.armor_class = lineParts[0];

                    const saves = lineParts[1].split(',').map(s => s.trim());
                    this.creatureData.saving_throws_fortitude = saves[0].substring(5);
                    this.creatureData.saving_throws_reflex = saves[1].substring(4);
                    this.creatureData.saving_throws_will = saves[2].substring(5);
                    if (lineParts.length > 2) {
                        this.creatureData.saving_throws_notes = lineParts[2];
                    }
                } else if (line.title == 'HP') {
                    const lineParts = line.text.split(';').map(s => s.trim());
                    this.creatureData.hit_points = lineParts[0];

                    const damageMods = ['immunities', 'resistances', 'weaknesses'];

                    for (let i = 1; i < lineParts.length; i++) {
                        for (let damageMod of damageMods) {
                            if (lineParts[i].toLowerCase().startsWith(damageMod)) {
                                const restOfTheLine = lineParts[i].substring(damageMod.length + 1);
                                this.creatureData[damageMod] = restOfTheLine.split(',').map(s => s.trim());
                            }
                        }
                    }
                } else {
                    this.creatureData.free_actions_reactions.push(this.parseAbility(line));
                }
            },

            processLineSection2: function (line) {
                if (line.title == 'Speed') {
                    this.creatureData.speeds = line.text.split(/[,;]/).map(s => s.trim());
                } else if (line.title == 'Melee') {
                    this.creatureData.melee_strikes.push(this.parseAttack(line));
                } else if (line.title == 'Ranged') {
                    this.creatureData.ranged_strikes.push(this.parseAttack(line));
                } else {
                    const matcher = /(?<tradition>Divine|Arcane|Primal|Occult)\s(?<type>Innate|Prepared)\s*Spells\s*/i.exec(line.title);
                    if (matcher) {
                        this.creatureData.spells = this.parseSpells(line, matcher.groups.tradition, matcher.groups.type);
                    } else {
                        this.creatureData.actions_activities.push(this.parseAbility(line));
                    }
                }
            },

            parseAbility: function (line) {
                const ability = {
                    name: line.title,
                    action: line.action
                };
                let matcher = /\s*(?:\((?<traits>[^\)]*)\))?\s*(?<description>.*)/.exec(line.text);
                if (matcher.groups.traits) {
                    ability.traits = matcher.groups.traits.split(',').map(s => s.trim());
                }

                const description = matcher.groups.description;

                matcher = /\s*Trigger\s*(?<trigger>[^;]*);\s*Effect\s*(?<effect>.*)/.exec(description)

                if (matcher) {
                    ability.trigger = matcher.groups.trigger;
                    ability.description = 'Effect ' + matcher.groups.effect;

                } else {
                    ability.description = description;
                }
                return ability;
            },

            parseAttack: function (line) {
                const matcher = /\s*(?<name>.*)\s+(?<mod1>[+-]\d+)\s*\[(?<mod2>[+-]\d+)\/(?<mod3>[+-]\d+)\]\s*(?:\((?<traits>.*)\))?,\s*Damage\s*(?<damage>\d*d\d+(?:s*[+-]\s*\d+)?)\s*(?<type>\S*)?/.exec(line.text);
                if (!matcher) {
                    console.error('Error parsing attack:');
                    console.error(line);
                    throw "Error parsing attack";
                }
                return matcher.groups;
            },
            parseSpells: function (line, tradition, type) {
                const matcher = /\s*DC\s*(?<dc>\d+),\s*attack\s(?<attack>\+\d+)(;\s10th\s*(?<level10>[^;]*)\s*)?(;\s9th\s*(?<level9>[^;]*)\s*)?(;\s8th\s*(?<level8>[^;]*)\s*)?(;\s7th\s*(?<level7>[^;]*)\s*)?(;\s6th\s*(?<level6>[^;]*)\s*)?(;\s5th\s*(?<level5>[^;]*)\s*)?(;\s4th\s*(?<level4>[^;]*)\s*)?(;\s3rd\s*(?<level3>[^;]*)\s*)?(;\s2nd\s*(?<level2>[^;]*)\s*)?(;\s1st\s*(?<level1>[^;]*)\s*)?(;\sCantrips\s*\((?<cantrip_level>\d..)\)(?<cantrips>[^;]*)\s*)?/.exec(line.text);
                if (!matcher) {
                    console.error('Error parsing spells:');
                    console.error(line);
                    throw "Error parsing spells";
                }

                const result = {
                    tradition: tradition,
                    type: type,
                    dc: matcher.groups.dc,
                    attack: matcher.groups.attack,
                };

                for (let i = 1; i <= 10; i++) {
                    if (matcher.groups['level' + i]) {
                        result['level' + i] = matcher.groups['level' + i].split(',').map(s => s.trim());
                    }
                }

                if (matcher.groups.cantrip_level) {
                    result.cantrip_level = matcher.groups.cantrip_level;
                }

                if (matcher.groups.cantrips) {
                    result.cantrips = matcher.groups.cantrips.split(',').map(s => s.trim());
                }

                return result;
            },
            getCreatureData: function () {
                this.parseEasyFields();
                this.processLines();
                return this.creatureData;
            }
        }

        const aonCreature = AonCreaturePageParser.getCreatureData();
        browser.storage.sync.set({
            aonCreature: aonCreature
        });
    }

    async function storageGet(entry) {
        return browser.storage.sync.get(entry);
    }

    async function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function importCreature() {
        const TokenGenerator = {
            size: 128,
            borderWidth: 4,
            borderColor: '#000000',
            backgroundColor: '#333333',
            textColor: '#ffffff',
            lineSpacing: 2,
            fontSize: 24,
            font: 'Verdana',

            canvas: null,
            ctx: null, //Canvas context
            init: function () {
                this.canvas = document.createElement('canvas');
                this.canvas.setAttribute('width', '' + this.size);
                this.canvas.setAttribute('height', '' + this.size);
                this.ctx = this.canvas.getContext("2d");
            },
            fillCircle: function (centerX, centerY, radius, fillStyle) {
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, true);
                this.ctx.fillStyle = fillStyle;
                this.ctx.fill();
            },
            writeCenter: function (text, y) {
                this.ctx.textBaseline = "middle";
                this.ctx.font = this.fontSize + "px " + this.font;
                const textMeasure = this.ctx.measureText(text);
                const x = (this.size / 2) - (textMeasure.width / 2);
                this.ctx.fillStyle = this.textColor;
                this.ctx.fillText(text, x, y);
            },
            drawToken: function (name) {
                this.fillCircle(this.size / 2, this.size / 2, this.size / 2, this.borderColor);
                this.fillCircle(this.size / 2, this.size / 2, (this.size / 2) - this.borderWidth, this.backgroundColor);

                const lines = name.trim().split(' ').map(str => str.length > 6 ? str.substring(0, 6) + '.' : str);

                const totalHeight = (lines.length * (this.fontSize + this.lineSpacing)) - this.lineSpacing;
                let textY = ((this.size / 2) - (totalHeight / 2)) + (this.fontSize / 2);

                for (let line of lines) {
                    this.writeCenter(line, textY);
                    textY += this.fontSize + this.lineSpacing;
                }
            },
            dataURLtoFile(dataurl, filename) {

                var arr = dataurl.split(','),
                    mime = arr[0].match(/:(.*?);/)[1],
                    bstr = atob(arr[1]),
                    n = bstr.length,
                    u8arr = new Uint8Array(n);

                while (n--) {
                    u8arr[n] = bstr.charCodeAt(n);
                }

                return new File([u8arr], filename, { type: mime });
            },
            generateTokenDataUrl: function (name) {
                this.init();
                this.drawToken(name);
                return this.canvas.toDataURL('image/png');
            },
            generateTokenFile(creatureName) {
                const tokenDataUrl = this.generateTokenDataUrl(creatureName);
                return this.dataURLtoFile(tokenDataUrl, creatureName + ".json");
            }
        }

        const Roll20Page = {
            intervalBetweenAttemps: 500,
            maxAttemps: 25,
            click: async function (selector, insideIFrame) {
                const event = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                });
                const element = await this.getElement(selector, insideIFrame);
                element.dispatchEvent(event);
            },
            changeInputValue: async function (selector, insideIFrame, value) {
                if (value === null || value === undefined) {
                    value = '';
                } else if (value && Array.isArray(value)) {
                    value = value.join(', ');
                }

                const element = await this.getElement(selector, insideIFrame);
                element.value = value;
                element.dispatchEvent(new FocusEvent('blur'));
            },
            getElement: async function (selector, insideIFrame) {
                return new Promise((resolve, reject) => this._getElement(selector, insideIFrame, 0, resolve, reject));
            },
            _getElement: function (selector, insideIFrame, numberOfAttemps, resolve, reject) {
                if (numberOfAttemps > this.maxAttemps) {
                    console.error('Timeout waiting for ' + selector);
                    reject('Timeout waiting for ' + selector);
                    return;
                }

                const result = $(selector, insideIFrame ? $('div.characterdialog iframe').contents() : undefined);

                if (result.length == 0) {
                    setTimeout(() => this._getElement(selector, insideIFrame, numberOfAttemps + 1, resolve, reject), this.intervalBetweenAttemps);
                } else {
                    if (result.length > 1) {
                        console.warn('Found more than one element for selector ' + selector + '. Returning the first one');
                    }
                    resolve(result[0]);
                }
            },
            waitForElementVisible: async function (selector, insideIFrame) {
                return new Promise((resolve, reject) => this._waitForElementVisible(selector, insideIFrame, 0, resolve, reject));
            },
            _waitForElementVisible: function (selector, insideIFrame, numberOfAttemps, resolve, reject) {
                if (numberOfAttemps > this.maxAttemps) {
                    console.error('Timeout waiting for ' + selector);
                    reject('Timeout waiting for ' + selector);
                    return;
                }

                const result = $(selector, insideIFrame ? $('div.characterdialog iframe').contents() : undefined);

                if (result.length > 1) {
                    console.warn('Found more than one element for selector ' + selector + '. Returning the first one');
                }

                if (result.length == 0 || !result.is(':visible') || !result.height()) {
                    setTimeout(() => this._waitForElementVisible(selector, insideIFrame, numberOfAttemps + 1, resolve, reject), this.intervalBetweenAttemps);
                } else {
                    resolve();
                }
            },
            openJournal: async function () {
                await this.click('a[href="#journal"]');
            },
            clickAddButton: async function () {
                await this.click('button[href="#superjournaladd"]');
            },
            clickAddNewCharacter: async function () {
                await this.click('#addnewcharacter');
            },
            changeCharacterName: async function (name) {
                this.changeInputValue('div.ui-dialog-content input.name', false, name);
            },
            uploadToken: async function (file) {
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                const inputFile = await this.getElement('div.ui-dialog-content div.avatar input[type=file]');
                inputFile.files = dataTransfer.files;
                inputFile.dispatchEvent(new Event('change'));
            },
            clickSaveChanges: async function () {
                await this.click('div.ui-dialog button.save-button');
            },
            clickOptions: async function () {
                return this.click('div.characterviewer label[title=options]', true);
            },
            clickSheetLayoutNpc: async function () {
                return this.click('div.options-panel h3[data-i18n=change-sheet-type] + div.options-row > button[name=act_toggle_npc]', true);
            },
            waitForOptionsVisible: async function () {
                return this.waitForElementVisible('div.options', true);

            },
            waitForNpcSheetVisible: async function () {
                return this.waitForElementVisible('div.npc', true);
            },
            waitForNpcSettingsVisible: async function () {
                return this.waitForElementVisible('div.npc-settings', true);
            },
            clickNpcSettingsButton: async function () {
                return this.click('div.npc button.pictos[name=act_toggle_npcsettings]', true);
            },
            copySimpleFieldFromCreature: async function (creatureData, fieldName, attrName) {
                let value = creatureData[fieldName];
                if (value && Array.isArray(value)) {
                    value = value.join(', ');
                }

                await this.changeInputValue('div.npc-settings input[name=' + (attrName || 'attr_' + fieldName) + ']', true, value);
            },
            copyRepeatingItems: async function (items, sectionSelector, mappings) {
                if (!items) {
                    return;
                };

                for (let i = 0; i < items.length; i++) {
                    await sleep(100);
                    await this.click(sectionSelector + ' .repcontrol_add', true);

                    const item = items[i];
                    const repitemSelector = sectionSelector + ' .repcontainer .repitem:nth-child(' + (i + 1) + ')';
                    for (let attr in mappings) {
                        let value = mappings[attr](item);
                        if (value && value.trim) {
                            value = value.trim();
                        }
                        if (value) {
                            const selector = repitemSelector + ' input[name=' + attr + ']:not([type=hidden]), ' + repitemSelector + ' textarea[name=' + attr + ']';
                            const element = await this.getElement(selector, true);
                            if (element.value == value) {
                                //already has the value, it's probably a checkbox
                                await this.click(selector, true);
                            } else {
                                await this.changeInputValue(selector, true, value);
                            }
                        } else {
                            console.log('Skipped ' + attr + ' because it had no value');
                        }
                    }
                }

                for (let i = 0; i < items.length; i++) {
                    const repitemSelector = sectionSelector + ' .repcontainer .repitem:nth-child(' + (i + 1) + ')';
                    await this.click(repitemSelector + ' .settings-button', true);
                }
            },
            importCreature: async function (creatureData) {
                await this.openJournal();
                await this.clickAddButton();
                await this.clickAddNewCharacter();
                await this.changeCharacterName(creatureData.character_name);

                const tokenFile = TokenGenerator.generateTokenFile(creatureData.character_name);

                await this.uploadToken(tokenFile);
                await this.clickSaveChanges();
                await this.clickOptions();
                await this.waitForOptionsVisible();
                await this.clickSheetLayoutNpc();
                await this.waitForNpcSheetVisible();
                await this.changeInputValue('div.npc input[name=attr_hit_points]', true, creatureData.hit_points.replaceAll(/[^\d]/g, ''));
                await this.clickNpcSettingsButton();
                await this.waitForNpcSettingsVisible();

                await this.copySimpleFieldFromCreature(creatureData, 'character_name');
                await this.copySimpleFieldFromCreature(creatureData, 'npc_type');
                await this.copySimpleFieldFromCreature(creatureData, 'level');
                await this.copySimpleFieldFromCreature(creatureData, 'alignment');
                await this.copySimpleFieldFromCreature(creatureData, 'size');
                await this.copySimpleFieldFromCreature(creatureData, 'traits');
                await this.copySimpleFieldFromCreature(creatureData, 'perception');
                await this.copySimpleFieldFromCreature(creatureData, 'senses');
                await this.copySimpleFieldFromCreature(creatureData, 'languages');
                await this.changeInputValue('div.npc-settings input[name=attr_npc_short_description]', true, creatureData.source + " (" + creatureData.url + ")");
                for (let skill of creatureData.skills) {
                    const mainSkills = ["acrobatics", "arcana", "athletics", "crafting", "deception", "diplomacy", "intimidation", "medicine", "nature", "occultism", "performance", "religion", "society", "stealth", "survival", "thievery"];
                    if (mainSkills.indexOf(skill.skill.toLowerCase()) >= 0) {
                        await this.changeInputValue('div.npc-settings input[name=attr_' + skill.skill.toLowerCase() + ']', true, skill.mod);
                    } else {
                        console.warn('Ignoring skill ', skill);
                    }
                    //TODO: Lores
                }
                await this.copySimpleFieldFromCreature(creatureData, 'strength_modifier');
                await this.copySimpleFieldFromCreature(creatureData, 'dexterity_modifier');
                await this.copySimpleFieldFromCreature(creatureData, 'constitution_modifier');
                await this.copySimpleFieldFromCreature(creatureData, 'intelligence_modifier');
                await this.copySimpleFieldFromCreature(creatureData, 'wisdom_modifier');
                await this.copySimpleFieldFromCreature(creatureData, 'charisma_modifier');
                await this.copySimpleFieldFromCreature(creatureData, 'armor_class');
                await this.copySimpleFieldFromCreature(creatureData, 'saving_throws_fortitude');
                await this.copySimpleFieldFromCreature(creatureData, 'saving_throws_reflex');
                await this.copySimpleFieldFromCreature(creatureData, 'saving_throws_will');
                await this.changeInputValue('div.npc-settings textarea[name=attr_saving_throws_notes]', true, creatureData.saving_throws_notes);
                await this.copySimpleFieldFromCreature(creatureData, 'hit_points', 'attr_hit_points_max');
                await this.copySimpleFieldFromCreature(creatureData, 'immunities');
                await this.copySimpleFieldFromCreature(creatureData, 'weaknesses');
                await this.copySimpleFieldFromCreature(creatureData, 'resistances');

                if (creatureData.speeds) {
                    if (creatureData.speeds.length) {
                        await this.changeInputValue('div.npc-settings input[name=attr_speed]', true, creatureData.speeds[0]);
                    } else if (creatureData.speeds.length > 1) {
                        await this.changeInputValue('div.npc-settings input[name=attr_speed_notes]', true, creatureData.speeds.filter(s => s != creatureData.speeds[0]).join(', '));
                    }
                }
                await sleep(3000);

                await this.copyRepeatingItems(creatureData.items, 'div.npc-items', {
                    attr_worn_item: (item) => item
                });

                await this.copyRepeatingItems(creatureData.interaction_abilities, 'div.npc-interaction-abilities', {
                    attr_name: (interaction_ability) => interaction_ability.name,
                    //TODO: actions?
                    attr_rep_traits: (interaction_ability) => interaction_ability.traits,
                    attr_description: (interaction_ability) => interaction_ability.description
                });

                await this.copyRepeatingItems(creatureData.free_actions_reactions, 'div.npc-free-actions-reactions', {
                    attr_name: (free_action_reaction) => free_action_reaction.name,
                    attr_free_action: (free_action_reaction) => (free_action_reaction.action == 'action-0' ? 'free_action' : null),
                    attr_reaction: (free_action_reaction) => (free_action_reaction.action == 'action-4' ? 'reaction' : null),
                    attr_rep_traits: (free_action_reaction) => free_action_reaction.traits,
                    attr_trigger: (free_action_reaction) => free_action_reaction.trigger,
                    attr_description: (free_action_reaction) => free_action_reaction.description
                });

                await sleep(100);
                await this.click('div.npc-melee-strikes .repcontrol_edit', true);
                await sleep(100);
                await this.click('div.npc-melee-strikes .repcontainer .repitem:nth-child(1) .repcontrol_del', true);
                await sleep(100);
                await this.click('div.npc-melee-strikes .repcontrol_edit', true); 0

                await this.copyRepeatingItems(creatureData.melee_strikes, 'div.npc-melee-strikes', {
                    attr_weapon: (melee_strike) => melee_strike.name,
                    attr_weapon_strike: (melee_strike) => melee_strike.mod1,
                    attr_weapon_traits: (melee_strike) => melee_strike.traits,
                    attr_weapon_agile: (melee_strike) => (melee_strike.traits && melee_strike.traits.indexOf('agile')) >= 0 ? '1' : null,
                    attr_weapon_strike_damage: (melee_strike) => melee_strike.damage,
                    attr_weapon_strike_damage_type: (melee_strike) => melee_strike.type
                });

                await this.copyRepeatingItems(creatureData.ranged_strikes, 'div.npc-ranged-strikes', {
                    attr_weapon: (ranged_strike) => ranged_strike.name,
                    attr_weapon_strike: (ranged_strike) => ranged_strike.mod1,
                    attr_weapon_traits: (ranged_strike) => ranged_strike.traits,
                    attr_weapon_agile: (ranged_strike) => (ranged_strike.traits && ranged_strike.traits.indexOf('agile')) >= 0 ? '1' : null,
                    attr_weapon_strike_damage: (ranged_strike) => ranged_strike.damage,
                    attr_weapon_strike_damage_type: (ranged_strike) => ranged_strike.type
                });

                await this.copyRepeatingItems(creatureData.actions_activities, 'div.npc-actions-and-activies', {
                    attr_name: (action_activity) => action_activity.name,
                    attr_actions: (action_activity) => {
                        if (action_activity.action == 'action-0') {
                            return "Free Action"
                        } else if (action_activity.action == 'action-1') {
                            return '1';
                        } else if (action_activity.action == 'action-2') {
                            return '2';
                        } else if (action_activity.action == 'action-3') {
                            return '3';
                        } else if (action_activity.action == 'action-4') {
                            return 'Reaction';
                        } else {
                            return null;
                        }
                    },
                    attr_rep_traits: (action_activity) => action_activity.traits,
                    attr_description: (action_activity) => action_activity.description
                });

                await this.clickNpcSettingsButton();
            }
        }

        try {
            const aonCreature = (await storageGet("aonCreature")).aonCreature;
            await Roll20Page.importCreature(aonCreature);
            alert(aonCreature.character_name + ' imported successfully!');
        } catch (err) {
            console.log('err', err);
            alert('Error uploading creature!');
        }
    }
})();
