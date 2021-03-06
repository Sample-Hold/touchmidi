/*
    TouchMIDI
    Ben Coleman, April 2016
    midi.js  v1.0
     * Midi class - MIDI message handler for sending messages
     * MidiAction class - Used to hold action paramters and trigger messages
*/

function Midi(port) {
  this.midi_access = null;
  this.midi_out = null;
  this.midi_port = port;

  // Request access and open MIDI port
  try {
    console.log(`opening MIDI Port ${port}...`);
    navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
  } catch (err) {
    alert(
      "Unable to call requestMIDIAccess()\nYour browser doesn't support MIDI, try using a good modern browser"
    );
  }
}

// =====================================================================================
// Open MIDI output port. Note, global namespace not a class member
// =====================================================================================
function openMIDIOutput() {
  if (midi.midi_access.outputs.size < 1) return;
  if (midi.midi_out) return;

  const midi_out_it = midi.midi_access.outputs.keys();
  for (let i = 0; i <= midi.midi_port && !midi_out_it.done; ++i) {
    midi.midi_out = midi.midi_access.outputs.get(midi_out_it.next().value);
  }

  if (!midi.midi_out) {
    alert("Unable to open MIDI output port: " + midi.midi_port);
    return;
  }

  midi.midi_out.open().then(opened_port => {
    midi.midi_out = opened_port;
    console.log("### Opened MIDI output port: " + midi.midi_out.name);
  });
}

// =====================================================================================
// Open MIDI input port. Note, global namespace not a class member
// =====================================================================================
function openMIDIInput() {
  if (midi.midi_access.inputs.size < 1) return;
  if (midi.midi_in) return;

  const midi_in_it = midi.midi_access.inputs.keys();
  for (let i = 0; i <= midi.midi_port && !midi_in_it.done; ++i) {
    midi.midi_in = midi.midi_access.inputs.get(midi_in_it.next().value);
  }

  if (!midi.midi_in) {
    alert("Unable to open MIDI input port: " + midi.midi_port);
    return;
  }

  midi.midi_in.open().then(opened_port => {
    midi.midi_in = opened_port;
    console.log("### Opened MIDI input port: " + midi.midi_in.name);
  });
}

// =====================================================================================
// Granted MIDI access. Note, global namespace not a class member
// =====================================================================================
function onMIDISuccess(midiaccess) {
  const { inputs, outputs } = midiaccess;
  console.log(`Found (${inputs.size}) input(s), (${outputs.size}) output(s)`);
  midi.midi_access = midiaccess;
  openMIDIOutput();
  openMIDIInput();
  midi.midi_access.onstatechange = () => {
    openMIDIOutput();
    openMIDIInput();
  };
}

// =====================================================================================
// Error trap, never seen this triggered maybe on older browsers without MIDI support
// =====================================================================================
function onMIDIFailure(msg) {
  alert("Failed to get MIDI access: " + msg);
}

// =====================================================================================
// Send MIDI note ON
// =====================================================================================
Midi.prototype.sendNoteOn = function(chan, note, velo) {
  if (!this.midi_out) return;

  this.midi_out.send([0x90 + (chan - 1), note, velo]);
};

// =====================================================================================
// Send MIDI note OFF
// =====================================================================================
Midi.prototype.sendNoteOff = function(chan, note, velo) {
  if (!this.midi_out) return;

  this.midi_out.send([0x80 + (chan - 1), note, velo]);
};

// =====================================================================================
// Send series of messages for a NRPN change
// =====================================================================================
Midi.prototype.sendNRPN = function(chan, msb, lsb, val, high_res) {
  if (!this.midi_out) return;

  this.midi_out.send([0xb0 + (chan - 1), 0x63, msb]);
  this.midi_out.send([0xb0 + (chan - 1), 0x62, lsb]);

  // Handling of high res values (e.g. greater than 127 or 14-bits)
  // This has been tested on a Novation Ultranova, not sure if this is MIDI standard
  if (high_res) {
    var val_msb = Math.floor(val / 128);
    var val_lsb = Math.floor(val % 128);
    this.midi_out.send([0xb0 + (chan - 1), 0x06, val_msb]);
    this.midi_out.send([0xb0 + (chan - 1), 0x26, val_lsb]);
  } else {
    this.midi_out.send([0xb0 + (chan - 1), 0x06, val]);
  }
};

// =====================================================================================
// Send MIDI controller change
// =====================================================================================
Midi.prototype.sendCC = function(chan, cc, val) {
  if (!this.midi_out) return;

  if (val > 127) val = 127;
  this.midi_out.send([0xb0 + (chan - 1), cc, val]);
};

// =====================================================================================
// Send MIDI program change with bank select
// =====================================================================================
Midi.prototype.sendProgChange = function(chan, msb, lsb, num) {
  if (!this.midi_out) return;

  this.midi_out.send([0xb0 + (chan - 1), 0x00, msb]);
  this.midi_out.send([0xb0 + (chan - 1), 0x20, lsb]);
  this.midi_out.send([0xc0 + (chan - 1), num]);
};

/* ********************************************************************* */

function MidiAction(type, chan) {
  this.type = type;
  this.channel = chan;
  if (
    typeof global_midi_channel != "undefined" &&
    global_midi_channel > 0 &&
    global_midi_channel <= 16
  )
    this.channel = global_midi_channel;
  this.on = false;
}

MidiAction.prototype.trigger = function(value, opts = {}) {
  const { direct } = opts;

  // console.log(this, opts);
  
  switch (this.type) {
    case "note":
      if (this.on) {
        midi.sendNoteOff(this.channel, this.note, 0);
      } else {
        midi.sendNoteOn(this.channel, this.note, this.velocity);
      }
      break;
    case "cc":
      var val = arguments[0];
      if (this.on && !direct) {
        if (this.cc_val_off) val = this.cc_val_off;
        midi.sendCC(this.channel, this.cc, val);
      } else {
        if (this.cc_val_on) val = this.cc_val_on;
        midi.sendCC(this.channel, this.cc, val);
      }
      break;
    case "nrpn":
      var val = arguments[0];
      if (this.on) {
        if (this.nrpn_val_off) val = this.nrpn_val_off;
        midi.sendNRPN(
          this.channel,
          this.nrpn_msb,
          this.nrpn_lsb,
          val,
          this.high_res
        );
      } else {
        if (this.nrpn_val_on) val = this.nrpn_val_on;
        midi.sendNRPN(
          this.channel,
          this.nrpn_msb,
          this.nrpn_lsb,
          val,
          this.high_res
        );
      }
      break;
    case "prog":
      var val = arguments[0] ? arguments[0] : this.prog_num;
      if (!this.on)
        midi.sendProgChange(this.channel, this.prog_msb, this.prog_lsb, val);
      break;
  }

  if (!direct) {
    this.on = !this.on;
  }
};
