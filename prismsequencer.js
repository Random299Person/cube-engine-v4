(function(Scratch) {
  'use strict';

  const animationKeyframes = {
    open: {
      IFRAME: [{
        top: "100%",
        easing: "ease-out"
      }, {
        top: "10%"
      }],
      BG: [{
          filter: "opacity(0%)",
          easing: "ease-out"
        },
        {
          filter: "opacity(100%)"
        },
      ],
    },
    close: {
      IFRAME: [{
        top: "10%",
        easing: "ease-in"
      }, {
        top: "-100%"
      }],
      BG: [{
          filter: "opacity(100%)",
          easing: "ease-in"
        },
        {
          filter: "opacity(0%)"
        },
      ],
    },
  };

  const localHost = false;

  const sound_lift_away = "";
  const sound_here = "";
  const sound_lift = "";

  class PrismSequencer {
    getInfo() {
      return {
        id: "prismSequencer",
        name: "Prismatic Sequencer",
        color1: "#9900ffff",
        color2: "#4e0097ff",
        color3: "#2b0053ff",
        blocks: [{
            opcode: 'openSequencerWindow',
            text: 'Open sequencer',
            blockType: Scratch.BlockType.BUTTON
          },
          {
            opcode: 'importFromLegacy',
            text: 'Import from time/value lists (experimental)',
            blockType: Scratch.BlockType.BUTTON
          },
          {
            opcode: 'setSoundBuffer',
            text: 'Set sound buffer to [BUFFER]',
            blockType: Scratch.BlockType.COMMAND,
            hideFromPalette: true,
            arguments: {
              BUFFER: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: "",
              },
            },
          },
          {
            opcode: 'setConductor',
            text: 'Sequencer BPM: [BPM] SPB: [SPB]  BPL: [BPL]',
            blockType: Scratch.BlockType.COMMAND,
            arguments: {
              BPM: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 120,
              },
              SPB: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 4,
              },
              BPL: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 16,
              },
            },
          },
        ],
      };
    }

    _handlePMvsEM(variableName) {
      switch (variableName) {
        case "--menu-bar-background":
          return Scratch.extensions.isElectraMod ?
            "var(--menu-bar-background, hsla(244, 23%, 48%, 1))" :
            "var(--menu-bar-background, #009CCC)";

        case "--ui-modal-overlay":
          return Scratch.extensions.isElectraMod ?
            "var(--ui-modal-overlay, hsla(244, 23%, 48%, 0.9))" :
            "var(--ui-modal-overlay, hsla(194, 100%, 65%, 0.9))";

        default:
          break;
      }
    }

    _setupTheme() {
      this._menuBarBackground = "#6f0fbdff";
      this._defaultBackgroundColor = "white";
      this._textColor = "black";
      this._buttonShadow = "hsla(0, 0%, 0%, 0.15)";
      this.fade = "#6f0fbd44";
      this._shadowBorder = "hsla(0, 100%, 100%, 0.25)";
      
      // Force return true as per original code logic
      if (true) {
        return;
      }

      if (typeof scaffolding !== "undefined") {
        this._menuBarBackground = "#6f0fbdff";
        this._defaultBackgroundColor = "white";
        this._textColor = "black";
        this._buttonShadow = "hsla(0, 0%, 0%, 0.15)";
        this.fade = "#6f0fbddd";
        this._shadowBorder = "hsla(0, 100%, 100%, 0.25)";
        return;
      }

      this._menuBarBackground = Scratch.extensions.isPenguinMod ?
        this._handlePMvsEM("--menu-bar-background") :
        "var(--menu-bar-background)";

      this._defaultBackgroundColor = Scratch.extensions.isPenguinMod ?
        document.body.getAttribute("theme") == "dark" ?
        "var(--ui-primary)" :
        "white" :
        "var(--ui-modal-background)";

      this._textColor = Scratch.extensions.isPenguinMod ?
        document.body.getAttribute("theme") == "dark" ?
        "white" :
        "black" :
        "var(--ui-modal-foreground)";

      this._buttonShadow = Scratch.extensions.isPenguinMod ?
        "hsla(0, 0%, 0%, 0.15)" :
        "var(--ui-black-transparent)";

      this.fade = this._handlePMvsEM("--ui-modal-overlay");

      this._shadowBorder = Scratch.extensions.isPenguinMod ?
        "hsla(0, 100%, 100%, 0.25)" :
        "var(--ui-white-transparent)";
    }

    // --- Helpers ---

    _getTarget() {
      if (typeof vm !== 'undefined') {
        return vm.editingTarget || vm.runtime.getTargetForStage();
      }
      return null;
    }

    _getSounds() {
      const target = this._getTarget();
      if (!target) return [];
      return target.getSounds();
    }
    
    _findSoundByName(name) {
      const sounds = this._getSounds();
      return sounds.find(s => s.name === name);
    }
    
    _getSoundUri(sound) {
      if (!sound) return null;
      return sound.asset.encodeDataURI();
    }

    _getVariableValue(name) {
      const target = this._getTarget();
      if (!target) return "";
      // Check local vars first
      let v = Object.values(target.variables).find(v => v.name === name);
      // If not found, check stage (globals)
      if (!v && target !== vm.runtime.getTargetForStage()) {
        const stage = vm.runtime.getTargetForStage();
        v = Object.values(stage.variables).find(v => v.name === name);
      }
      return v ? v.value : "";
    }

    _setVariableValue(name, value) {
      const target = this._getTarget();
      if (!target) return;
      
      // Look up in current target
      let v = Object.values(target.variables).find(v => v.name === name);
      // Look up in stage
      if (!v && target !== vm.runtime.getTargetForStage()) {
         const stage = vm.runtime.getTargetForStage();
         v = Object.values(stage.variables).find(v => v.name === name);
      }

      if (v) {
        v.value = value;
      } else {
        // Create if it doesn't exist (default to creating on current target)
        // We separate creation and assignment because createVariable might not return the object
        target.createVariable(name, name, "");
        
        // Retrieve the newly created variable
        let newVar = target.variables[name];
        if (newVar) {
           newVar.value = value;
        }
      }
    }

    _deleteVariable(name) {
       const target = this._getTarget();
       if (!target) return;
       // Try current target
       let v = Object.values(target.variables).find(v => v.name === name);
       if (v) {
           target.deleteVariable(v.id);
           return;
       }
       // Try stage
       const stage = vm.runtime.getTargetForStage();
       if (stage) {
           v = Object.values(stage.variables).find(v => v.name === name);
           if (v) stage.deleteVariable(v.id);
       }
    }

    getCharts() {
      const target = this._getTarget();
      if (!target) return new Map();

      // Combine local and global variables
      const localVars = Object.values(target.variables);
      const globalVars = vm.runtime.getTargetForStage() ? Object.values(vm.runtime.getTargetForStage().variables) : [];
      const allVars = [...localVars, ...globalVars];
      
      const charts = new Map();
      const seenIds = new Set();

      for (const variable of allVars) {
        if (variable.type !== "" || seenIds.has(variable.id)) continue;
        seenIds.add(variable.id);

        const name = Scratch.Cast.toString(variable.name);
        const value = Scratch.Cast.toString(variable.value);

        if (name.startsWith("##")) {
           charts.set(name, value);
        }
      }
      return charts;
    }
    
    _updateSoundBufferFromChartName(chartName) {
        if (!chartName.startsWith("##")) return;
        const content = chartName.substring(2);
        
        let sound = null;
        
        // Matches: Loop1, loop 1, L1, l1 (with or without space)
        const loopMatch = content.match(/^(?:Loop|loop|L|l)\s*(\d+)$/);
        
        if (loopMatch) {
            const index = parseInt(loopMatch[1], 10);
            const sounds = this._getSounds();
            // X - 1 for 1-based index
            if (index > 0 && index <= sounds.length) {
                sound = sounds[index - 1];
            }
        } else {
            // Treat as literal name
            sound = this._findSoundByName(content);
        }
        
        if (sound) {
            this.soundBuffer = this._getSoundUri(sound);
        } else {
            // Reset buffer if no matching sound found, to prevent playing old audio
            this.soundBuffer = "";
        }
    }
    
    async askUserForFile() {
      return new Promise((resolve) => {
        var input = document.createElement('input');
        input.type = 'file';

        input.onchange = e => { 
          var file = e.target.files[0]; 
          resolve(file);
        }

        input.click();
      });
    }

    async askUserForFiles() {
      return new Promise((resolve) => {
        var input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;

        input.onchange = e => { 
          var files = Array.from(e.target.files); 
          resolve(files);
        }
        
        input.oncancel = () => {
          resolve([]);
        }

        input.click();
      });
    }

    // --- Menu Logic ---

    async openSequencerWindow() {
      this._createMenu();
    }

    async importFromLegacy() {
      if (!confirm("This will attempt to import from legacy time/value lists. This is experimental and may not work perfectly. Proceed?"))
        return;
      
      if (!confirm("Please select BOTH the time list and value list files (hold Ctrl or Shift). Proceed?"))
        return;

      const files = await this.askUserForFiles();
      if (files.length < 2) {
          alert("Import cancelled: You must select at least two files (Time list and Value list).");
          return;
      }
      
      const fileTextA = await files[0].text();
      const fileTextB = await files[1].text();
      
      let timeText, valueText;

      // Heuristic: Check if the first few non-empty lines are numbers
      const isTimeList = (txt) => {
         const lines = txt.split('\n').map(l => l.trim()).filter(l => l.length > 0);
         if (lines.length === 0) return false;
         // Check up to 5 lines
         return lines.slice(0, 5).every(l => !isNaN(parseFloat(l)) && isFinite(l));
      };

      if (isTimeList(fileTextA)) {
          timeText = fileTextA;
          valueText = fileTextB;
      } else {
          timeText = fileTextB;
          valueText = fileTextA;
      }

      const timeLines = timeText.split("\n").map(line => line.trim()).filter(line => line.length > 0);
      const valueLines = valueText.split("\n").map(line => line.trim()).filter(line => line.length > 0);

      const mode = prompt("Enter the mode for import:\n1: Broadcast (VALUE)\n2: Broadcast (X) with (VALUE)\n3: Advanced Broadcast (X)\n4: Advanced Broadcast (X) with (VALUE)", "1");

      if (!["1", "2", "3", "4"].includes(mode)) {
        alert("Invalid mode selected. Import cancelled.");
        return;
      }

      const mode_X = (mode === "2" || mode === "4") ? prompt("Enter the value for X (broadcast names):", "character-anim") : null;

      const events = [];
      for (let i = 0; i < Math.min(timeLines.length, valueLines.length); i++) {
        const time = parseFloat(timeLines[i]);
        const value = valueLines[i];
        if (mode === "1" || mode === "3") {
          events.push({
            time: time,
            column: 0,
            type: mode === "1" ? "Broadcast Message" : "Broadcast Advanced Message",
            name: value,
            data: "",
            target: 0,
            stacking: false
          });
        } else if (mode === "2" || mode === "4") {
          events.push({
            time: time,
            column: 0,
            type: mode === "2" ? "Broadcast Message" : "Broadcast Advanced Message",
            name: mode_X,
            data: value,
            target: 0,
            stacking: false
          });
        }
      }

      const finalName = "##" + prompt("Enter a name for the imported chart (no need for the double hashtags):", "Imported Chart");
      // Initialize with empty JSON structure or whatever default the sequencer expects
      this._setVariableValue(finalName, JSON.stringify(events));
    }

    _createMenu() {
        const bgFade = document.createElement("div");
        Object.assign(bgFade.style, {
            width: "100%", height: "100%", position: "absolute", left: "0px", top: "0px",
            backgroundColor: this.fade, zIndex: "10000", display: "flex", 
            alignItems: "center", justifyContent: "center"
        });

        const menuBox = document.createElement("div");
        Object.assign(menuBox.style, {
            width: "400px", height: "500px", backgroundColor: "#181818", 
            borderRadius: "12px", display: "flex", flexDirection: "column",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)", overflow: "hidden",
            fontFamily: "Helvetica, Arial, sans-serif"
        });

        // Header
        const header = document.createElement("div");
        Object.assign(header.style, {
            padding: "15px", backgroundColor: this._menuBarBackground, color: "white",
            fontSize: "18px", fontWeight: "bold", display: "flex", justifyContent: "space-between",
            alignItems: "center"
        });
        header.innerText = "Select Chart";
        
        const closeBtn = document.createElement("button");
        closeBtn.innerText = "✕";
        Object.assign(closeBtn.style, {
            background: "none", border: "none", color: "white", fontSize: "18px", cursor: "pointer"
        });
        closeBtn.onclick = () => {
            document.body.removeChild(bgFade);
        };
        header.appendChild(closeBtn);
        menuBox.appendChild(header);

        // Chart List Container
        const listContainer = document.createElement("div");
        Object.assign(listContainer.style, {
            flex: "1", overflowY: "auto", padding: "10px", backgroundColor: "#121212"
        });
        menuBox.appendChild(listContainer);

        // Updated refreshList to accept an optional 'optimistic' chart
        const refreshList = (tempChart = null) => {
            listContainer.innerHTML = "";
            const charts = this.getCharts();
            
            // If we just created a chart, insert it manually into the map
            // so it shows up even if the VM hasn't updated 'getCharts' yet.
            if (tempChart) {
                charts.set(tempChart.name, tempChart.value);
            }
            
            if (charts.size === 0) {
                const empty = document.createElement("div");
                empty.innerText = "No charts found. Create one!";
                empty.style.padding = "20px";
                empty.style.textAlign = "center";
                empty.style.color = "#aaa";
                listContainer.appendChild(empty);
            }

            charts.forEach((val, name) => {
                const row = document.createElement("div");
                Object.assign(row.style, {
                    backgroundColor: "#2d2d2d", padding: "10px", marginBottom: "8px", borderRadius: "6px",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)", color: "white"
                });

                const nameLabel = document.createElement("span");
                nameLabel.innerText = name;
                nameLabel.style.fontWeight = "bold";
                nameLabel.style.cursor = "pointer";
                nameLabel.style.flex = "1";
                // Click name to open
                nameLabel.onclick = () => {
                    document.body.removeChild(bgFade);
                    this.openSequencerEditor(name);
                };
                
                const btnGroup = document.createElement("div");
                btnGroup.style.display = "flex";
                btnGroup.style.gap = "5px";

                const cloneBtn = document.createElement("button");
                cloneBtn.innerText = "Clone";
                cloneBtn.style.fontSize = "12px";
                cloneBtn.onclick = () => {
                    const newName = prompt("Name for cloned chart:", name + " Copy");
                    if (newName) {
                        const finalName = newName.startsWith("##") ? newName : "##" + newName;
                        this._setVariableValue(finalName, val);
                        document.body.removeChild(bgFade);
                        this.openSequencerEditor(finalName);
                    }
                };

                const delBtn = document.createElement("button");
                delBtn.innerText = "Delete";
                delBtn.style.fontSize = "12px";
                delBtn.style.color = "red";
                delBtn.onclick = () => {
                    if(confirm(`Are you sure you want to delete ${name}?`)) {
                        this._deleteVariable(name);
                        refreshList();
                    }
                };

                btnGroup.appendChild(cloneBtn);
                btnGroup.appendChild(delBtn);
                row.appendChild(nameLabel);
                row.appendChild(btnGroup);
                listContainer.appendChild(row);
            });
        };

        refreshList();

        // Footer / Create
        const footer = document.createElement("div");
        Object.assign(footer.style, {
            padding: "15px", borderTop: "1px solid #333", backgroundColor: "#181818",
            display: "flex", gap: "10px", alignItems: "center"
        });

        const prefix = document.createElement("span");
        prefix.innerText = "##";
        prefix.style.fontWeight = "bold";
        prefix.style.color = "#ccc";

        const input = document.createElement("input");
        input.placeholder = "New Chart Name";
        Object.assign(input.style, {
            flex: "1", padding: "8px", borderRadius: "4px", border: "1px solid #444",
            backgroundColor: "#333", color: "white"
        });

        const createBtn = document.createElement("button");
        createBtn.innerText = "Create";
        Object.assign(createBtn.style, {
            padding: "8px 16px", backgroundColor: this._menuBarBackground, color: "white",
            border: "none", borderRadius: "4px", cursor: "pointer"
        });
        
        const createAction = () => {
            const val = input.value.trim();
            if (val) {
                // Disable UI during creation
                createBtn.disabled = true;
                createBtn.style.opacity = "0.5";
                createBtn.style.cursor = "not-allowed";
                createBtn.innerText = "Saving...";
                input.disabled = true;

                const finalName = "##" + val;
                // Initialize with empty JSON structure or whatever default the sequencer expects
                this._setVariableValue(finalName, "{}");
                
                input.value = "";
                
                // Re-enable UI
                createBtn.disabled = false;
                createBtn.style.opacity = "1";
                createBtn.style.cursor = "pointer";
                createBtn.innerText = "Create";
                input.disabled = false;
                input.focus();
                
                // Immediately refresh the list with the known new chart
                refreshList({ name: finalName, value: "{}" });
            }
        };

        createBtn.onclick = createAction;
        input.onkeydown = (e) => { if (e.key === "Enter") createAction(); };

        footer.appendChild(prefix);
        footer.appendChild(input);
        footer.appendChild(createBtn);
        menuBox.appendChild(footer);

        bgFade.appendChild(menuBox);
        document.body.appendChild(bgFade);
    }

    // --- Editor Logic ---

    async openSequencerEditor(chartName) {
      this.activeChart = chartName;
      
      // Automatically load the sound buffer based on the chart name
      this._updateSoundBufferFromChartName(chartName);

      //Handle experimental versions
      var frameSource =
        localHost ? "http://localhost:8000/sequencer.html" : "https://random299person.github.io/cube-engine-v4/sequencer.html";
      
      frameSource += "?embed=true";
      
      if (this.bpm) frameSource += "&bpm=" + this.bpm;
      if (this.spb) frameSource += "&spb=" + this.spb;
      if (this.bpl) frameSource += "&bpl=" + this.bpl;

      if (!localHost && !(await Scratch.canEmbed(frameSource))) {
        return;
      }

      //Styling the background and IFrame
      const bgFade = document.createElement("div");
      bgFade.style.width = "100%";
      bgFade.style.height = "100%";
      bgFade.style.position = "absolute";
      bgFade.style.left = "0px";
      bgFade.style.top = "0px";
      bgFade.style.backgroundColor = this.fade;
      bgFade.style.filter = "opacity(100%)";
      bgFade.style.zIndex = "10000";

      document.body.appendChild(bgFade);

      const IFrame = document.createElement("iframe");
      this.IFrame = IFrame;
      IFrame.style.backgroundColor = this._menuBarBackground;
      IFrame.style.width = "80%";
      IFrame.style.height = "80%";
      IFrame.style.borderRadius = "8px";
      IFrame.style.borderColor = this._shadowBorder;
      IFrame.style.borderWidth = "4px";
      IFrame.style.borderStyle = "solid";
      IFrame.style.position = "absolute";
      IFrame.style.left = "10%";
      IFrame.style.top = "10%";
      IFrame.style.zIndex = "10001";

      const messageHandler = (e) => {
          var data = e.data;
          if (!data) return;

          if (data.type == 'save') {
             // Save data to the variable
             // Check if data is already a string to avoid double-stringification
             let content = data.data;
             if (typeof content !== 'string') {
                 content = JSON.stringify(content);
             }
             this._setVariableValue(this.activeChart, content);
             IFrame.closeIframe();
          }
          if (data.type == 'exit') {
             IFrame.closeIframe();
          }
          if (data.type == 'requestSound') {
            if (this.soundBuffer) {
              IFrame.contentWindow.postMessage(
                {
                  type: "loadAudio",
                  data: (this.soundBuffer || ""),
                },
                IFrame.src
              );
            }
            
            // Load data from the variable
            const chartData = this._getVariableValue(this.activeChart);
            let parsed = {};
            try {
              // Remove non-breaking spaces that confuse JSON.parse
              let cleanData = String(chartData).replace(/\u00A0/g, " ");
              parsed = JSON.parse(cleanData);
              // Handle double-stringification if present
              if (typeof parsed === 'string') {
                  try { parsed = JSON.parse(parsed); } catch(e2) {}
              }
            } catch(e) {
                console.warn("PrismSequencer: Failed to parse chart data", e);
            }
            
            IFrame.contentWindow.postMessage({
                type: "loadEvents", // Ensure your sequencer.html handles 'loadChart'
                data: parsed
            }, IFrame.src);
          }
      };

      window.addEventListener("message", messageHandler);

      IFrame.closeIframe = () => {
        window.removeEventListener("message", messageHandler);

        if (this.liftawayAudio) {
          this.liftawayAudio.currentTime = 0;
          this.liftawayAudio.play();
        }

        document.body.style.overflowY = "hidden";
        IFrame.animate(animationKeyframes.close.IFRAME, 1000);
        bgFade.animate(animationKeyframes.close.BG, 1000);

        setTimeout(() => {
          document.body.removeChild(IFrame);
          document.body.removeChild(bgFade);
        }, 1000);
      };

      IFrame.src = frameSource;

      //Popup animation
      document.body.style.overflowY = "hidden";
      IFrame.animate(animationKeyframes.open.IFRAME, 1000);
      bgFade.animate(animationKeyframes.open.BG, 1000);

      if (this.liftAudio) {
        this.liftAudio.currentTime = 0;
        this.liftAudio.play();
      }

      var here = this.hereAudio;
      setTimeout(() => {
        if (here) {
          here.currentTime = 0;
          here.play();
        }
      }, 1000);

      document.body.appendChild(IFrame);
    }

    setSoundBuffer(args) {
      this.soundBuffer = args.BUFFER;
    }

    setConductor(args) {
      this.bpm = args.BPM;
      this.spb = args.SPB;
      this.bpl = args.BPL;
    }

    constructor() {
      this._setupTheme();
      if (typeof scaffolding === "undefined") {
        this.liftawayAudio = new Audio(sound_lift_away);
        this.hereAudio = new Audio(sound_here);
        this.liftAudio = new Audio(sound_lift);

        this.liftawayAudio.preload = 'auto';
        this.liftawayAudio.load();

        this.hereAudio.preload = 'auto';
        this.hereAudio.load();

        this.liftAudio.preload = 'auto';
        this.liftAudio.load();
      }
    }
  }
  Scratch.extensions.register(new PrismSequencer());
})(Scratch);