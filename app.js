let isTracking = false;
let repCount = 0;
let currentState = "BOTTOM"; 
let timeStartedLifting = 0;
let fastestRepTime = 9999; 
let bottomGravity = null;
let calibrationSamples = [];
let calibrationStartedAt = 0;
let audioContext = null;

// UI Elements
const startBtn = document.getElementById('startBtn');
const repCountDisplay = document.getElementById('repCount');
const repCard = document.getElementById('repCard');
const repTimeDisplay = document.getElementById('repTimeDisplay');
const statusText = document.getElementById('statusText');
const fatigueAlert = document.getElementById('fatigueAlert');

startBtn.addEventListener('click', () => {
    enableAudio();

    if (typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission().then(permissionState => {
            if (permissionState === 'granted') {
                startTracking();
            }
        }).catch(console.error);
    } else {
        startTracking();
    }
});

function startTracking() {
    isTracking = true;
    currentState = "CALIBRATING";
    bottomGravity = null;
    calibrationSamples = [];
    calibrationStartedAt = Date.now();
    startBtn.style.display = 'none';
    statusText.innerText = "Hold arm down: calibrating...";
    
    window.addEventListener('devicemotion', (event) => {
        if (!isTracking) return;

        const acceleration = event.accelerationIncludingGravity;
        if (!acceleration) return;

        if (currentState === "CALIBRATING") {
            calibrationSamples.push({
                x: acceleration.x ?? 0,
                y: acceleration.y ?? 0,
                z: acceleration.z ?? 0
            });

            if (Date.now() - calibrationStartedAt >= 700) {
                bottomGravity = averageVector(calibrationSamples);
                currentState = "BOTTOM";
                statusText.innerText = "Ready for hammer curls";
                statusText.style.color = "#4CAF50";
            }
            return;
        }

        const curlAngle = angleBetweenVectors(bottomGravity, acceleration);

        // Detect forearm rotation relative to the arm-down calibration.
        // This works for hammer curls because it does not assume one phone axis.
        const liftStartAngle = 20;
        const topAngle = 75;
        const bottomAngle = 15;

        if (currentState === "BOTTOM" && curlAngle > liftStartAngle) {
            // LIFTER STARTED PULLING
            currentState = "LIFTING";
            timeStartedLifting = Date.now();
            statusText.innerText = "Lifting...";
            statusText.style.color = "#FFEB3B"; 
        } 
        else if (currentState === "LIFTING" && curlAngle > topAngle) {
            // LIFTER SUCCESSFULLY REACHED THE TOP
            currentState = "TOP";
            let concentricTime = Date.now() - timeStartedLifting;
            
            // Glitch protection: No human curls in less than 200ms
            if (concentricTime > 200) {
                registerRep(concentricTime);
            }
            
            statusText.innerText = "Lower the weight";
            statusText.style.color = "#2196F3"; 
        }
        else if (currentState === "LIFTING" && curlAngle < bottomAngle) {
            // FAILED REP DETECTOR: 
            // They left the bottom, but gravity returned to 9.8 without ever hitting the 1.5 top threshold.
            // This means they did a half-rep and dropped it.
            let attemptTime = Date.now() - timeStartedLifting;
            
            // Wait 500ms to ensure it wasn't just a micro-wobble at the bottom
            if (attemptTime > 800) {
                triggerFailure("FAILED REP: Incomplete Range of Motion");
            } else {
                currentState = "BOTTOM"; // Silent reset for tiny jitters
            }
        }
        else if (currentState === "TOP" && curlAngle < bottomAngle) {
            // LIFTER LOWERED THE WEIGHT
            currentState = "BOTTOM";
            statusText.innerText = "Ready for next rep";
            statusText.style.color = "#4CAF50"; 
        }
    });
}

function enableAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioContext) {
        audioContext = new AudioContextClass();
    }

    if (audioContext.state === 'suspended' || audioContext.state === 'interrupted') {
        audioContext.resume().catch(console.warn);
    }
}

function playTone(frequency, duration, delay = 0) {
    if (!audioContext || audioContext.state !== 'running') return;

    const startTime = audioContext.currentTime + delay;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.85, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
}

function flashFailureScreen() {
    document.body.classList.remove('velocity-failure-flash', 'incomplete-rep-flash');
    void document.body.offsetWidth;
    document.body.classList.add('velocity-failure-flash');
}

function flashIncompleteRepScreen() {
    document.body.classList.remove('velocity-failure-flash', 'incomplete-rep-flash');
    void document.body.offsetWidth;
    document.body.classList.add('incomplete-rep-flash');
}

function playIncompleteRepAlert() {
    playTone(260, 0.16);
    playTone(170, 0.32, 0.24);
}

function playVelocityLossAlert() {
    // Six alarm pulses last for the same 2.1 seconds as the screen flash.
    [300, 220, 300, 180, 300, 140].forEach((frequency, index) => {
        playTone(frequency, 0.26, index * 0.35);
    });
}

function averageVector(samples) {
    const total = samples.reduce((sum, sample) => ({
        x: sum.x + sample.x,
        y: sum.y + sample.y,
        z: sum.z + sample.z
    }), { x: 0, y: 0, z: 0 });

    return {
        x: total.x / samples.length,
        y: total.y / samples.length,
        z: total.z / samples.length
    };
}

function angleBetweenVectors(first, second) {
    const x = second.x ?? 0;
    const y = second.y ?? 0;
    const z = second.z ?? 0;
    const dot = first.x * x + first.y * y + first.z * z;
    const firstMagnitude = Math.hypot(first.x, first.y, first.z);
    const secondMagnitude = Math.hypot(x, y, z);
    if (firstMagnitude === 0 || secondMagnitude === 0) return 0;
    const cosine = Math.max(-1, Math.min(1, dot / (firstMagnitude * secondMagnitude)));
    return Math.acos(cosine) * (180 / Math.PI);
}

function registerRep(concentricTime) {
    repCount++;
    repCountDisplay.innerText = repCount;
    repTimeDisplay.innerText = (concentricTime / 1000).toFixed(2) + "s";

    // Track the absolute fastest (most powerful) rep of the set
    if (concentricTime < fastestRepTime) {
        fastestRepTime = concentricTime;
    }

    // FATIGUE CHECK (Velocity Loss): 
    // If current rep takes 50% longer than your peak performance rep
    if (repCount > 2 && concentricTime > (fastestRepTime * 1.5)) {
        triggerFailure("FATIGUE: Velocity Loss Detected");
        return;
    }

    repCard.classList.remove('rep-success');
    void repCard.offsetWidth; // Restart the two-pulse confirmation animation.
    repCard.classList.add('rep-success');
    playTone(880, 0.2);
}

function triggerFailure(reason) {
    // An incomplete rep is feedback, not the end of the set.
    if (reason === "FAILED REP: Incomplete Range of Motion") {
        currentState = "BOTTOM";
        statusText.innerText = "Incomplete rep — ready to continue";
        statusText.style.color = "#FF9800";
        playIncompleteRepAlert();
        flashIncompleteRepScreen();
        return;
    }

    isTracking = false; 
    statusText.style.display = 'none';
    fatigueAlert.innerText = reason; // Display the exact reason they failed
    fatigueAlert.style.display = 'block';

    if (reason === "FATIGUE: Velocity Loss Detected") {
        playVelocityLossAlert();
        flashFailureScreen();
    }
    
}
