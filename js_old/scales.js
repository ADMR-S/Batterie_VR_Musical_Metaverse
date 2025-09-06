// Convertit une note MIDI en note musicale
function midiToNoteName(midiNumber) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNumber / 12) - 1;
    const note = notes[midiNumber % 12];
    return `${note}${octave}`;
}

// Fonction générique pour construire une gamme
function generateScale(startNote, intervals) {
    const scale = [startNote];
    let currentNote = startNote;
    for (const interval of intervals) {
        currentNote += interval;
        scale.push(currentNote);
    }
    return scale.map(midiToNoteName);
}

// Gammes prédéfinies
function majorScale(startNote) {
    const intervals = [2, 2, 1, 2, 2, 2, 1]; // Tons et demi-tons de la gamme majeure
    return generateScale(startNote, intervals);
}

function naturalMinorScale(startNote) {
    const intervals = [2, 1, 2, 2, 1, 2, 2]; // Tons et demi-tons de la gamme mineure naturelle
    return generateScale(startNote, intervals);
}

function harmonicMinorScale(startNote) {
    const intervals = [2, 1, 2, 2, 1, 3, 1]; // Tons et demi-tons de la gamme mineure harmonique
    return generateScale(startNote, intervals);
}

function melodicMinorScale(startNote) {
    const intervals = [2, 1, 2, 2, 2, 2, 1]; // Tons et demi-tons de la gamme mineure mélodique ascendante
    return generateScale(startNote, intervals);
}

function pentatonicMajorScale(startNote) {
    const intervals = [2, 2, 3, 2, 3]; // Intervalles de la gamme pentatonique majeure
    return generateScale(startNote, intervals);
}

function pentatonicMinorScale(startNote) {
    const intervals = [3, 2, 2, 3, 2]; // Intervalles de la gamme pentatonique mineure
    return generateScale(startNote, intervals);
}

function bluesScale(startNote) {
    const intervals = [3, 2, 1, 1, 3, 2]; // Intervalles de la gamme blues
    return generateScale(startNote, intervals);
}

function chromaticScale(startNote) {
    const intervals = Array(11).fill(1); // Tous les demi-tons
    return generateScale(startNote, intervals);
}

// Exemple d'utilisation
const startNoteMidi = 60; // Do central (C4)

console.log("Gamme majeure :", majorScale(startNoteMidi));
console.log("Gamme mineure naturelle :", naturalMinorScale(startNoteMidi));
console.log("Gamme mineure harmonique :", harmonicMinorScale(startNoteMidi));
console.log("Gamme mineure mélodique :", melodicMinorScale(startNoteMidi));
console.log("Gamme pentatonique majeure :", pentatonicMajorScale(startNoteMidi));
console.log("Gamme pentatonique mineure :", pentatonicMinorScale(startNoteMidi));
console.log("Gamme blues :", bluesScale(startNoteMidi));
console.log("Gamme chromatique :", chromaticScale(startNoteMidi));

function nameToMidi(noteName) {
    // Tableau des noms de notes dans une octave
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    // Extraire la note (lettre + accidentel) et l'octave
    const match = noteName.match(/^([A-G]#?|[A-G]b?)(-?\d+)$/);
    if (!match) {
        throw new Error(`Note invalide : ${noteName}`);
    }

    const note = match[1]; // Partie note (C, D#, etc.)
    const octave = parseInt(match[2], 10); // Partie octave (par exemple, 4 pour C4)

    // Calculer le numéro MIDI
    const noteIndex = notes.indexOf(note.replace('b', '#'));
    if (noteIndex === -1) {
        throw new Error(`Note invalide : ${noteName}`);
    }

    return (noteIndex + (octave + 1) * 12);
}


// Exemple d'utilisation
console.log(nameToMidi("C4"));  // 60
console.log(nameToMidi("A4"));  // 69
console.log(nameToMidi("D#3")); // 51
console.log(nameToMidi("Gb5")); // 78
console.log(nameToMidi("F#-1")); // 6

function scaleToMidi(scale) {
    if (!Array.isArray(scale)) {
        throw new Error("La gamme doit être un tableau de noms de notes.");
    }

    return scale.map(note => nameToMidi(note));
}

// Exemple d'utilisation
const scaleText = ["C4", "E4", "G4", "B3", "F#5"];
console.log(scaleToMidi(scaleText)); // [60, 64, 67, 59, 78]

// Fonction pour générer un arpège
function arpeggiator(scale, mode = "forward") {
    switch (mode) {
        case "forward":
            return scale; // Notes de la gamme dans l'ordre
        case "backward":
            return [...scale].reverse(); // Notes de la gamme en ordre inverse
        case "alternate":
            return [...scale, ...scale.slice(0, -1).reverse()]; // Avant, puis arrière (sans répéter la dernière note)
        case "random":
            return shuffle([...scale]); // Notes mélangées au hasard
        default:
            throw new Error("Mode invalide. Choisissez entre 'forward', 'backward', 'alternate', 'random'.");
    }
}

// Fonction utilitaire pour mélanger un tableau (shuffle)
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
