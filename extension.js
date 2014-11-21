
const ExtensionUtils = imports.misc.extensionUtils;
const This = ExtensionUtils.getCurrentExtension();
const Utils = This.imports.utils;
const St = imports.gi.St;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
//const Util = imports.util;
const GLib = imports.gi.GLib;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Convenience = This.imports.convenience;
let backup;
let popupMenu;

function init() {
    Convenience.initTranslations();
}

function enable() {
    
    Main.EndSessionDialog.shutdownDialogContent.confirmButtons.push(
	{
	    signal: 'ConfirmedReboot'
        , label:  C_("button", "Restart to...")
        , buttonType: 'menu'
        , action: function(button, dialog, signal) {
            if(popupMenu) {
                popupMenu.removeAll();
                Main.EndSessionDialog._endSessionDialog._group.remove_actor(popupMenu.actor);
                popupMenu.destroy();
            }
            let popup = new PopupMenu.PopupMenu(button, 0.0, St.Side.TOP, 0);
            popupMenu = popup;    
            Main.EndSessionDialog._endSessionDialog._group.add_actor(popup.actor);
            populatePopup(signal, dialog, popup);
            popup.toggle();
        }
    });

    backup = Main.EndSessionDialog._endSessionDialog._updateButtons;
    
    Main.EndSessionDialog._endSessionDialog._updateButtons = function() {
        let dialogContent = Main.EndSessionDialog.DialogContent[this._type];
        let buttons = [{ action: Lang.bind(this, this.cancel),
                         label:  _("Cancel"),
                         key:    Clutter.Escape }];

        for (let i = 0; i < dialogContent.confirmButtons.length; i++) {
            let signal = dialogContent.confirmButtons[i].signal;
            let label = dialogContent.confirmButtons[i].label;
            let buttonType = dialogContent.confirmButtons[i].buttonType;
            let actionFunc = dialogContent.confirmButtons[i].action;

	        if(typeof(buttonType) == 'undefined') {
	            buttons.push({ action: Lang.bind(this, function() {
    	                       this.close(true);
		                       let signalId = this.connect('closed',
	                                                   Lang.bind(this, function() {
		                                                       this.disconnect(signalId);
		                                                       this._confirm(signal);
	                                                   }));
			                   }),
			           label: label });
	        } else if(buttonType == 'menu'){
	            let dialog = this;
	            buttons.push({ action: function(button) {
                	                actionFunc(button, dialog, signal);
			                   },
			           label: label });
	        }
        }

        this.setButtons(buttons);
    };
}

function populatePopup(signal, dialog, popup) {

    let file = Gio.DataInputStream.new(Gio.file_new_for_path("/boot/grub/grub.cfg").read(null));
    let line;
    let rx = /^menuentry '([^']+)/;
    let count = 0;
    while (line = file.read_line (null)) {
        if(count++ > 600) break;
        let res = rx.exec(line);
        if(res && res.length) {
            addPopupItem(signal, dialog, popup, res[1]);
        }
    }
    file.close(null);
}

function addPopupItem(signal, dialog, popup, item) {
    popup.addAction(item, function() {
        Utils.trySpawnCommandLine("/usr/bin/pkexec --user root /usr/sbin/grub-reboot '" + item + "'", function(pid, status, data) {
            if(status === 0) {
                let signalId = dialog.connect('closed',
                                                       Lang.bind(dialog, function() {
                                                               this.disconnect(signalId);
                                                               this._confirm(signal);
                                                       }));
                dialog.close();
            }
        });
    });
}

function disable() {
	Main.EndSessionDialog.shutdownDialogContent.confirmButtons.pop();
	Main.EndSessionDialog._endSessionDialog._updateButtons = backup;
	if(popupMenu) {
        Main.EndSessionDialog._endSessionDialog._group.remove_actor(popupMenu.actor);
        popupMenu.destroy();
        popupMenu = null;
    }
}

