/**
 * Dock Panel for the Cloud9 IDE client
 * 
 * @copyright 2011, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
 
define(function(require, exports, module) {

var ext = require("core/ext");
var ide = require("core/ide");
var DockableLayout = require("ext/dockpanel/libdock");
var settings = require("ext/settings/settings");

module.exports = ext.register("ext/dockpanel/dockpanel", {
    name           : "Dock Panel",
    dev            : "Ajax.org",
    alone          : true,
    type           : ext.GENERAL,

    defaultState   : {
        bars : []
    },

    nodes          : [],
    dockpanels     : [],
    sections       : {},
    
    loaded : false,
    
    /**
     * Standard Extension functionality
     */
    init : function(amlNode){
        var _self = this;
        
        var vManager = new apf.visibilitymanager();
        this.layout = new DockableLayout(hboxMain, 
            //Find Page
            function(arrExtension){
                if (!arrExtension || !_self.dockpanels[arrExtension[0]])
                    return false;

                var item = _self.dockpanels[arrExtension[0]][arrExtension[1]];
                if (item.page)
                    return item.page;

                var page = item.getPage();
                page.$arrExtension = arrExtension;

                vManager.permanent(page, function(e){
                    item.mnuItem.check();
                }, function(){
                    item.mnuItem.uncheck();
                });

                return page;
            }, 
            //Store Page
            function(amlPage){
                var arrExtension = amlPage.$arrExtension;
                var item = _self.dockpanels[arrExtension[0]][arrExtension[1]];
                item.page = amlPage;

                if (!_self.sections[arrExtension[0]])
                    _self.sections[arrExtension[0]] = {};
                if (!_self.sections[arrExtension[0]][arrExtension[1]]) {
                    _self.sections[arrExtension[0]][arrExtension[1]] = {
                        buttons : [
                            { ext : [arrExtension[0], arrExtension[1]] }
                        ]
                    };
                }

                item.mnuItem.uncheck();

                _self.changed = true;
                settings.save();
            },
            //Find Button Options
            function(arrExtension){
                if (!arrExtension || !_self.dockpanels[arrExtension[0]])
                    return false;

                return _self.dockpanels[arrExtension[0]][arrExtension[1]].options;
            },
            //Change State Handler
            function(){
                _self.changed = true;
                settings.save();
            }
        );

        ide.addEventListener("loadsettings", function(e){
            var model = e.model;
            var strSettings = model.queryValue("auto/dockpanel");
            var settings = _self.defaultState;
            if (strSettings) {
                // JSON parse COULD fail
                try {
                    var objSettings = JSON.parse(strSettings);
                    settings = objSettings.state;
                    apf.extend(_self.sections, objSettings.hidden);
                }
                catch (ex) {}
            }

            // @TODO update collaboration to be sympatico with settings being loaded
            // and re-enable this
            _self.layout.loadState(/*settings ||*/ _self.defaultState);
            _self.loaded = true;
        });

        ide.addEventListener("savesettings", function(e){
            if (!_self.changed)
                return;

            var xmlSettings = apf.createNodeFromXpath(e.model.data, "auto/dockpanel/text()");
            xmlSettings.nodeValue = apf.serialize({
                state  : _self.layout.getState(),
                hidden : _self.sections
            });
            
            return true;
        });
    },

    enable : function(){
        if (this.$lastState)
            this.layout.loadState(this.$lastState);
    },

    disable : function(){
        this.$lastState = this.layout.getState();
        this.layout.clearState();
    },

    destroy : function(){
        this.layout.clearState();
    },

    register : function(name, type, options, getPage){
        var panel = this.dockpanels[name] || (this.dockpanels[name] = {});
        panel[type] = {
            options : options,
            getPage : getPage
        };

        var layout = this.layout, _self = this;

        panel[type].mnuItem = mnuWindows.appendChild(new apf.item({
            caption : options.menu.split("/").pop(),
            type    : "check",
            onclick : function(){
                var page = getPage();

                //Problem state might not be removed from 
                if (!page.parentNode || !page.parentNode.dock) {
                    layout.addItem(_self.sections[name][type]);
                    layout.show(page);
                }
                else {
                    layout.show(page);
                }
            }
        }));
    },
    
    $filterPositionedButtons : function(def) {
        var _self = this;
        function searchSection(section) {
            var buttons = section.buttons;
            for (var button, i = buttons.length - 1; i >= 0; i--) {
                if (checkButton(buttons[i])) {
                    buttons.length--;
                }
            }
            return !buttons.length;
        }
        
        function checkButton(button){
            if (button.position) {
                var section = _self.layout.$findSection(button.position);
                if (section) {
                    randomAccessButtons.unshift(button);
                    button.refSection = section;
                    return true;
                }
            }
            return false;
        }
        
        var randomAccessButtons = [];
        if (def.sections) {
            var sections = def.sections;
            for (var section, j = sections.length - 1; j >= 0; j--) {
                if (searchSection(sections[j]))
                    sections.length--;
            }
            if (!sections.length)
                def = false;
        }
        else if (def.buttons) {
            if (searchSection(def))
                def = false;
        }
        else {
            if (checkButton(def))
                def = false;
        }
        
        for (var i = 0; i < randomAccessButtons.length; i++) {
            this.layout.addButtonToSection(randomAccessButtons[i]);
        }
        
        return def;
    },
    
    addDockable : function(def){
        //See if we have positioned buttons
        def = this.$filterPositionedButtons(def);
        if (!def)
            return;
        
        if (this.loaded) {
            this.layout.addItem(def);
            return;
        }
        
        var state = this.defaultState;
        //Add a bar
        if (def.sections) {
            state.bars.push(def);
            return;
        }
        
        if (def.hidden) {
            var buttons = def.buttons;
            for (var i = 0; i < buttons.length; i++) {
                var ext = buttons[i].ext;
                (this.sections[ext[0]] || (this.sections[ext[0]] = {}))[ext[1]] = def;
            }
            return;
        }

        if (!state.bars[0])
            state.bars[0] = {expanded: false, width: 200, sections: []};

        var bar = state.bars[0];
        //Add a section
        if (def.buttons) {
            bar.sections.push(def);
        }
        //Add a button
        else {
            bar.sections.push({
                flex    : 2,
                width   : 260,
                height  : 350,
                buttons : [def]
            });
        }
    }, //properties.forceShow ??

    //@todo removal of pages

    /**
     * Increases the notification number count by one
     * 
     * @param {array} ext Identifier
     */
    setCounter: function(ext, value){
        this.layout.setCounter(ext, value);
    },
});

    }
);
