ADSRNode
========

ADSRNode is a single JavaScript function that creates an ADSR envelope for use in WebAudio.

* [Demo](https://rawgit.com/voidqk/adsrnode/master/demo.html)

Usage
-----

```javascript
var ctx = new AudioContext();

// simple ADSR envelope
var envelope = ADSRNode(ctx, {
  attack:  0.1, // seconds until hitting 1.0
  decay:   0.2, // seconds until hitting sustain value
  sustain: 0.5, // sustain value
  release: 0.3  // seconds until returning back to 0.0
});

// advanced ADSR envelope
// where <curve> can be 'linear' or 'exponential'
var envelope = ADSRNode(ctx, {
  base:             5.0, // starting value (default: 0.0)
  delay:            0.1, // seconds to wait before attacking (default: 0.0)
  attack:           0.2, // seconds until hitting peak value
  attackCurve:  <curve>, // set type of curve for attack (default: 'linear')
  peak:             9.0, // peak value (default: 1.0)
  hold:             0.3, // seconds to hold at the peak value (default: 0.0)
  decay:            0.4, // seconds until hitting sustain value
  decayCurve:   <curve>, // set type of curve for decay (default: 'linear')
  sustain:          3.0, // sustain value
  release:          0.5, // seconds until returning back to base value
  releaseCurve: <curve>  // set type of curve for release (default: 'linear')
});
```

The returned `envelope` object is a
[ConstantSourceNode](https://developer.mozilla.org/en-US/docs/Web/API/ConstantSourceNode).

It can be connected to other nodes using the normal
[envelope.connect(...)](https://developer.mozilla.org/en-US/docs/Web/API/AudioNode/connect) and
[envelope.disconnect(...)](https://developer.mozilla.org/en-US/docs/Web/API/AudioNode/disconnect)
functions.

It must be started with
[envelope.start()](https://developer.mozilla.org/en-US/docs/Web/API/AudioScheduledSourceNode/start),
to begin outputting the `base` value.  It can be stopped with
[envelope.stop()](https://developer.mozilla.org/en-US/docs/Web/API/AudioScheduledSourceNode/stop).

Three new methods are added to the object:

### *envelope*.trigger([*when*])

Trigger the envelope.

The `when` parameter is optional.  It's the time, in seconds, at which the envelope should trigger.
It is the same time measurement as [AudioContext.currentTime](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/currentTime),
just like many other functions that take timed events.

### *envelope*.release([*when*])

Release a triggered envelope.

The `when` parameter behaves just like `envelope.trigger`.

### *envelope*.reset([*when*])

Reset an envelope immediately (output `base` value and wait for a trigger).

The `when` parameter behaves just like `envelope.trigger`.
