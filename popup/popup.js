async function queryActiveTab() {
    return (await browser.tabs.query({ active: true, currentWindow: true }))[0];
}

async function sendMessage(command) {
    const currentTab = await queryActiveTab();
    return browser.tabs.sendMessage(currentTab.id, { command: command })
}

async function storageGet(entry) {
    return browser.storage.sync.get(entry);
}

async function loadCreature() {
    await sendMessage("exportCreature");
    const aonCreature = (await storageGet("aonCreature")).aonCreature;
    $('#creature').text(aonCreature.character_name);
}

async function uploadCreature() {
    await sendMessage("importCreature");
}

(async function () {
    await browser.tabs.executeScript({ file: "/content_scripts/export-creature.js" })

    const currentTab = await queryActiveTab();
    $('#loadCreature').click(loadCreature);
    $('#uploadCreature').click(uploadCreature);

    if (currentTab.url.indexOf('2e.aonprd.com/Monsters.aspx?ID') >= 0) {
        $('#aonScreen').show();
        $('#roll20Screen').hide();

        let aonCreature = (await storageGet("aonCreature")).aonCreature;
        if (aonCreature) {
            $('#creature').text(aonCreature.character_name);
        } else {
            $('#creature').text('None');
        }
    } else if (currentTab.url.indexOf('app.roll20.net/editor') >= 0) {
        $('#aonScreen').hide();
        $('#roll20Screen').show();
        let aonCreature = (await storageGet("aonCreature")).aonCreature;
        if (aonCreature) {
            $('#uploadCreature').text("Upload " + aonCreature.character_name);

            $('#uploadCreature').show();
            $('#nocreature').hide();
        } else {
            $('#uploadCreature').hide();
            $('#nocreature').show();
        }
    }
})();
