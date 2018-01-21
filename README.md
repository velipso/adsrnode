ADSRNode
========

ADSRNode is a single JavaScript function that creates an ADSR envelope for use in WebAudio.

* [Demo](https://rawgit.com/voidqk/adsrnode/master/demo.html)

Usage
-----

### ADSRNode(*audioCtx*, *opts*)

```javascript
// create the Audio Context
var ctx = new AudioContext();

// simple ADSR envelope
var envelope = ADSRNode(ctx, {
  attack:  0.1, // seconds until hitting 1.0
  decay:   0.2, // seconds until hitting sustain value
  sustain: 0.5, // sustain value
  release: 0.3  // seconds until returning back to 0.0
});

// advanced ADSR envelope
var envelope = ADSRNode(ctx, {
  base:         5.0, // starting/ending value (default: 0)
  attack:       0.2, // seconds until hitting peak value (default: 0)
  attackCurve:  0.0, // amount of curve for attack (default: 0)
  peak:         9.0, // peak value (default: 1)
  hold:         0.3, // seconds to hold at the peak value (default: 0)
  decay:        0.4, // seconds until hitting sustain value (default: 0)
  decayCurve:   5.0, // amount of curve for decay (default: 0)
  sustain:      3.0, // sustain value (required)
  release:      0.5, // seconds until returning back to base value (default: 0)
  releaseCurve: 1.0  // amount of curve for release (default: 0)
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

The following methods/properties are added to the object:

### *envelope*.trigger([*when*])

Trigger the envelope.

The `when` parameter is optional.  It's the time, in seconds, at which the envelope should trigger.
It is the same time measurement as
[AudioContext.currentTime](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/currentTime),
just like many other functions that take timed events.  I.e., to trigger in two seconds, you
would do: `envelope.trigger(ctx.currentTime + 2)`.  If omitted, it will trigger immediately.

### *envelope*.release([*when*])

Release a triggered envelope.

The `when` parameter behaves just like `envelope.trigger`.

### *envelope*.reset()

Reset an envelope immediately (i.e., output `base` value and wait for a trigger).

### *envelope*.update(*opts*)

Update the values of the ADSR curve.  All keys are optional.  For example, to just update the
peak, use `envelope.update({ peak: 2 })`.

Updating the envelope will also `reset` it.

### *envelope*.baseTime

This value is set after an `envelope.release(...)` to provide the exact moment (in absolute seconds)
that the envelope will return to the base value.

Triggering and Releasing
------------------------

[Special care](https://rawgit.com/voidqk/adsrnode/master/debugger.html) has been taken to ensure the
envelope correctly responds to triggering and releasing while still outputting a partial envelope.

For example, if a trigger happens in the middle of the release phase, the attack will pick up where
the release left off -- as it should.  Or if a release happens during the attack phase, it will
correctly apply the release curve where the attack left off, etc.

The only requirement from users of the library is to ensure calls to `trigger` and `release` happen
in chronological order.

For example, the following will fail, because it attempts to insert a trigger *before* a future
trigger:

```javascript
// this FAILS
envelope.trigger(8); // schedule trigger at 8 second mark
envelope.trigger(5); // schedule trigger at 5 second mark (error!)
```

This is easily fixed by simply ordering the calls:

```javascript
// valid
envelope.trigger(5);
envelope.trigger(8);
```
