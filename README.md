# Audio Analysis POC

Een Next.js proof-of-concept applicatie voor het analyseren van audio bestanden (MP3/WAV) met geavanceerde muziekanalyse functies.

## Features

- **BPM Detectie**: Automatische detectie van het tempo (beats per minute)
- **Key Detectie**: Detectie van de toonsoort met Camelot Wheel notatie
- **Downbeat Detectie**: Identificatie van de eerste beat van elke maat
- **Waveform Visualisatie**: Visuele weergave van de waveform met frequentie-analyse
  - Kleurgecodeerd op basis van frequentiebanden:
    - Rood: Lage frequenties (0-250 Hz)
    - Groen: Midden frequenties (250-4kHz)
    - Blauw: Hoge frequenties (4kHz+)
  - Helderheid gebaseerd op RMS (Root Mean Square) waarde
- **Beatgrid Visualisatie**: Grafische weergave van het beatgrid met downbeats gemarkeerd

## Tech Stack

- **Next.js 16** - React framework
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **essentia.js** - Audio analysis library
- **meyda** - Audio feature extraction

## Installatie

1. Clone de repository:
```bash
git clone <repository-url>
cd poc-analyse-music-2
```

2. Installeer dependencies:
```bash
npm install
```

## Gebruik

1. Start de development server:
```bash
npm run dev
```

2. Open [http://localhost:3000](http://localhost:3000) in je browser

3. Upload een MP3 of WAV bestand via de file input

4. De applicatie analyseert het bestand automatisch en toont:
   - BPM waarde
   - Toonsoort (key) met Camelot notatie
   - Waveform visualisatie met frequentie-analyse
   - Beatgrid met gemarkeerde downbeats

## Project Structuur

```
app/
  ├── Analyzer.tsx          # Hoofdcomponent voor audio analyse
  ├── FileInput.tsx         # Audio decodering en analyse functies
  ├── WaveformCanvas.tsx    # Canvas component voor waveform rendering
  ├── Waveform.tsx          # Waveform component
  ├── Beatgrid.tsx        # Beatgrid component
  ├── page.tsx             # Homepage
  └── layout.tsx           # Root layout
```

## Beschikbare Scripts

- `npm run dev` - Start development server
- `npm run build` - Build voor productie
- `npm run start` - Start productie server
- `npm run lint` - Run ESLint

## Functionaliteiten in Detail

### Audio Decodering
De applicatie decodeert MP3 en WAV bestanden naar AudioBuffer voor verdere analyse.

### BPM Detectie
Detecteert automatisch het tempo van het nummer in beats per minute.

### Key Detectie
Identificeert de toonsoort en geeft deze weer in standaard notatie (bijv. "C major") en Camelot Wheel notatie (bijv. "8B").

### Waveform Analyse
Genereert een visuele waveform waarbij:
- Elke segment een kleur heeft gebaseerd op de dominante frequentieband
- De amplitude gebaseerd is op de RMS waarde (helderheid)

### Beatgrid
Visualiseert het beatgrid met:
- Blauwe lijnen voor downbeats (elke 4e beat)
- Grijze lijnen voor reguliere beats
- Tijdslabels op downbeats

## Licentie

Dit project is een proof-of-concept en is privé.
