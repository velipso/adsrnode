// (c) Copyright 2018, Sean Connelly (@voidqk), http://sean.cm
// MIT License
// Project Home: https://github.com/voidqk/adsrnode

(function(){

var DEBUG = false;

function ADSRNode(ctx, opts){
	// `ctx` is the AudioContext
	// `opts` is an object in the format:
	// {
	//   base:                         <number>, // output     optional    default: 0
	//   attack:                       <number>, // seconds    required
	//   attackCurve:  'linear' | 'exponential', // curve      optional    default: 'linear'
	//   peak:                         <number>, // output     optional    default: 1
	//   hold:                         <number>, // seconds    optional    default: 0
	//   decay:                        <number>, // seconds    required
	//   decayCurve:   'linear' | 'exponential', // curve      optional    default: 'linear'
	//   sustain:                      <number>, // output     required
	//   release:                      <number>, // seconds    required
	//   releaseCurve: 'linear' | 'exponential', // curve      optional    default: 'linear'
	// }

	function getNum(opts, key, def){
		if (typeof def === 'number' && typeof opts[key] === 'undefined')
			return def;
		if (typeof opts[key] === 'number')
			return opts[key];
		throw new Error('[ADSRNode] Expecting "' + key + '" to be a number');
	}

	function getCurve(opts, key, def){
		if (typeof opts[key] === 'undefined')
			return def;
		if (opts[key] === 'linear' || opts[key] === 'exponential')
			return opts[key];
		throw new Error('[ADSRNode] Expecting "' + key + '" to be "linear" or "exponential"');
	}

	// extract options
	var base    = getNum  (opts, 'base'        ,        0);
	var attack  = getNum  (opts, 'attack'                );
	var acurve  = getCurve(opts, 'attackCurve' , 'linear');
	var peak    = getNum  (opts, 'peak'        ,        1);
	var hold    = getNum  (opts, 'hold'        ,        0);
	var decay   = getNum  (opts, 'decay'                 );
	var dcurve  = getCurve(opts, 'decayCurve'  , 'linear');
	var sustain = getNum  (opts, 'sustain'               );
	var release = getNum  (opts, 'release'               );
	var rcurve  = getCurve(opts, 'releaseCurve', 'linear');

	// create the node and inject the new methods
	var node = ctx.createConstantSource();
	node.offset.value = base;

	// unfortunately, I can't seem to figure out how to use cancelAndHoldAtTime, so I have to have
	// code that calculates the ADSR curve in order to figure out the value at a given time, if an
	// interruption occurs
	//
	// the curve functions (linearRampToValueAtTime and setTargetAtTime) require an *event*
	// preceding the curve in order to calculate the correct start value... inserting the event
	// *should* work with cancelAndHoldAtTime, but it doesn't (or I misunderstand the API).
	//
	// therefore, for the curves to start at the correct location, I need to be able to calculate
	// the entire ADSR curve myself, so that I can correctly interrupt the curve at any moment.
	//
	// these values track the state of the trigger/release moments, in order to calculate the final
	// curve
	var lastTrigger = false;
	var lastRelease = false;

	// the exponential decay as it relates to the duration of the decay
	// setTargetAtTime's `timeConstant` is set to `duration / expFactor`
	var expFactor = 6;

	// small epsilon value to check for divide by zero
	var eps = 0.00001;

	function curveValue(type, startValue, endValue, curTime, maxTime){
		if (type === 'linear')
			return startValue + (endValue - startValue) * Math.min(curTime / maxTime, 1);
		// otherwise, exponential
		return endValue + (startValue - endValue) * Math.exp(-curTime * expFactor / maxTime);
	}

	function triggeredValue(tv, time){
		// calculates the actual value of the envelope at a given time, where `time` is the number
		// of seconds after a trigger (but before a release)
		var atktime = tv.atktime;
		if (time < atktime)
			return curveValue(acurve, tv.v, peak, time, atktime);
		if (time < atktime + hold)
			return peak;
		if (time < atktime + hold + decay)
			return curveValue(dcurve, peak, sustain, time - atktime - hold, decay);
		return sustain;
	}

	function releasedValue(rv, time){
		// calculates the actual value of the envelope at a given time, where `time` is the number
		// of seconds after a release
		if (time < 0)
			return sustain;
		if (time > rv.reltime)
			return base;
		return curveValue(rcurve, rv.v, base, time, rv.reltime);
	}

	function curveTo(param, type, value, time, duration){
		if (type === 'linear' || duration <= 0)
			param.linearRampToValueAtTime(value, time + duration);
		else // exponential
			param.setTargetAtTime(value, time, duration / expFactor);
	}

	node.trigger = function(when){
		if (typeof when === 'undefined')
			when = this.context.currentTime;

		if (lastTrigger !== false){
			if (when < lastTrigger.when)
				throw new Error('[ADSRNode] Cannot trigger before future trigger');
			this.release(when);
		}
		var v = base;
		var interruptedLine = false;
		if (lastRelease !== false){
			var now = when - lastRelease.when;
			v = releasedValue(lastRelease, now);
			// check if a linear release has been interrupted by this attack
			interruptedLine = rcurve === 'linear' && now >= 0 && now <= lastRelease.reltime;
			lastRelease = false;
		}
		var atktime = attack;
		if (Math.abs(base - peak) >eps)
			atktime = attack * (v - peak) / (base - peak);
		lastTrigger = { when: when, v: v, atktime: atktime };

		this.offset.cancelScheduledValues(when);

		if (DEBUG){
			// simulate curve using triggeredValue (debug purposes)
			for (var i = 0; i < 10; i += 0.01)
				this.offset.setValueAtTime(triggeredValue(lastTrigger, i), when + i);
			return this;
		}

		if (interruptedLine)
			this.offset.linearRampToValueAtTime(v, when);
		else
			this.offset.setTargetAtTime(v, when, 0.001);
		curveTo(this.offset, acurve, peak, when, atktime);
		if (hold > 0)
			this.offset.setTargetAtTime(peak, when + atktime + hold, 0.001);
		curveTo(this.offset, dcurve, sustain, when + atktime + hold, decay);
		return this;
	};

	node.release = function(when){
		if (typeof when === 'undefined')
			when = this.context.currentTime;

		if (lastTrigger === false)
			throw new Error('[ADSRNode] Cannot release without a trigger');
		if (when < lastTrigger.when)
			throw new Error('[ADSRNode] Cannot release before the last trigger');
		var tnow = when - lastTrigger.when;
		var v = triggeredValue(lastTrigger, tnow);
		var reltime = release;
		if (Math.abs(sustain - base) > eps)
			reltime = release * (v - base) / (sustain - base);
		lastRelease = { when: when, v: v, reltime: reltime };
		var atktime = lastTrigger.atktime;
		// check if a linear attack or a linear decay has been interrupted by this release
		var interruptedLine =
			(acurve === 'linear' && tnow >= 0 && tnow <= atktime) ||
			(dcurve === 'linear' && tnow >= atktime + hold && tnow <= atktime + hold + decay);
		lastTrigger = false;

		this.offset.cancelScheduledValues(when);

		if (DEBUG){
			// simulate curve using releasedValue (debug purposes)
			for (var i = 0; true; i += 0.01){
				this.offset.setValueAtTime(releasedValue(lastRelease, i), when + i);
				if (i >= reltime)
					break;
			}
			return this;
		}

		if (interruptedLine)
			this.offset.linearRampToValueAtTime(v, when);
		else
			this.offset.setTargetAtTime(v, when, 0.001);
		curveTo(this.offset, rcurve, base, when, reltime);
		return this;
	};

	node.reset = function(when){
		if (typeof when === 'undefined')
			when = this.context.currentTime;
		lastTrigger = false;
		lastRelease = false;
		this.offset.cancelScheduledValues(when);
		this.offset.setValueAtTime(base, when);
		return this;
	};

	node.update = function(opts){
		base    = getNum  (opts, 'base'        , base   );
		attack  = getNum  (opts, 'attack'      , attack );
		acurve  = getCurve(opts, 'attackCurve' , acurve );
		peak    = getNum  (opts, 'peak'        , peak   );
		hold    = getNum  (opts, 'hold'        , hold   );
		decay   = getNum  (opts, 'decay'       , decay  );
		dcurve  = getCurve(opts, 'decayCurve'  , dcurve );
		sustain = getNum  (opts, 'sustain'     , sustain);
		release = getNum  (opts, 'release'     , release);
		rcurve  = getCurve(opts, 'releaseCurve', rcurve );
		return this;
	};

	return node;
}

// export appropriately
if (typeof window === 'undefined')
	module.exports = ADSRNode;
else
	window.ADSRNode = ADSRNode;

})();
