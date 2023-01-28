# aon-creature-exporter

Aon Creature Exporter is a Firefox add-on that allows you load creatures from the Archive of Nethys and upload them into Roll20.

It does not use any features behind Roll20 paywall, nor does it require other addons. Everything it uses is accessible from any free Roll20 account. All it does is to automate copying and pasting.

# How does it work?

- Go to Archive of Nethys, open a creature (NPCs are not yet working, but will eventually);
- Click on the browser extension (in Firefox, it's the jigsaw piece icon, on the right site of the address bar), open the "AoN Creature Exporter" addon;
- Click on the "Load creature in this page" button. This will load all creature data in your local browser storage;
- Now, go to Roll20 editor;
- Open the browser extension again*, and click on the "Upload <creature name>" button. IMPORTANT: Make sure there are no Character Sheets or Handouts opened in Roll20 when you upload a creature.
- AoN Creature Exporter will execute all clicks and commands to create a new Character Sheet with all the information loaded from Archive of Nethys: name, senses, perception, skills, abilities and melee and ranged attacks. It even creates a simple token (a circle with the creature name in it).

# Installation

Since this is still a beta version, the the easiest way to install it is as a temporary addon:

- Download this addon (on the top of this screen, click "< > Code" -> "Download ZIP") and extract it in a folder of your preference.
- On Firefox, type "about:debugging"
- Click on "This Firefox" at the left side of the screen
- Click on the "Load Temporary Add-on" button and choose the "manifest.json" where you extracted this add on

That's it! Now you may go to the Archive of Nethys and start importing your creatures into Roll20. Remeber you need to Re-load this Temporary Add-on everytime you open your browser.
