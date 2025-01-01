document.addEventListener('DOMContentLoaded', () => {
    // Shared audio context
    let audioContext = null;
    let isMuted = false;

    // Constants for localStorage keys
    const STORAGE_KEYS = {
        TEMPO: 'guitar_practice_tempo',
        BEATS_PER_CHORD: 'guitar_practice_beats_per_chord',
        TIME_SIGNATURE: 'guitar_practice_time_signature',
        SELECTED_CHORDS: 'guitar_practice_selected_chords',
        MUTE_STATE: 'guitar_practice_mute_state'
    };

    function getAudioContext() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioContext;
    }

    function playClick(frequency = 880, duration = 0.05) {
        if (isMuted) return; // Skip sound if muted
        
        const audioContext = getAudioContext();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    }

    // Add mute button functionality
    const muteButton = document.getElementById('muteMetronome');
    if (muteButton) {
        // Load mute state
        const savedMuteState = localStorage.getItem(STORAGE_KEYS.MUTE_STATE);
        if (savedMuteState !== null) {
            isMuted = savedMuteState === 'true';
            muteButton.textContent = isMuted ? '🔈' : '🔊';
        }

        muteButton.addEventListener('click', () => {
            isMuted = !isMuted;
            muteButton.textContent = isMuted ? '🔈' : '🔊';
            localStorage.setItem(STORAGE_KEYS.MUTE_STATE, isMuted.toString());
        });
    }

    // Chord practice functionality
    function initializeChordPractice() {
        const startButton = document.getElementById('startButton');
        const stopButton = document.getElementById('stopButton');
        const speedSlider = document.getElementById('speedSlider');
        const speedValue = document.getElementById('speedValue');
        const currentChord = document.getElementById('currentChord');
        const countdown = document.getElementById('countdown');
        const tempoSlider = document.getElementById('tempoSlider');
        const tempoValue = document.getElementById('tempoValue');
        const beatsPerMeasure = document.getElementById('beatsPerMeasure');
        const beatIndicator = document.getElementById('beat-indicator');
        const increaseTempo = document.getElementById('increaseTempo');
        const decreaseTempo = document.getElementById('decreaseTempo');
        
        if (!startButton || !stopButton || !speedSlider || !speedValue || !currentChord || !countdown ||
            !tempoSlider || !tempoValue || !beatsPerMeasure || !beatIndicator || !increaseTempo || !decreaseTempo) {
            console.error('Chord practice elements not found');
            return;
        }

        let metronomeIntervalId = null;
        let chordChangeTimeout = null;
        let currentSignatureBeat = 0;
        let chordBeatFuel = 0;
        let isPlaying = false;

        function getSelectedChords() {
            const checkboxes = document.querySelectorAll('.chord-item input[type="checkbox"]:checked');
            return Array.from(checkboxes).map(cb => cb.value);
        }

        function setSelectedChords(chordList) {
            document.querySelectorAll('.chord-item input[type="checkbox"]').forEach(checkbox => {
                checkbox.checked = chordList.includes(checkbox.value);
            });
        }
        
        // Load saved preferences
        function loadSavedPreferences() {
            try {
                // Load tempo
                const savedTempo = localStorage.getItem(STORAGE_KEYS.TEMPO);
                if (savedTempo !== null) {
                    tempoSlider.value = savedTempo;
                }

                // Load beats per chord
                const savedBeatsPerChord = localStorage.getItem(STORAGE_KEYS.BEATS_PER_CHORD);
                if (savedBeatsPerChord !== null) {
                    speedSlider.value = savedBeatsPerChord;
                }

                // Load time signature
                const savedTimeSignature = localStorage.getItem(STORAGE_KEYS.TIME_SIGNATURE);
                if (savedTimeSignature !== null) {
                    beatsPerMeasure.value = savedTimeSignature;
                }

                // Load selected chords
                const savedChords = localStorage.getItem(STORAGE_KEYS.SELECTED_CHORDS);
                if (savedChords !== null) {
                    const chordList = JSON.parse(savedChords);
                    setSelectedChords(chordList);
                }

                // Update displays after loading
                updateSpeedDisplay();
                updateTempoDisplay();
            } catch (error) {
                console.error('Error loading preferences:', error);
            }
        }

        // Save preferences
        function savePreferences() {
            try {
                localStorage.setItem(STORAGE_KEYS.TEMPO, tempoSlider.value);
                localStorage.setItem(STORAGE_KEYS.BEATS_PER_CHORD, speedSlider.value);
                localStorage.setItem(STORAGE_KEYS.TIME_SIGNATURE, beatsPerMeasure.value);
                localStorage.setItem(STORAGE_KEYS.SELECTED_CHORDS, JSON.stringify(getSelectedChords()));
            } catch (error) {
                console.error('Error saving preferences:', error);
            }
        }
        
        function getRandomChord(chords) {
            const randomIndex = Math.floor(Math.random() * chords.length);
            return chords[randomIndex];
        }
        
        function updateSpeedDisplay() {
            speedValue.textContent = speedSlider.value;
        }

        function updateTempoDisplay() {
            const tempo = parseInt(tempoSlider.value);
            tempoValue.textContent = tempo;
        }
        
        // Event listeners for saving preferences
        speedSlider.addEventListener('change', () => {
            updateSpeedDisplay();
            savePreferences();
        });

        tempoSlider.addEventListener('change', () => {
            updateTempoDisplay();
            savePreferences();
        });

        // Add event listeners for chord selection
        document.querySelectorAll('.chord-item input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', savePreferences);
        });

        // Add event listener for time signature changes
        beatsPerMeasure.addEventListener('change', () => {
            savePreferences();
            if (isPlaying) {
                stopChordProgression();
                startChordProgression();
            }
        });

        function showNextChord() {
            const selectedChords = getSelectedChords();
            var value = getRandomChord(selectedChords);
            currentChord.textContent = value;
            chordBeatFuel = parseInt(speedSlider.value);
        }

        function startChordProgression() {
            const selectedChords = getSelectedChords();
            
            if (selectedChords.length === 0) {
                alert('Please select at least one chord');
                return;
            }
            
            const interval = (60 / parseInt(tempoSlider.value)) * 1000; // Convert BPM to milliseconds
            const totalSignatureBeats = parseInt(beatsPerMeasure.value);
            
            isPlaying = true;
            currentSignatureBeat = 0;
            chordBeatFuel = parseInt(speedSlider.value);
            
            startButton.disabled = true;
            stopButton.disabled = false;
            
            // Show first chord immediately
            showNextChord();
            countdown.textContent = `-`;
            
            // Start metronome
            metronomeIntervalId = setInterval(() => {

                // Change chord if needed
                if (chordBeatFuel < 1) {
                    showNextChord();
                }

                // Play click sound
                playClick(currentSignatureBeat === 0 ? 880 : 440);
                
                // Visual feedback
                beatIndicator.classList.add('active');
                setTimeout(() => beatIndicator.classList.remove('active'), 100);
                
                // Update beat counter
                currentSignatureBeat = (currentSignatureBeat + 1) % totalSignatureBeats;
                
                let beatsPerChord = parseInt(speedSlider.value);
                // Update beat display to show current beat number
                countdown.textContent = `${(beatsPerChord - chordBeatFuel + 1)}`;
                
                // Decrement beats until next chord change
                chordBeatFuel--;
            
            }, interval);
        }
        
        function stopChordProgression() {
            if (metronomeIntervalId) {
                clearInterval(metronomeIntervalId);
                metronomeIntervalId = null;
            }
            if (chordChangeTimeout) {
                clearTimeout(chordChangeTimeout);
                chordChangeTimeout = null;
            }
            
            isPlaying = false;
            currentSignatureBeat = 0;
            startButton.disabled = false;
            stopButton.disabled = true;
            currentChord.textContent = 'Start!';
            countdown.textContent = '';
            beatIndicator.classList.remove('active');
        }
        
        startButton.addEventListener('click', startChordProgression);
        stopButton.addEventListener('click', stopChordProgression);

        // Tempo control buttons
        increaseTempo.addEventListener('click', () => {
            const newTempo = Math.min(parseInt(tempoSlider.value) + 1, parseInt(tempoSlider.max));
            tempoSlider.value = newTempo;
            updateTempoDisplay();
            if (isPlaying) {
                stopChordProgression();
                startChordProgression();
            }
        });

        decreaseTempo.addEventListener('click', () => {
            const newTempo = Math.max(parseInt(tempoSlider.value) - 1, parseInt(tempoSlider.min));
            tempoSlider.value = newTempo;
            updateTempoDisplay();
            if (isPlaying) {
                stopChordProgression();
                startChordProgression();
            }
        });

        // Initialize displays and load preferences
        loadSavedPreferences();
    }

    // Initialize components based on current page
    if (document.querySelector('.chord-display')) {
        initializeChordPractice();
    }
}); 